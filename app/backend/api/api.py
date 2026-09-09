"""HTTP and WebSocket API for live sign-language translation."""

from dataclasses import asdict

from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket
from starlette.websockets import WebSocketDisconnect

from app.backend.core.core import ApplicationServices, create_services


def create_app(services: ApplicationServices | None = None) -> FastAPI:
	"""Create the API with injectable model and translation dependencies."""
	dependencies = services or create_services()
	app = FastAPI(title="Voice-To-Voiceless communication barrier API")

	@app.get("/health")
	async def health() -> dict[str, str]:
		return {"status": "ok"}

	@app.post("/api/v1/sign-language/interpret")
	async def interpret_frame(image: UploadFile = File(...)) -> dict[str, object]:
		"""Interpret one uploaded image, useful for clients and model checks."""
		frame = await image.read()
		if not frame:
			raise HTTPException(status_code=400, detail="Image frame cannot be empty")
		prediction = dependencies.sign_language_model.predict(frame)
		return {
			"prediction": asdict(prediction),
			"english": dependencies.english_translator.translate(prediction.label),
		}

	@app.websocket("/api/v1/translation/live")
	async def live_translation(websocket: WebSocket) -> None:
		"""Translate a stream of binary image frames into English ASL words."""
		await websocket.accept()
		frames: list[bytes] = []
		try:
			while True:
				frame = await websocket.receive_bytes()
				if not frame:
					await websocket.send_json({"error": "Image frame cannot be empty"})
					continue
				frames.append(frame)
				if len(frames) < dependencies.sequence_length:
					await websocket.send_json(
						{
							"status": "buffering",
							"frames_received": len(frames),
							"frames_required": dependencies.sequence_length,
						}
					)
					continue

				prediction = dependencies.sign_language_model.predict_sequence(frames)
				frames.clear()
				await websocket.send_json(
					{
						"prediction": asdict(prediction),
						"english": dependencies.english_translator.translate(
							prediction.label
						),
					}
				)
		except WebSocketDisconnect:
			return

	return app
