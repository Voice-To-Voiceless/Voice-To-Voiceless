"""Run face monitoring from a local camera."""

import cv2

from .interpretation import FaceInterpreter
from .recognition import FaceRecognitionService


class CameraMonitor:
    """Capture camera frames and display facial risk indicators."""

    def __init__(self, camera_index: int = 0) -> None:
        self._camera_index = camera_index
        self._interpreter = FaceInterpreter()

    def run(self) -> None:
        """Start monitoring until the user presses q."""
        camera = cv2.VideoCapture(self._camera_index)
        if not camera.isOpened():
            raise RuntimeError("Camera could not be opened")

        try:
            with FaceRecognitionService() as recognition_service:
                while True:
                    success, frame = camera.read()
                    if not success:
                        raise RuntimeError("Camera frame could not be read")

                    observation = recognition_service.analyze_frame(frame)
                    interpretation = self._interpreter.interpret(observation)
                    self._draw_status(
                        frame,
                        interpretation.state,
                        interpretation.risk_score,
                        interpretation.indicators,
                        observation.blendshapes,
                        interpretation.expression,
                        interpretation.expression_confidence,
                    )
                    cv2.imshow("Patient face monitoring", frame)

                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break
        finally:
            camera.release()
            cv2.destroyAllWindows()

    @staticmethod
    def _draw_status(
        frame: "cv2.Mat",
        state: str,
        risk_score: float,
        indicators: tuple[str, ...],
        blendshapes: dict[str, float],
        expression: str,
        expression_confidence: float,
    ) -> None:
        color = {
            "attention_required": (0, 0, 255),
            "possible_discomfort": (0, 255, 255),
        }.get(state, (0, 255, 0))
        label = f"{state} | risk: {risk_score:.2f}"
        cv2.putText(frame, label, (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
        expression_label = (
            f"expression: {expression} | confidence: "
            f"{expression_confidence:.2f}"
        )
        cv2.putText(
            frame,
            expression_label,
            (20, 75),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            color,
            2,
        )
        debug_label = (
            "debug frown: "
            f"{blendshapes.get('mouthFrownLeft', 0.0):.2f}/"
            f"{blendshapes.get('mouthFrownRight', 0.0):.2f}  "
            f"inner_brow: {blendshapes.get('browInnerUp', 0.0):.2f}"
        )
        cv2.putText(
            frame,
            debug_label,
            (20, 110),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            color,
            1,
        )
        if indicators:
            cv2.putText(
                frame,
                "signals: " + ", ".join(indicators),
                (20, 140),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                color,
                2,
            )


if __name__ == "__main__":
    CameraMonitor().run()
