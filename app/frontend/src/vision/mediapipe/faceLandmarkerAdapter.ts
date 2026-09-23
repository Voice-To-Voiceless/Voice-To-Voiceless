import { FaceLandmarkObservation, VisionFrame } from '../types/landmarkTypes';

export interface FaceLandmarkerAdapter {
  initialize(): Promise<void>;
  processFrame(frame: VisionFrame): Promise<FaceLandmarkObservation | null>;
  dispose(): void;
}