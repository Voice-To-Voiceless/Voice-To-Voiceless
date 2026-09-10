import { FaceLandmarkObservation, VisionFrame } from './landmarkTypes';

export interface FaceLandmarkerAdapter {
  initialize(): Promise<void>;
  processFrame(frame: VisionFrame): Promise<FaceLandmarkObservation | null>;
  dispose(): void;
}