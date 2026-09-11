import { NormalizedGazePoint } from './gazeTypes';
import { FaceLandmarkObservation } from './landmarkTypes';
import { estimateEyePosition, getEyeAperture } from './eyePosition';

export function estimateGaze(
  observation: FaceLandmarkObservation,
  minimumConfidence = 0.5,
  minimumAperture = 0.08,
): NormalizedGazePoint | null {
  const leftPosition = estimateEyePosition(observation.leftEye);
  const rightPosition = estimateEyePosition(observation.rightEye);

  if (
    leftPosition === null ||
    rightPosition === null ||
    observation.leftEye.confidence < minimumConfidence ||
    observation.rightEye.confidence < minimumConfidence ||
    getEyeAperture(observation.leftEye) < minimumAperture ||
    getEyeAperture(observation.rightEye) < minimumAperture
  ) {
    return null;
  }

  const totalConfidence = observation.leftEye.confidence + observation.rightEye.confidence;
  const leftWeight = observation.leftEye.confidence / totalConfidence;
  const rightWeight = observation.rightEye.confidence / totalConfidence;

  return {
    x: leftPosition.x * leftWeight + rightPosition.x * rightWeight,
    y: leftPosition.y * leftWeight + rightPosition.y * rightWeight,
    confidence: Math.min(observation.leftEye.confidence, observation.rightEye.confidence),
    timestamp: observation.timestamp,
  };
}