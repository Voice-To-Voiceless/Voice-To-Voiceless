import { GazeDiagnostics } from './gazeEstimator';
import { NormalizedGazePoint } from './gazeTypes';

export const DEFAULT_CALIBRATION_QUALITY_POLICY = {
  minimumConfidence: 0.5,
  minimumAperture: 0.15,
  maximumEyeDisagreement: 0.2,
  minimumAcceptedSamplesPerTarget: 20,
} as const;

export type CalibrationQualityRejectionReason =
  | 'pose unavailable'
  | 'low confidence'
  | 'invalid eye geometry'
  | 'insufficient aperture'
  | 'binocular disagreement'
  | 'non-finite value';

export type CalibrationQualityInput = {
  gaze: NormalizedGazePoint;
  leftConfidence: number;
  rightConfidence: number;
  diagnostics: GazeDiagnostics;
  pose: { yaw: number; pitch: number; eyeScale?: number; interEyeDistance?: number } | null;
};

export type CalibrationSampleQuality = {
  accepted: boolean;
  rejectionReasons: CalibrationQualityRejectionReason[];
};

export type CalibrationQualityPolicy = typeof DEFAULT_CALIBRATION_QUALITY_POLICY;

export function evaluateCalibrationSampleQuality(
  input: CalibrationQualityInput,
  policy: CalibrationQualityPolicy = DEFAULT_CALIBRATION_QUALITY_POLICY,
): CalibrationSampleQuality {
  const rejectionReasons: CalibrationQualityRejectionReason[] = [];

  if (!isFiniteNumber(input.gaze.x) || !isFiniteNumber(input.gaze.y) || !isFiniteNumber(input.gaze.confidence)) {
    rejectionReasons.push('non-finite value');
  }
  if (input.pose === null || !isFiniteNumber(input.pose.yaw) || !isFiniteNumber(input.pose.pitch)) {
    rejectionReasons.push('pose unavailable');
  }
  if (
    !isFiniteNumber(input.leftConfidence) ||
    !isFiniteNumber(input.rightConfidence) ||
    input.leftConfidence < policy.minimumConfidence ||
    input.rightConfidence < policy.minimumConfidence
  ) {
    rejectionReasons.push('low confidence');
  }
  if (input.diagnostics.leftPosition === null || input.diagnostics.rightPosition === null) {
    rejectionReasons.push('invalid eye geometry');
  }
  if (
    !isFiniteNumber(input.diagnostics.leftAperture) ||
    !isFiniteNumber(input.diagnostics.rightAperture) ||
    input.diagnostics.leftAperture < policy.minimumAperture ||
    input.diagnostics.rightAperture < policy.minimumAperture
  ) {
    rejectionReasons.push('insufficient aperture');
  }
  if (
    !isFiniteNumber(input.diagnostics.eyeDisagreement) ||
    (input.diagnostics.eyeDisagreement ?? Infinity) > policy.maximumEyeDisagreement
  ) {
    rejectionReasons.push('binocular disagreement');
  }

  return { accepted: rejectionReasons.length === 0, rejectionReasons };
}

function isFiniteNumber(value: number | null): boolean {
  return value !== null && Number.isFinite(value);
}