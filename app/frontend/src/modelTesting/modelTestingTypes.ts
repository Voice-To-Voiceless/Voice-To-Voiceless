import type { RelativeFacePose } from '../vision/estimation/facePoseEstimator';
import type { CalibrationSample, RidgeCalibrationFeatures } from '../vision/calibration/gazeCalibration';
import type { CalibrationQualityRejectionReason, CalibrationSampleQuality } from '../vision/calibration/calibrationQuality';
import type { NormalizedGazePoint } from '../vision/types/gazeTypes';
import type { PoseSample } from './poseCalibrationDiagnostics';

export type CalibrationPassKind = 'training' | 'validation';
export type ModelTestingSessionOptions = { enableDiagnostics?: boolean };

export type CalibrationPass = {
  id: number;
  kind: CalibrationPassKind;
  targetOrder: CalibrationSample['target'][];
};

export type CalibrationDiagnosticPoints = {
  raw: NormalizedGazePoint;
  compensated: NormalizedGazePoint;
  pose: { yaw: number; pitch: number; eyeScale: number; interEyeDistance: number } | null;
  poseSource?: RelativeFacePose | null;
  features?: RidgeCalibrationFeatures;
  quality: CalibrationSampleQuality;
};

export type CalibrationQualitySummary = {
  accepted: number;
  rejected: number;
  rejectionReasons: Partial<Record<CalibrationQualityRejectionReason, number>>;
};

export type CalibrationSessionData = {
  all: CalibrationSample[];
  raw: CalibrationSample[];
  compensated: CalibrationSample[];
  poseConditioned: PoseSample[];
};

export type PassData = CalibrationSessionData & {
  qualityByTarget: Record<number, CalibrationQualitySummary>;
  targetOrder: CalibrationSample['target'][];
};