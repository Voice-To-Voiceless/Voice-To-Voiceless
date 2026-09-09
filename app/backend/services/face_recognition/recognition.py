"""MediaPipe face landmark detection service."""

from dataclasses import dataclass
from pathlib import Path
from time import monotonic_ns

import cv2
import mediapipe as mp
from mediapipe.tasks.python import vision

from .temporal import BlendshapeSmoother


@dataclass(frozen=True)
class FaceObservation:
	"""Data extracted from one video frame."""

	face_detected: bool
	blendshapes: dict[str, float]


class FaceRecognitionService:
	"""Detect faces and extract facial blendshape scores."""

	def __init__(self, model_path: str | Path | None = None) -> None:
		default_path = Path(__file__).resolve().parents[2] / "models" / "face_landmarker.task"
		self._model_path = Path(model_path) if model_path else default_path
		self._last_timestamp_ms = -1
		self._smoother = BlendshapeSmoother()
		options = vision.FaceLandmarkerOptions(
			base_options=mp.tasks.BaseOptions(
				model_asset_path=str(self._model_path)
			),
			running_mode=vision.RunningMode.VIDEO,
			output_face_blendshapes=True,
			num_faces=1,
		)
		self._landmarker = vision.FaceLandmarker.create_from_options(options)

	def analyze_frame(
		self, frame: "cv2.Mat", timestamp_ms: int | None = None
	) -> FaceObservation:
		"""Analyze a BGR OpenCV frame."""
		rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
		image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
		current_timestamp_ms = (
		timestamp_ms if timestamp_ms is not None else monotonic_ns() // 1_000_000
		)
		if current_timestamp_ms <= self._last_timestamp_ms:
			current_timestamp_ms = self._last_timestamp_ms + 1
		self._last_timestamp_ms = current_timestamp_ms
		result = self._landmarker.detect_for_video(image, current_timestamp_ms)

		if not result.face_blendshapes:
			return FaceObservation(face_detected=False, blendshapes={})

		scores = {
			category.category_name: category.score
			for category in result.face_blendshapes[0]
			if category.category_name
		}
		return FaceObservation(
			face_detected=True,
			blendshapes=self._smoother.update(scores),
		)

	def close(self) -> None:
		"""Release the MediaPipe landmarker."""
		self._landmarker.close()

	def reset_temporal_state(self) -> None:
		"""Reset smoothing and timestamp state for a new video session."""
		self._smoother.reset()
		self._last_timestamp_ms = -1

	def __enter__(self) -> "FaceRecognitionService":
		return self

	def __exit__(self, *_: object) -> None:
		self.close()