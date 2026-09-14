import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionId } from '../../types/communication';
import { DwellSelector } from '../../interaction/dwellSelector';
import { GazeJoystickController } from '../../vision/gazeJoystickController';
import { GazeSmoother } from '../../vision/gazeSmoother';
import { estimateGaze, getGazeDiagnostics } from '../../vision/gazeEstimator';
import { getEyePositionDiagnostics } from '../../vision/eyePosition';
import { compensateGazeForPose, FacePoseReference, estimateRelativeFacePose } from '../../vision/facePoseEstimator';
import { FaceTrackingLossTracker } from '../../vision/trackingReliability';
import { closeCamera, createFaceAdapter, openCamera } from '../services/browserCameraSession';
import { findVisibleTarget } from '../services/gazeTargetResolver';
import { TrackingSnapshot } from '../browserTypes';
import { MediaPipeFaceLandmarkerAdapter } from '../../vision/mediaPipeFaceLandmarker';
import { CALIBRATION_TARGETS, useCalibration } from './useCalibration';

const initialSnapshot: TrackingSnapshot = { active: false, gazePoint: null, activeTarget: null, dwellProgress: 0, calibrating: false, calibrationIndex: 0, calibrationProgress: 0, calibrationReady: false };

export function useBrowserTracking(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  boardRef: React.RefObject<HTMLDivElement | null>,
  onSelect: (actionId: ActionId) => void,
) {
  const streamRef = useRef<MediaStream | null>(null);
  const adapterRef = useRef<MediaPipeFaceLandmarkerAdapter | null>(null);
  const frameRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const processingRef = useRef(false);
  const smootherRef = useRef(new GazeSmoother());
  const joystickRef = useRef(new GazeJoystickController({ invertX: true, invertY: true }));
  const fallbackLoggedRef = useRef(false);
  const eyeDiagnosticsTargetRef = useRef(-1);
  const eyeDiagnosticsRef = useRef<Array<Record<string, unknown>>>([]);
  const dwellRef = useRef(new DwellSelector(1200));
  const lossRef = useRef(new FaceTrackingLossTracker());
  const poseRef = useRef<FacePoseReference | null>(null);
  const {
    activeRef: calibrationActiveRef,
    indexRef: calibrationIndexRef,
    readyRef: calibrationReadyRef,
    mapper: calibrationMapperRef,
    start: startCalibration,
    reset: resetCalibration,
    process: processCalibration,
  } = useCalibration();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [status, setStatus] = useState('Camera is off. Start tracking to begin.');
  const [error, setError] = useState<string | null>(null);

  const resetInteraction = useCallback(() => {
    smootherRef.current.reset();
    lossRef.current.reset();
    dwellRef.current.cancel();
    joystickRef.current.reset();
    poseRef.current = null;
    setSnapshot(value => ({ ...value, gazePoint: null, activeTarget: null, dwellProgress: 0 }));
  }, []);

  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    activeRef.current = false;
    processingRef.current = false;
    adapterRef.current?.dispose();
    adapterRef.current = null;
    closeCamera(streamRef.current);
    streamRef.current = null;
    resetCalibration();
    resetInteraction();
    setSnapshot(initialSnapshot);
    setStatus('Camera is off. Start tracking to begin.');
  }, [resetCalibration, resetInteraction]);

  const processFrame = useCallback(async (timestamp: number) => {
    const video = videoRef.current;
    const adapter = adapterRef.current;
    if (!activeRef.current || processingRef.current || !video || !adapter) return;
    processingRef.current = true;
    try {
      const observation = await adapter.processFrame({ data: video, timestamp });
      if (!observation) {
        const sustainedLoss = lossRef.current.markLost();
        joystickRef.current.resetVelocity();
        dwellRef.current.cancel();
        setSnapshot(value => ({ ...value, gazePoint: null, activeTarget: null, dwellProgress: 0 }));
        if (sustainedLoss) resetInteraction();
        setStatus('Face not detected. Keep your face in view.');
        return;
      }
      lossRef.current.markDetected();
      const gaze = estimateGaze(observation);
      if (!gaze) {
        joystickRef.current.resetVelocity();
        dwellRef.current.cancel();
        setSnapshot(value => ({ ...value, gazePoint: null, activeTarget: null, dwellProgress: 0 }));
        setStatus('Gaze confidence is low. Keep your eyes visible.');
        return;
      }
      const pose = estimateRelativeFacePose(observation);
      if (!poseRef.current && pose !== null && pose.yaw !== null && pose.pitch !== null) poseRef.current = { yaw: pose.yaw, pitch: pose.pitch };
      const smoothed = smootherRef.current.update(compensateGazeForPose(gaze, pose, poseRef.current));
      if (calibrationActiveRef.current) {
        const targetIndex = calibrationIndexRef.current;
        if (eyeDiagnosticsTargetRef.current !== targetIndex) {
          eyeDiagnosticsTargetRef.current = targetIndex;
          eyeDiagnosticsRef.current.push({
            targetIndex,
            target: CALIBRATION_TARGETS[targetIndex],
            timestamp,
            leftEye: { landmarks: observation.leftEye, ...getEyePositionDiagnostics(observation.leftEye) },
            rightEye: { landmarks: observation.rightEye, ...getEyePositionDiagnostics(observation.rightEye) },
            gazeDiagnostics: getGazeDiagnostics(observation),
            gaze,
            smoothed,
          });
        }
        const result = processCalibration(gaze, timestamp, {
          raw: gaze,
          compensated: compensateGazeForPose(gaze, pose, poseRef.current),
          pose: pose !== null && pose.yaw !== null && pose.pitch !== null ? { yaw: pose.yaw, pitch: pose.pitch } : null,
        });
        setSnapshot(value => ({
          ...value,
          gazePoint: result.target,
          activeTarget: null,
          dwellProgress: 0,
          calibrating: !result.complete,
          calibrationIndex: calibrationIndexRef.current,
          calibrationProgress: result.settleProgress,
          calibrationReady: calibrationReadyRef.current,
        }));
        if (result.resetSmoother) smootherRef.current.reset();
        if (result.complete) {
          downloadCalibrationEyeDiagnostics(eyeDiagnosticsRef.current);
        }
        if (result.status) setStatus(result.status);
        return;
      }
      const mapper = calibrationMapperRef.current;
      if (!mapper && !fallbackLoggedRef.current) {
        fallbackLoggedRef.current = true;
        console.warn('[gaze-tracking] using joystick fallback', {
          calibrationReady: calibrationReadyRef.current,
          calibrationActive: calibrationActiveRef.current,
          gaze: smoothed,
        });
      }
      const point = mapper?.map(smoothed) ?? joystickRef.current.update(smoothed);
      const targetId = boardRef.current ? findVisibleTarget(boardRef.current, point.x, point.y) : null;
      setSnapshot(value => ({ ...value, gazePoint: point, activeTarget: targetId, dwellProgress: targetId ? dwellRef.current.progress(targetId, timestamp) : 0 }));
      if (!targetId) {
        dwellRef.current.cancel();
        setStatus('Tracking ready. Look at a communication action.');
        return;
      }
      dwellRef.current.update(targetId, timestamp);
      setStatus(`Looking at ${targetId}. Hold to select.`);
      if (dwellRef.current.progress(targetId, timestamp) >= 1) {
        onSelect(targetId);
        dwellRef.current.cancel();
      }
    } finally {
      processingRef.current = false;
      if (activeRef.current) frameRef.current = requestAnimationFrame(processFrame);
    }
  }, [boardRef, calibrationActiveRef, calibrationIndexRef, calibrationMapperRef, calibrationReadyRef, onSelect, processCalibration, resetInteraction, videoRef]);

  const calibrate = useCallback(() => {
    if (!activeRef.current) return;
    startCalibration();
    fallbackLoggedRef.current = false;
    eyeDiagnosticsTargetRef.current = -1;
    eyeDiagnosticsRef.current = [];
    resetInteraction();
    joystickRef.current.reset();
    setSnapshot(value => ({ ...value, calibrating: true, calibrationIndex: 0, calibrationProgress: 0, calibrationReady: false, gazePoint: { x: 0.1, y: 0.1 } }));
    setStatus('Calibration started. Look at the yellow dot.');
  }, [resetInteraction, startCalibration]);

  const start = useCallback(async () => {
    if (activeRef.current || !videoRef.current) return;
    setError(null);
    setStatus('Requesting camera permission...');
    try {
      streamRef.current = await openCamera(videoRef.current);
      adapterRef.current = await createFaceAdapter();
      activeRef.current = true;
      setSnapshot(value => ({ ...value, active: true }));
      resetInteraction();
      frameRef.current = requestAnimationFrame(processFrame);
      calibrate();
    } catch (startError) {
      stop();
      setError(startError instanceof Error ? startError.message : 'Tracking could not start.');
      setStatus('Tracking unavailable. Touch remains available.');
    }
  }, [calibrate, processFrame, resetInteraction, stop, videoRef]);

  useEffect(() => stop, [stop]);
  return { snapshot, status, error, start, stop, calibrate };
}

function downloadCalibrationEyeDiagnostics(diagnostics: Array<Record<string, unknown>>): void {
  if (
    typeof document === 'undefined'
    || typeof Blob === 'undefined'
    || typeof URL === 'undefined'
    || typeof URL.createObjectURL !== 'function'
  ) {
    return;
  }

  const blob = new Blob([JSON.stringify({ targets: diagnostics }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `gaze-eye-diagnostics-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
