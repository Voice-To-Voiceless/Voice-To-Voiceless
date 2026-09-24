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

export class BinocularVerticalOffsetEstimator {
  private readonly offsets: number[] = [];

  public reset(): void {
    this.offsets.length = 0;
  }

  public update(diagnostics: GazeDiagnostics): number {
    if (diagnostics.leftPosition !== null && diagnostics.rightPosition !== null) {
      const offset = diagnostics.leftPosition.y - diagnostics.rightPosition.y;
      if (Number.isFinite(offset)) this.offsets.push(offset);
    }
    return this.current;
  }

  public get current(): number {
    if (this.offsets.length === 0) return 0;
    const sorted = [...this.offsets].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  }
}

export function estimateGaze(
  observation: FaceLandmarkObservation,
  minimumConfidence = 0.5,
  minimumAperture = 0.15,
  verticalOffset = 0,
): NormalizedGazePoint | null {
  const diagnostics = getGazeDiagnostics(observation, verticalOffset);

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

export function getGazeDiagnostics(observation: FaceLandmarkObservation, verticalOffset = 0): GazeDiagnostics {
  const leftPosition = alignVerticalPosition(estimateEyePosition(observation.leftEye), -verticalOffset);
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

function alignVerticalPosition(position: { x: number; y: number } | null, yOffset: number): { x: number; y: number } | null {
  return position === null ? null : { x: position.x, y: position.y + yOffset };
}