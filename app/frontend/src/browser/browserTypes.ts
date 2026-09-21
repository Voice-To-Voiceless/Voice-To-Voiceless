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
  calibrationReady: boolean;
};

export type FaceRecognitionSnapshot = FaceAnalysis & {
  active: boolean;
};
