"""Application composition root and dependency configuration."""

from dataclasses import dataclass, field

from app.backend.services.language_interpreter.language_translation import (
	EnglishTranslator,
	GlossaryEnglishTranslator,
)
from app.backend.services.language_interpreter.signlanguage_interpretation import (
	SignLanguageModel,
	UnconfiguredSignLanguageModel,
)
from app.backend.services.notification import NotificationService


@dataclass(frozen=True)
class ApplicationServices:
	"""Dependencies used by the communication-barrier API."""

	sign_language_model: SignLanguageModel
	english_translator: EnglishTranslator
	sequence_length: int = 64
	notification_service: NotificationService = field(default_factory=NotificationService)


def create_services() -> ApplicationServices:
	"""Build default services; production models can be injected at startup."""
	return ApplicationServices(
		sign_language_model=UnconfiguredSignLanguageModel(),
		english_translator=GlossaryEnglishTranslator(),
		sequence_length=64,
		notification_service=NotificationService(),
	)
