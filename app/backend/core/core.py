"""Application composition root and dependency configuration."""

from dataclasses import dataclass, field
import os
from pathlib import Path

from app.backend.services.language_interpreter.language_translation import (
	EnglishTranslator,
	GlossaryEnglishTranslator,
)
from app.backend.services.language_interpreter.signlanguage_interpretation import (
	SignLanguageModel,
	UnconfiguredSignLanguageModel,
	WlaslI3dSignLanguageModel,
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
	project_root = Path(__file__).resolve().parents[3]
	checkpoint = os.getenv(
		"WLASL_CHECKPOINT",
		str(project_root / "models" / "wlasl" / "asl2000.pt"),
	)
	labels = os.getenv(
		"WLASL_LABELS",
		str(project_root / "models" / "wlasl" / "wlasl_class_list.txt"),
	)
	source = os.getenv(
		"WLASL_SOURCE_PATH",
		str(project_root / ".tmp-wlasl" / "code" / "I3D"),
	)
	class_count = int(os.getenv("WLASL_CLASS_COUNT", "2000"))
	allowed_labels = os.getenv(
		"WLASL_ALLOWED_LABELS",
		"hello,thank you,help,nervous,yes,no,please,sorry,water,drink,eat,want,need,stop,friend,name,how,what,where,understand,again,love",
	).split(",")
	if not all(Path(path).exists() for path in (checkpoint, labels, source)):
		checkpoint = labels = source = None
	if checkpoint and labels and source:
		sign_language_model = WlaslI3dSignLanguageModel(
			checkpoint_path=checkpoint,
			labels_path=labels,
			wlasl_source_path=source,
			class_count=class_count,
				allowed_labels=allowed_labels,
		)
	else:
		sign_language_model = UnconfiguredSignLanguageModel()
	return ApplicationServices(
		sign_language_model=sign_language_model,
		english_translator=GlossaryEnglishTranslator(),
		sequence_length=64,
		notification_service=NotificationService(),
	)
