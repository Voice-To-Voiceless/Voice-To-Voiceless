"""HTTP API for notifications."""

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

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
	"""Create the notification API with injectable services."""
	dependencies = services or create_services()
	connections: set[tuple[WebSocket, str | None]] = set()

	async def broadcast_notification(notification: object) -> None:
		payload = notification.to_dict()
		for websocket, recipient in list(connections):
			if recipient is not None and payload["recipient"] != recipient:
				continue
			try:
				await websocket.send_json(payload)
			except Exception:
				connections.discard((websocket, recipient))

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
		await broadcast_notification(notification)
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
		await broadcast_notification(notification)
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
		await broadcast_notification(notification)
		return notification.to_dict()

	@app.websocket("/api/v1/notifications/ws")
	async def notifications_websocket(websocket: WebSocket, recipient: str | None = None) -> None:
		await websocket.accept()
		connection = (websocket, recipient)
		connections.add(connection)
		try:
			while True:
				await websocket.receive_text()
		except WebSocketDisconnect:
			connections.discard(connection)

	return app
