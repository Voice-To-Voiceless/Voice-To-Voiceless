import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export async function createMediaPipeLandmarker(
  wasmPath: string,
  modelPath: string,
  minimumConfidence: number,
): Promise<FaceLandmarker> {
  const visionFileset = await FilesetResolver.forVisionTasks(wasmPath);

  return FaceLandmarker.createFromOptions(visionFileset, {
    baseOptions: { modelAssetPath: modelPath },
    minFaceDetectionConfidence: minimumConfidence,
    minFacePresenceConfidence: minimumConfidence,
    minTrackingConfidence: minimumConfidence,
    numFaces: 1,
    outputFaceBlendshapes: true,
    runningMode: 'VIDEO',
  });
}