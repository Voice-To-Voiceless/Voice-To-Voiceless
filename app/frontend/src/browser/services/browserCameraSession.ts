import { MediaPipeFaceLandmarkerAdapter } from '../../vision/mediapipe/mediaPipeFaceLandmarker';

const assetUrl = (path: string) => new URL(path, typeof document === 'undefined' ? 'http://localhost/' : document.baseURI).toString();
export const MODEL_PATH = assetUrl('models/face_landmarker.task');
export const WASM_PATH = assetUrl('wasm/');

export async function openCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'user',
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
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
