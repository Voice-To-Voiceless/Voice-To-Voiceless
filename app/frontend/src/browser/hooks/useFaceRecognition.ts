import { useCallback, useEffect, useRef, useState } from 'react';
import { MediaPipeFaceLandmarkerAdapter } from '../../vision/mediaPipeFaceLandmarker';
import { closeCamera, createFaceAdapter, openCamera } from '../services/browserCameraSession';
import { FaceRecognitionSnapshot } from '../browserTypes';
import { noFaceAnalysis, analyzeFaceExpression } from '../services/faceExpressionAnalysis';

const initialSnapshot: FaceRecognitionSnapshot = { ...noFaceAnalysis(), active: false };

export function useFaceRecognition(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const streamRef = useRef<MediaStream | null>(null);
  const adapterRef = useRef<MediaPipeFaceLandmarkerAdapter | null>(null);
  const frameRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const processingRef = useRef(false);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    adapterRef.current?.dispose();
    adapterRef.current = null;
    closeCamera(streamRef.current);
    streamRef.current = null;
    activeRef.current = false;
    processingRef.current = false;
    setSnapshot(initialSnapshot);
  }, []);

  const processFrame = useCallback(async (timestamp: number) => {
    const video = videoRef.current;
    const adapter = adapterRef.current;
    if (!activeRef.current || processingRef.current || !video || !adapter) return;
    processingRef.current = true;
    try {
      const observation = await adapter.processExpressionFrame({ data: video, timestamp });
      setSnapshot({ ...(observation ? analyzeFaceExpression(observation.blendshapes) : noFaceAnalysis()), active: true });
    } finally {
      processingRef.current = false;
      if (activeRef.current) frameRef.current = requestAnimationFrame(processFrame);
    }
  }, [videoRef]);

  const start = useCallback(async () => {
    if (activeRef.current || !videoRef.current) return;
    setError(null);
    try {
      streamRef.current = await openCamera(videoRef.current);
      adapterRef.current = await createFaceAdapter();
      activeRef.current = true;
      setSnapshot(snapshotValue => ({ ...snapshotValue, active: true }));
      frameRef.current = requestAnimationFrame(processFrame);
    } catch (startError) {
      stop();
      setError(startError instanceof Error ? startError.message : 'Face recognition could not start.');
    }
  }, [processFrame, stop, videoRef]);

  useEffect(() => stop, [stop]);
  return { snapshot, error, start, stop };
}
