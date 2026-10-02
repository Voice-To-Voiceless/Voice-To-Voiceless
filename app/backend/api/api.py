"""HTTP API for notifications and gaze inference."""

from uuid import UUID

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


class PatientLinkRequest(BaseModel):
	code: str = Field(min_length=1, max_length=80)


class CalibrationPoint(BaseModel):
	x: float
	y: float


class CalibrationValidationSample(BaseModel):
	prediction: CalibrationPoint
	target: CalibrationPoint
	target_index: int = Field(ge=0, le=8)
	accepted: bool = True


class CalibrationProfileRequest(BaseModel):
	setup_key: str = Field(min_length=64, max_length=64, pattern=r"^[0-9a-f]{64}$")
	engine: str = Field(min_length=1, max_length=30)
	engine_version: str = Field(min_length=1, max_length=40)
	payload_version: int = Field(gt=0)
	score_version: int = Field(gt=0)
	accuracy_score: int = Field(ge=55, le=100)
	training_data: dict[str, object]
	setup_metadata: dict[str, object]
	pose_reference: dict[str, object]
	validation_samples: list[CalibrationValidationSample] = Field(min_length=1)


class CalibrationVerificationRequest(BaseModel):
	score: int = Field(ge=0, le=100)


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

	@app.get("/api/v1/patients")
	async def list_patients() -> list[dict[str, str]]:
		return [patient.to_dict() for patient in dependencies.patient_service.list()]

	@app.post("/api/v1/patients/link")
	async def link_patient(request: PatientLinkRequest) -> dict[str, str]:
		try:
			patient = dependencies.patient_service.link_by_code(request.code)
		except ValueError as error:
			raise HTTPException(status_code=409, detail=str(error)) from error
		if patient is None:
			raise HTTPException(status_code=404, detail="Invalid patient code")
		return patient.to_dict()

	@app.get("/api/v1/patients/{patient_id}/calibration-profiles/{installation_id}/{setup_key}")
	async def get_calibration_profile(patient_id: str, installation_id: UUID, setup_key: str) -> dict[str, object]:
		profile = dependencies.calibration_profile_service.get(patient_id, installation_id, setup_key)
		if profile is None:
			raise HTTPException(status_code=404, detail="Calibration profile not found")
		return profile

	@app.put("/api/v1/patients/{patient_id}/calibration-profiles/{installation_id}/{setup_key}")
	async def save_calibration_profile(patient_id: str, installation_id: UUID, setup_key: str, request: CalibrationProfileRequest) -> dict[str, object]:
		if request.setup_key != setup_key:
			raise HTTPException(status_code=400, detail="setup_key does not match request path")
		try:
			outcome, profile = dependencies.calibration_profile_service.save(patient_id, installation_id, request.model_dump())
		except LookupError as error:
			raise HTTPException(status_code=404, detail=str(error)) from error
		except ValueError as error:
			raise HTTPException(status_code=422, detail=str(error)) from error
		return {"outcome": outcome, "profile": profile}

	@app.delete("/api/v1/patients/{patient_id}/calibration-profiles/{installation_id}/{setup_key}", status_code=204)
	async def delete_calibration_profile(patient_id: str, installation_id: UUID, setup_key: str) -> None:
		if not dependencies.calibration_profile_service.delete(patient_id, installation_id, setup_key):
			raise HTTPException(status_code=404, detail="Calibration profile not found")

	@app.patch("/api/v1/patients/{patient_id}/calibration-profiles/{installation_id}/{setup_key}")
	async def verify_calibration_profile(patient_id: str, installation_id: UUID, setup_key: str, request: CalibrationVerificationRequest) -> dict[str, object]:
		profile = dependencies.calibration_profile_service.verify(patient_id, installation_id, setup_key, request.score)
		if profile is None:
			raise HTTPException(status_code=404, detail="Calibration profile not found")
		return profile

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
		notifications = dependencies.notification_service.list(
			include_read=include_read,
			recipient=recipient,
		)
		return [notification.to_dict() for notification in notifications]

	@app.post("/api/v1/notifications/{notification_id}/read")
	async def mark_notification_read(notification_id: str) -> dict[str, object]:
		notification = dependencies.notification_service.mark_read(notification_id)
		if notification is None:
			raise HTTPException(status_code=404, detail="Notification not found")
		await broadcast_notification(notification)
		return notification.to_dict()

	@app.delete("/api/v1/notifications/{notification_id}", status_code=204)
	async def delete_notification(notification_id: str) -> None:
		notification = dependencies.notification_service.delete(notification_id)
		if notification is None:
			raise HTTPException(status_code=404, detail="Notification not found")

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
