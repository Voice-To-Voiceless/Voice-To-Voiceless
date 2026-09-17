"""HTTP and WebSocket API for live sign-language translation."""

from dataclasses import asdict

from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.websockets import WebSocketDisconnect

from app.backend.core.core import ApplicationServices, create_services


class NotificationCreateRequest(BaseModel):
	source: str = Field(min_length=1)
	type: str = Field(min_length=1)
	severity: str = Field(min_length=1)
	message: str = Field(min_length=1)
	patient_metadata: dict[str, object] = Field(default_factory=dict)
	recipient: str = "nurse"
	sender_metadata: dict[str, object] = Field(default_factory=dict)


class NurseAlertRequest(BaseModel):
	"""Alert sent by a nurse to a specific patient."""

	message: str = Field(min_length=1)
	severity: str = Field(default="info", min_length=1)
	patient_metadata: dict[str, object] = Field(default_factory=dict)
	nurse_metadata: dict[str, object] = Field(default_factory=dict)


def create_app(services: ApplicationServices | None = None) -> FastAPI:
	"""Create the API with injectable model and translation dependencies."""
	dependencies = services or create_services()
	app = FastAPI(title="Voice-To-Voiceless communication barrier API")
	app.add_middleware(
		CORSMiddleware,
		allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
		allow_credentials=True,
		allow_methods=["*"],
		allow_headers=["*"],
	)

	@app.get("/health")
	async def health() -> dict[str, str]:
		return {"status": "ok"}

	@app.post("/api/v1/notifications", status_code=201)
	async def create_notification(request: NotificationCreateRequest) -> dict[str, object]:
		notification = dependencies.notification_service.create(**request.model_dump())
		return notification.to_dict()

	@app.post("/api/v1/nurse/alerts", status_code=201)
	async def create_nurse_alert(request: NurseAlertRequest) -> dict[str, object]:
		"""Send an alert from the nurse dashboard to the patient application."""
		notification = dependencies.notification_service.create(
			source="nurse",
			type="nurse_alert",
			severity=request.severity,
			message=request.message,
			patient_metadata=request.patient_metadata,
			recipient="patient",
			sender_metadata=request.nurse_metadata,
		)
		return notification.to_dict()

	@app.get("/api/v1/notifications")
	async def list_notifications(
		include_read: bool = True,
		recipient: str | None = None,
	) -> list[dict[str, object]]:
		notifications = dependencies.notification_service.list(include_read=include_read)
		if recipient is not None:
			notifications = [notification for notification in notifications if notification.recipient == recipient]
		return [notification.to_dict() for notification in notifications]

	@app.post("/api/v1/notifications/{notification_id}/read")
	async def mark_notification_read(notification_id: str) -> dict[str, object]:
		notification = dependencies.notification_service.mark_read(notification_id)
		if notification is None:
			raise HTTPException(status_code=404, detail="Notification not found")
		return notification.to_dict()

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
		window_predictions = []
		window_stride = max(1, dependencies.sequence_length // 4)
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

				prediction = dependencies.sign_language_model.predict_sequence(
					frames[: dependencies.sequence_length]
				)
				window_predictions.append(prediction)
				frames = frames[window_stride:]
				if len(window_predictions) < 2:
					await websocket.send_json(
						{
							"status": "candidate",
							"prediction": asdict(prediction),
							"english": dependencies.english_translator.translate(prediction.label),
						}
					)
					continue

				recent_predictions = window_predictions[-3:]
				counts = {
					candidate.label: sum(
						item.label == candidate.label for item in recent_predictions
					)
					for candidate in recent_predictions
				}
				label = max(counts, key=counts.get)
				matching = [item for item in recent_predictions if item.label == label]
				confidence = sum(item.confidence for item in matching) / len(matching)
				if counts[label] < 2 or confidence < 0.70 or label == "unknown":
					await websocket.send_json({"status": "uncertain"})
					continue

				window_predictions.clear()
				await websocket.send_json(
					{
						"prediction": asdict(matching[-1]),
						"english": dependencies.english_translator.translate(label),
					}
				)
		except WebSocketDisconnect:
			return

	return app
