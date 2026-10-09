import { FaceAnalysis } from './services/faceExpressionAnalysis';

export type GazePoint = { x: number; y: number };

export type TrackingSnapshot = {
  active: boolean;
  rawGaze: GazePoint | null;
  calibratedGaze: GazePoint | null;
  gazePoint: GazePoint | null;
  activeTarget: string | null;
  dwellProgress: number;
  calibrating: boolean;
  calibrationIndex: number;
  calibrationTarget: GazePoint | null;
  calibrationProgress: number;
  calibrationPassKind: 'training' | 'validation' | null;
  calibrationFailed: boolean;
  calibrationFailure: string | null;
  calibrationReady: boolean;
  calibrationConfidence: number | null;
  trackingPauseReason: 'face-drift' | 'face-lost' | 'invalid-pose' | 'invalid-gaze' | null;
};

export type FaceRecognitionSnapshot = FaceAnalysis & {
  active: boolean;
};
