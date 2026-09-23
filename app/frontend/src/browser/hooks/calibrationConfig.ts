import type { CalibrationPassKind } from '../../modelTesting/modelTestingSession';

export const CALIBRATION_TARGETS = [
  { x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.9, y: 0.1 },
  { x: 0.1, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.5 },
  { x: 0.1, y: 0.9 }, { x: 0.5, y: 0.9 }, { x: 0.9, y: 0.9 },
];

export const CALIBRATION_SETTLE_DURATION_MS = 1800;
export const CALIBRATION_SAMPLE_DURATION_MS = 900;
export const CALIBRATION_MAX_RECORDING_DURATION_MS = 5000;
export const CALIBRATION_TARGET_ORDERS = [CALIBRATION_TARGETS, [...CALIBRATION_TARGETS].reverse()] as const;

export type CalibrationState = { active: boolean; index: number; ready: boolean };
export type CalibrationResult = {
  target: { x: number; y: number } | null;
  passKind: CalibrationPassKind | null;
  status: string | null;
  complete: boolean;
  settleProgress: number;
  resetSmoother: boolean;
  failed?: boolean;
};