"""Application composition root and dependency configuration."""

from dataclasses import dataclass, field

from app.backend.services.notification import NotificationService
from app.backend.services.patient import PatientService


@dataclass(frozen=True)
class ApplicationServices:
	"""Dependencies used by the communication-barrier API."""

	notification_service: NotificationService = field(default_factory=NotificationService)
	patient_service: PatientService = field(default_factory=PatientService)


def create_services() -> ApplicationServices:
	"""Build default services; production models can be injected at startup."""
	return ApplicationServices(notification_service=NotificationService(), patient_service=PatientService())
