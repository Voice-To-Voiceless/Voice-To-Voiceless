"""Contracts and implementations for ASL sign-language inference."""

from dataclasses import dataclass
from collections.abc import Sequence
from typing import Protocol


@dataclass(frozen=True)
class SignPrediction:
	"""The model output for one image frame."""

	label: str
	confidence: float


class SignLanguageModel(Protocol):
	"""Adapter contract for an English sign-language ML model."""

	def predict(self, image: bytes) -> SignPrediction:
		"""Predict the sign represented by an encoded image frame."""

	def predict_sequence(self, images: Sequence[bytes]) -> SignPrediction:
		"""Predict an ASL word represented by a sequence of image frames."""


class UnconfiguredSignLanguageModel:
	"""Safe development fallback until a trained model is configured."""

	def predict(self, image: bytes) -> SignPrediction:
		if not image:
			raise ValueError("Image frame cannot be empty")
		return SignPrediction(label="unknown", confidence=0.0)

	def predict_sequence(self, images: Sequence[bytes]) -> SignPrediction:
		if not images or any(not image for image in images):
			raise ValueError("ASL frame sequence cannot be empty")
		return SignPrediction(label="unknown", confidence=0.0)
