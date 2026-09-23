import type { CalibrationSample } from '../vision/calibration/gazeCalibration';

export type PoseSample = CalibrationSample & {
  pose: { yaw: number; pitch: number; eyeScale: number; interEyeDistance: number };
};
export type Coefficients = number[];

export type PoseLeaveOneTargetOutDiagnostics = {
  accepted: boolean;
  rmsResidual: number | null;
  maxResidual: number | null;
  targetResults: Array<{ target: CalibrationSample['target']; sampleCount: number; rmsResidual: number | null; maxResidual: number | null; rejectionReason: string | null }>;
};

export type PoseValidationDiagnostics = {
  rmsResidual: number | null;
  maxResidual: number | null;
  targetResiduals: Array<{ target: CalibrationSample['target']; residual: number }>;
};

export type PitchBinDiagnostics = {
  lowerPitch: number;
  upperPitch: number;
  sampleCount: number;
  meanPitch: number;
  meanEyeScale: number;
  meanInterEyeDistance: number;
  rmsResidual: number;
  maxResidual: number;
};

export type PoseCoefficientDiagnostics = {
  featureNames: ['intercept', 'gazeX', 'gazeY', 'yaw', 'pitch'];
  xCoefficients: Coefficients;
  yCoefficients: Coefficients;
  xAbsoluteMagnitudes: Coefficients;
  yAbsoluteMagnitudes: Coefficients;
  xMaxAbsoluteMagnitude: number;
  yMaxAbsoluteMagnitude: number;
};

export type PoseFeatureRange = { min: number; max: number; range: number; mean: number };
export type PoseFeatureRanges = {
  yaw: PoseFeatureRange;
  pitch: PoseFeatureRange;
  eyeScale: PoseFeatureRange;
  interEyeDistance: PoseFeatureRange;
};