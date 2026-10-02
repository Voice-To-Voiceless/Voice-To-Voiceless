"""Application composition root and dependency configuration."""

from dataclasses import dataclass, field

from app.backend.services.notification import NotificationService
from app.backend.services.patient import PatientService
from app.backend.services.calibration import CalibrationProfileService


@dataclass(frozen=True)
class ApplicationServices:
	"""Dependencies used by the communication-barrier API."""

	notification_service: NotificationService = field(default_factory=NotificationService)
	patient_service: PatientService = field(default_factory=PatientService)
	calibration_profile_service: CalibrationProfileService = field(default_factory=CalibrationProfileService)


def create_services() -> ApplicationServices:
	"""Build default services; production models can be injected at startup."""
	return ApplicationServices(notification_service=NotificationService(), patient_service=PatientService(), calibration_profile_service=CalibrationProfileService())
