"""Interpret facial signals as non-diagnostic patient risk indicators."""

from dataclasses import dataclass

from .recognition import FaceObservation


@dataclass(frozen=True)
class FaceInterpretation:
	"""Non-diagnostic interpretation of one face observation."""

	state: str
	risk_score: float
	indicators: tuple[str, ...]
	expression: str = "neutral"
	expression_confidence: float = 0.0


class FaceInterpreter:
	"""Convert blendshape scores into conservative alert indicators."""

	@staticmethod
	def _strongest(scores: dict[str, float], *names: str) -> float:
		return max((scores.get(name, 0.0) for name in names), default=0.0)

	def interpret(self, observation: FaceObservation) -> FaceInterpretation:
		if not observation.face_detected:
			return FaceInterpretation("no_face", 0.0, (), "no_face", 0.0)

		scores = observation.blendshapes
		indicators: list[str] = []
		risk_score = 0.0

		smile_score = (
			scores.get("mouthSmileLeft", 0.0)
			+ scores.get("mouthSmileRight", 0.0)
		) / 2
		frown_score = (
			scores.get("mouthFrownLeft", 0.0)
			+ scores.get("mouthFrownRight", 0.0)
		) / 2
		inner_brow_score = scores.get("browInnerUp", 0.0)
		sadness_score = min(
			0.75 * frown_score + 0.25 * inner_brow_score,
			1.0,
		)
		if smile_score >= 0.40 and smile_score >= sadness_score:
			expression = "possible_smile"
			expression_confidence = smile_score
		elif sadness_score >= 0.25:
			expression = "possible_sadness"
			expression_confidence = sadness_score
		else:
			expression = "neutral"
			expression_confidence = max(smile_score, sadness_score)

		if expression == "possible_smile":
			return FaceInterpretation(
				"normal",
				0.0,
				(),
				expression,
				expression_confidence,
			)

		brow_tension = self._strongest(scores, "browDownLeft", "browDownRight")
		if brow_tension > 0.25:
			indicators.append("brow_tension")
			risk_score += min(brow_tension * 0.40, 0.40)

		eye_tension = self._strongest(scores, "eyeSquintLeft", "eyeSquintRight")
		if eye_tension > 0.25:
			indicators.append("eye_tension")
			risk_score += min(eye_tension * 0.40, 0.40)

		jaw_open = scores.get("jawOpen", 0.0)
		if jaw_open > 0.25:
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
		if mouth_discomfort > 0.25:
			indicators.append("mouth_discomfort")
			risk_score += min(mouth_discomfort * 0.40, 0.40)

		risk_score = min(risk_score, 1.0)
		if risk_score >= 0.45:
			state = "attention_required"
		elif risk_score >= 0.22:
			state = "possible_discomfort"
		else:
			state = "normal"
		return FaceInterpretation(
			state,
			risk_score,
			tuple(indicators),
			expression,
			expression_confidence,
		)