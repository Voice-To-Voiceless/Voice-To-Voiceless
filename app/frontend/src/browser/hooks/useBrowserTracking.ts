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
import { ModelTestingSession } from '../../modelTesting/modelTestingSession';
import { CALIBRATION_TARGETS, useCalibration } from './useCalibration';
import { evaluateCalibrationSampleQuality } from '../../vision/calibrationQuality';

const initialSnapshot: TrackingSnapshot = { active: false, gazePoint: null, activeTarget: null, dwellProgress: 0, calibrating: false, calibrationIndex: 0, calibrationTarget: null, calibrationProgress: 0, calibrationReady: false };

export function useBrowserTracking(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  boardRef: React.RefObject<HTMLDivElement | null>,
  onSelect: (actionId: ActionId) => void,
  modelTestingSession?: ModelTestingSession,
) {
  const streamRef = useRef<MediaStream | null>(null);
  const adapterRef = useRef<MediaPipeFaceLandmarkerAdapter | null>(null);
  const frameRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const processingRef = useRef(false);
  const smootherRef = useRef(new GazeSmoother());
  const joystickRef = useRef(new GazeJoystickController({ invertX: true, invertY: true }));
  const fallbackLoggedRef = useRef(false);
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
  } = useCalibration(modelTestingSession);
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
      const gazeDiagnostics = getGazeDiagnostics(observation);
      const smoothed = smootherRef.current.update(compensateGazeForPose(gaze, pose, poseRef.current));
      if (calibrationActiveRef.current) {
        const targetIndex = calibrationIndexRef.current;
        const quality = evaluateCalibrationSampleQuality({
          gaze,
          leftConfidence: observation.leftEye.confidence,
          rightConfidence: observation.rightEye.confidence,
          diagnostics: gazeDiagnostics,
          pose: pose !== null && pose.yaw !== null && pose.pitch !== null ? {
            yaw: pose.yaw,
            pitch: pose.pitch,
            eyeScale: pose.eyeScale,
            interEyeDistance: pose.interEyeDistance,
          } : null,
        });
        if (modelTestingSession) modelTestingSession.recordEyeDiagnostics(targetIndex, {
            targetIndex,
            target: CALIBRATION_TARGETS[targetIndex],
            timestamp,
            leftEye: { landmarks: observation.leftEye, ...getEyePositionDiagnostics(observation.leftEye) },
            rightEye: { landmarks: observation.rightEye, ...getEyePositionDiagnostics(observation.rightEye) },
            gazeDiagnostics,
            gaze,
            smoothed,
          });
        const result = processCalibration(gaze, timestamp, {
          raw: gaze,
          compensated: compensateGazeForPose(gaze, pose, poseRef.current),
          pose: pose !== null && pose.yaw !== null && pose.pitch !== null ? {
            yaw: pose.yaw,
            pitch: pose.pitch,
            eyeScale: pose.eyeScale,
            interEyeDistance: pose.interEyeDistance,
          } : null,
          quality,
        });
        setSnapshot(value => ({
          ...value,
          gazePoint: result.target,
          activeTarget: null,
          dwellProgress: 0,
          calibrating: !result.complete,
          calibrationIndex: calibrationIndexRef.current,
          calibrationTarget: result.target,
          calibrationProgress: result.settleProgress,
          calibrationReady: calibrationReadyRef.current,
        }));
        if (result.resetSmoother) smootherRef.current.reset();
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
      if (!targetId) {
        dwellRef.current.cancel();
        setSnapshot(value => ({ ...value, gazePoint: point, activeTarget: null, dwellProgress: 0 }));
        setStatus('Tracking ready. Look at a communication action.');
        return;
      }
      const selection = dwellRef.current.update(targetId, timestamp);
      const dwellProgress = selection ? 1 : dwellRef.current.progress(targetId, timestamp);
      setSnapshot(value => ({ ...value, gazePoint: point, activeTarget: targetId, dwellProgress }));
      setStatus(`Looking at ${targetId}. Hold to select.`);
      if (selection) onSelect(targetId);
    } finally {
      processingRef.current = false;
      if (activeRef.current) frameRef.current = requestAnimationFrame(processFrame);
    }
  }, [boardRef, calibrationActiveRef, calibrationIndexRef, calibrationMapperRef, calibrationReadyRef, modelTestingSession, onSelect, processCalibration, resetInteraction, videoRef]);

  const calibrate = useCallback(() => {
    if (!activeRef.current) return;
    startCalibration();
    fallbackLoggedRef.current = false;
    resetInteraction();
    joystickRef.current.reset();
    setSnapshot(value => ({ ...value, calibrating: true, calibrationIndex: 0, calibrationTarget: { x: 0.1, y: 0.1 }, calibrationProgress: 0, calibrationReady: false, gazePoint: { x: 0.1, y: 0.1 } }));
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
