"""Application composition root and dependency configuration."""

from dataclasses import dataclass, field

from app.backend.services.notification import NotificationService


@dataclass(frozen=True)
class ApplicationServices:
	"""Dependencies used by the communication-barrier API."""

	notification_service: NotificationService = field(default_factory=NotificationService)


def create_services() -> ApplicationServices:
	"""Build default services; production models can be injected at startup."""
	return ApplicationServices(notification_service=NotificationService())
