import { FaceLandmarkerAdapter } from './faceLandmarkerAdapter';
import { FaceLandmarkObservation, VisionFrame } from './landmarkTypes';
import { createMediaPipeLandmarker } from './mediaPipeFactory';
import { mapMediaPipeLandmarks } from './mediaPipeLandmarkMapper';

type MediaPipeLandmarkerFactory = (
  wasmPath: string,
  modelPath: string,
  minimumConfidence: number,
) => Promise<FaceLandmarkerLike>;

type FaceLandmarkerLike = {
  detectForVideo: (
    frame: unknown,
    timestamp: number,
  ) => { faceLandmarks: Array<Array<{ x: number; y: number }>> };
  close: () => void;
};

type MediaPipeFaceLandmarkerOptions = {
  wasmPath: string;
  modelPath: string;
  minimumConfidence?: number;
  createLandmarker?: MediaPipeLandmarkerFactory;
};

export class MediaPipeFaceLandmarkerAdapter implements FaceLandmarkerAdapter {
  private readonly options: MediaPipeFaceLandmarkerOptions;
  private readonly createLandmarker: MediaPipeLandmarkerFactory;
  private landmarker: FaceLandmarkerLike | null = null;

  public constructor(options: MediaPipeFaceLandmarkerOptions) {
    this.options = options;
    this.createLandmarker =
      options.createLandmarker ??
      (async (wasmPath, modelPath, minimumConfidence) =>
        createMediaPipeLandmarker(wasmPath, modelPath, minimumConfidence) as unknown as FaceLandmarkerLike);
  }

  public async initialize(): Promise<void> {
    this.landmarker = await this.createLandmarker(
      this.options.wasmPath,
      this.options.modelPath,
      this.options.minimumConfidence ?? 0.5,
    );
  }

  public async processFrame(frame: VisionFrame): Promise<FaceLandmarkObservation | null> {
    if (this.landmarker === null) {
      throw new Error('MediaPipe face landmarker must be initialized before processing frames.');
    }

    const result = this.landmarker.detectForVideo(frame.data, frame.timestamp);
    const landmarks = result.faceLandmarks[0];
    if (landmarks === undefined) {
      return null;
    }

    return mapMediaPipeLandmarks(
      landmarks,
      frame.timestamp,
      this.options.minimumConfidence ?? 0.5,
    );
  }

  public dispose(): void {
    this.landmarker?.close();
    this.landmarker = null;
  }
}