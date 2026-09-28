import { ActionId } from '../types/communication';
import { FaceAnalysis } from './services/faceExpressionAnalysis';

export type GazePoint = { x: number; y: number };

export type TrackingSnapshot = {
  active: boolean;
  rawGaze: GazePoint | null;
  calibratedGaze: GazePoint | null;
  gazePoint: GazePoint | null;
  activeTarget: ActionId | null;
  dwellProgress: number;
  calibrating: boolean;
  calibrationIndex: number;
  calibrationTarget: GazePoint | null;
  calibrationProgress: number;
  calibrationPassKind: 'training' | 'validation' | null;
  calibrationFailed: boolean;
  calibrationFailure: string | null;
  calibrationReady: boolean;
  trackingPauseReason: 'face-drift' | 'face-lost' | 'invalid-pose' | 'invalid-gaze' | 'l2cs-disabled' | null;
  l2csError: string | null;
  l2csYaw: number | null;
  l2csPitch: number | null;
  l2csProvider: 'webgpu' | 'wasm' | null;
  l2csInferenceLatencyMs: number | null;
  l2csEstimatesPerSecond: number | null;
  poseStatus: 'stable' | 'drift' | 'unavailable' | 'unknown';
};

export type FaceRecognitionSnapshot = FaceAnalysis & {
  active: boolean;
};
