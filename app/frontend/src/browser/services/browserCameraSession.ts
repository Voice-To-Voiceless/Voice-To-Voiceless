import { MediaPipeFaceLandmarkerAdapter } from '../../vision/mediaPipeFaceLandmarker';

export const MODEL_PATH = '/models/face_landmarker.task';
export const WASM_PATH = '/wasm';

export async function openCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user' },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  return stream;
}

export async function createFaceAdapter(): Promise<MediaPipeFaceLandmarkerAdapter> {
  const adapter = new MediaPipeFaceLandmarkerAdapter({
    wasmPath: WASM_PATH,
    modelPath: MODEL_PATH,
  });
  await adapter.initialize();
  return adapter;
}

export function closeCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach(track => track.stop());
}
