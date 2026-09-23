import { NormalizedGazePoint } from '../types/gazeTypes';
import { FaceLandmarkObservation } from '../types/landmarkTypes';
import { estimateEyePosition, getEyeAperture } from './eyePosition';

export type GazeDiagnostics = {
  leftPosition: { x: number; y: number } | null;
  rightPosition: { x: number; y: number } | null;
  leftAperture: number;
  rightAperture: number;
  eyeDisagreement: number | null;
};

export function estimateGaze(
  observation: FaceLandmarkObservation,
  minimumConfidence = 0.5,
  minimumAperture = 0.15,
): NormalizedGazePoint | null {
  const diagnostics = getGazeDiagnostics(observation);

  if (
    diagnostics.leftPosition === null ||
    diagnostics.rightPosition === null ||
    observation.leftEye.confidence < minimumConfidence ||
    observation.rightEye.confidence < minimumConfidence ||
    diagnostics.leftAperture < minimumAperture ||
    diagnostics.rightAperture < minimumAperture
  ) {
    return null;
  }

  const totalConfidence = observation.leftEye.confidence + observation.rightEye.confidence;
  const leftWeight = observation.leftEye.confidence / totalConfidence;
  const rightWeight = observation.rightEye.confidence / totalConfidence;

  return {
    x: diagnostics.leftPosition.x * leftWeight + diagnostics.rightPosition.x * rightWeight,
    y: diagnostics.leftPosition.y * leftWeight + diagnostics.rightPosition.y * rightWeight,
    confidence: Math.min(observation.leftEye.confidence, observation.rightEye.confidence),
    timestamp: observation.timestamp,
  };
}

export function getGazeDiagnostics(observation: FaceLandmarkObservation): GazeDiagnostics {
  const leftPosition = estimateEyePosition(observation.leftEye);
  const rightPosition = estimateEyePosition(observation.rightEye);

  return {
    leftPosition,
    rightPosition,
    leftAperture: getEyeAperture(observation.leftEye),
    rightAperture: getEyeAperture(observation.rightEye),
    eyeDisagreement: leftPosition !== null && rightPosition !== null
      ? Math.hypot(leftPosition.x - rightPosition.x, leftPosition.y - rightPosition.y)
      : null,
  };
}