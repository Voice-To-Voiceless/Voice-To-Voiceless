"""Interpret facial signals as non-diagnostic patient risk indicators."""

from dataclasses import dataclass

from .recognition import FaceObservation


@dataclass(frozen=True)
class FaceInterpretation:
	"""Non-diagnostic interpretation of one face observation."""

	state: str
	risk_score: float
	indicators: tuple[str, ...]


class FaceInterpreter:
	"""Convert blendshape scores into conservative alert indicators."""

	@staticmethod
	def _strongest(scores: dict[str, float], *names: str) -> float:
		return max((scores.get(name, 0.0) for name in names), default=0.0)

	def interpret(self, observation: FaceObservation) -> FaceInterpretation:
		if not observation.face_detected:
			return FaceInterpretation("no_face", 0.0, ())

		scores = observation.blendshapes
		indicators: list[str] = []
		risk_score = 0.0

		brow_tension = self._strongest(scores, "browDownLeft", "browDownRight")
		if brow_tension > 0.35:
			indicators.append("brow_tension")
			risk_score += min(brow_tension * 0.35, 0.35)

		eye_tension = self._strongest(scores, "eyeSquintLeft", "eyeSquintRight")
		if eye_tension > 0.35:
			indicators.append("eye_tension")
			risk_score += min(eye_tension * 0.35, 0.35)

		jaw_open = scores.get("jawOpen", 0.0)
		if jaw_open > 0.45:
			indicators.append("mouth_open")
			risk_score += min(jaw_open * 0.25, 0.25)

		mouth_discomfort = self._strongest(
			scores,
			"mouthFrownLeft",
			"mouthFrownRight",
			"mouthPressLeft",
			"mouthPressRight",
			"mouthStretchLeft",
			"mouthStretchRight",
			"noseSneerLeft",
			"noseSneerRight",
		)
		if mouth_discomfort > 0.3:
			indicators.append("mouth_discomfort")
			risk_score += min(mouth_discomfort * 0.35, 0.35)

		risk_score = min(risk_score, 1.0)
		if risk_score >= 0.45:
			state = "attention_required"
		elif risk_score >= 0.2:
			state = "possible_discomfort"
		else:
			state = "normal"
		return FaceInterpretation(state, risk_score, tuple(indicators))