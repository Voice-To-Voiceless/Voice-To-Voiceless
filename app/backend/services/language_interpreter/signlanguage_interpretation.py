"""Contracts and implementations for ASL sign-language inference."""

from io import BytesIO
from pathlib import Path
import sys
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


class WlaslI3dSignLanguageModel:
	"""Load the official WLASL I3D checkpoint for word-level ASL inference."""

	def __init__(
		self,
		checkpoint_path: str,
		labels_path: str,
		wlasl_source_path: str,
		class_count: int = 2000,
	) -> None:
		try:
			import numpy as np
			import torch
			from PIL import Image
		except ImportError as error:
			raise RuntimeError(
				"Install requirements-ml.txt before loading the WLASL model"
			) from error

		self._np = np
		self._image = Image
		self._torch = torch
		source_path = str(Path(wlasl_source_path).resolve())
		if source_path not in sys.path:
			sys.path.insert(0, source_path)
		try:
			from pytorch_i3d import InceptionI3d
		except ImportError as error:
			raise RuntimeError(
				"WLASL source must contain code/I3D/pytorch_i3d.py"
			) from error

		self._labels = [
			line.split(maxsplit=1)[-1]
			for line in Path(labels_path).read_text(encoding="utf-8").splitlines()
			if line.strip()
		]
		if len(self._labels) < class_count:
			raise ValueError("WLASL labels do not match the checkpoint class count")
		self._model = InceptionI3d(400, in_channels=3)
		self._model.replace_logits(class_count)
		state = torch.load(checkpoint_path, map_location="cpu")
		self._model.load_state_dict(state)
		self._model.eval()

	def predict(self, image: bytes) -> SignPrediction:
		return self.predict_sequence([image] * 16)

	def predict_sequence(self, images: Sequence[bytes]) -> SignPrediction:
		if not images or any(not image for image in images):
			raise ValueError("ASL frame sequence cannot be empty")
		frames = [
			self._np.asarray(
				self._image.open(BytesIO(image)).convert("RGB").resize((224, 224)),
				dtype=self._np.float32,
			)
			for image in images
		]
		video = self._np.stack(frames, axis=0) / 127.5 - 1.0
		tensor = self._torch.from_numpy(video).permute(3, 0, 1, 2).unsqueeze(0)
		with self._torch.no_grad():
			logits = self._model(tensor)
			if logits.ndim == 3:
				logits = logits.max(dim=2).values
			elif logits.ndim != 2:
				raise ValueError("Unexpected WLASL model output shape")
			probabilities = self._torch.softmax(logits, dim=1)
			confidence, index = probabilities.max(dim=1)
		return SignPrediction(
			label=self._labels[index.item()],
			confidence=round(confidence.item(), 4),
		)