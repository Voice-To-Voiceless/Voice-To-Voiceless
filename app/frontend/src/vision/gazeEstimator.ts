import { NormalizedGazePoint } from './gazeTypes';
import { FaceLandmarkObservation } from './landmarkTypes';
import { estimateEyePosition } from './eyePosition';

export function estimateGaze(
  observation: FaceLandmarkObservation,
  minimumConfidence = 0.5,
): NormalizedGazePoint | null {
  const leftPosition = estimateEyePosition(observation.leftEye);
  const rightPosition = estimateEyePosition(observation.rightEye);

  if (
    leftPosition === null ||
    rightPosition === null ||
    observation.leftEye.confidence < minimumConfidence ||
    observation.rightEye.confidence < minimumConfidence
  ) {
    return null;
  }

  return {
    x: (leftPosition.x + rightPosition.x) / 2,
    y: (leftPosition.y + rightPosition.y) / 2,
    confidence: Math.min(observation.leftEye.confidence, observation.rightEye.confidence),
    timestamp: observation.timestamp,
  };
}