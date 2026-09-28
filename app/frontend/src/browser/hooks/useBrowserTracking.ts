import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionId } from '../../types/communication';
import { DwellSelector } from '../../interaction/dwellSelector';
import { GazeJoystickController } from '../../vision/tracking/gazeJoystickController';
import { GazeSmoother } from '../../vision/temporal/gazeSmoother';
import { estimateGaze, getGazeDiagnostics } from '../../vision/estimation/gazeEstimator';
import { getEyePositionDiagnostics } from '../../vision/estimation/eyePosition';
import { compensateGazeForPose, FacePoseReference, estimateRelativeFacePose } from '../../vision/estimation/facePoseEstimator';
import { FaceTrackingLossTracker } from '../../vision/tracking/trackingReliability';
import { closeCamera, createFaceAdapter, openCamera } from '../services/browserCameraSession';
import { findVisibleTarget } from '../services/gazeTargetResolver';
import { TrackingSnapshot } from '../browserTypes';
import { MediaPipeFaceLandmarkerAdapter } from '../../vision/mediapipe/mediaPipeFaceLandmarker';
import { ModelTestingSession } from '../../modelTesting/modelTestingSession';
import { CALIBRATION_TARGETS, useCalibration } from './useCalibration';
import { evaluateCalibrationSampleQuality } from '../../vision/calibration/calibrationQuality';
import { L2CSOnnxEstimator } from '../../vision/estimation/l2csGaze';
import { getCalibrationFeatures } from '../../vision/calibration/calibrationFeatures';

const initialSnapshot: TrackingSnapshot = { active: false, rawGaze: null, calibratedGaze: null, gazePoint: null, activeTarget: null, dwellProgress: 0, calibrating: false, calibrationIndex: 0, calibrationTarget: null, calibrationProgress: 0, calibrationPassKind: null, calibrationFailed: false, calibrationFailure: null, calibrationReady: false, trackingPauseReason: null, l2csError: null, l2csYaw: null, l2csPitch: null, l2csProvider: null, l2csInferenceLatencyMs: null, l2csEstimatesPerSecond: null, poseStatus: 'unknown' };

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
  const l2csRef = useRef<L2CSOnnxEstimator | null>(null);
  const l2csDisabledRef = useRef(false);
  const {
    activeRef: calibrationActiveRef,
    indexRef: calibrationIndexRef,
    readyRef: calibrationReadyRef,
    mapper: calibrationMapperRef,
    targetsRef: calibrationTargetsRef,
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
    setSnapshot(value => ({ ...value, rawGaze: null, calibratedGaze: null, gazePoint: null, activeTarget: null, dwellProgress: 0 }));
  }, []);
  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    activeRef.current = false;
    processingRef.current = false;
    adapterRef.current?.dispose();
    adapterRef.current = null;
    l2csRef.current?.dispose();
    l2csRef.current = null;
    l2csDisabledRef.current = false;
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
        setSnapshot(value => ({ ...value, rawGaze: null, calibratedGaze: null, gazePoint: null, activeTarget: null, dwellProgress: 0 }));
        if (sustainedLoss) resetInteraction();
        setStatus('Face not detected. Keep your face in view.');
        return;
      }
      lossRef.current.markDetected();
      const pose = estimateRelativeFacePose(observation);
      let l2csResult: Awaited<ReturnType<L2CSOnnxEstimator['estimate']>> = null;
      if (l2csRef.current && !l2csDisabledRef.current) {
        try { l2csResult = await l2csRef.current.estimate(video, observation, timestamp); } catch (l2csError) {
          l2csDisabledRef.current = true;
          l2csRef.current.dispose();
          l2csRef.current = null;
          const message = l2csError instanceof Error ? l2csError.message : 'L2CS inference failed.';
          console.warn('[gaze-tracking] L2CS disabled after terminal frame failure', l2csError);
          if (calibrationActiveRef.current) {
            resetCalibration();
            setSnapshot(value => ({ ...value, calibrating: false, calibrationReady: false, calibrationTarget: null }));
          }
          setSnapshot(value => ({ ...value, trackingPauseReason: 'l2cs-disabled', l2csError: message }));
          setStatus('L2CS disabled. Restart tracking to retry gaze inference.');
        }
      }
      if (l2csResult) setSnapshot(value => ({ ...value, l2csYaw: l2csResult!.gaze.yaw, l2csPitch: l2csResult!.gaze.pitch, l2csProvider: l2csResult!.diagnostics.provider, l2csInferenceLatencyMs: l2csResult!.diagnostics.latencyMs, l2csEstimatesPerSecond: l2csResult!.diagnostics.estimatesPerSecond }));
      if (calibrationActiveRef.current && l2csRef.current && !l2csResult) {
        smootherRef.current.reset();
        setStatus('Waiting for a valid L2CS gaze estimate before recording.');
        return;
      }
      const gazeDiagnostics = getGazeDiagnostics(observation);
      const gaze = estimateGaze(observation) ?? (l2csResult ? gazeFromL2CS(l2csResult.gaze, timestamp) : null);
      if (!gaze) {
        joystickRef.current.resetVelocity();
        dwellRef.current.cancel();
        setSnapshot(value => ({ ...value, rawGaze: null, calibratedGaze: null, gazePoint: null, activeTarget: null, dwellProgress: 0 }));
        setStatus('Gaze confidence is low. Keep your eyes visible.');
        return;
      }
      if (!poseRef.current && pose !== null && pose.yaw !== null && pose.pitch !== null) poseRef.current = { yaw: pose.yaw, pitch: pose.pitch };
      const poseSample = getPoseSample(pose);
      const features = getCalibrationFeatures(gazeDiagnostics, pose, l2csResult?.gaze);
      const smoothed = smootherRef.current.update(gaze);
      if (calibrationActiveRef.current) {
        const targetIndex = calibrationIndexRef.current;
        const quality = evaluateCalibrationSampleQuality({
          gaze,
          leftConfidence: observation.leftEye.confidence,
          rightConfidence: observation.rightEye.confidence,
          diagnostics: gazeDiagnostics,
          pose: poseSample,
          l2csAvailable: l2csResult !== null,
        });
        if (modelTestingSession) modelTestingSession.recordEyeDiagnostics(targetIndex, {
            targetIndex,
            target: calibrationTargetsRef.current[targetIndex],
            timestamp,
            leftEye: { landmarks: observation.leftEye, ...getEyePositionDiagnostics(observation.leftEye) },
            rightEye: { landmarks: observation.rightEye, ...getEyePositionDiagnostics(observation.rightEye) },
            gazeDiagnostics,
            gaze,
            smoothed,
          });
        const result = processCalibration(smoothed, timestamp, {
          raw: gaze,
          compensated: compensateGazeForPose(gaze, pose, poseRef.current),
          pose: poseSample,
          poseSource: pose,
          features,
          quality,
        });
        setSnapshot(value => ({
          ...value,
          rawGaze: { x: gaze.x, y: gaze.y },
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
      if (mapper?.requiresL2CS() && !l2csResult) {
        smootherRef.current.reset();
        joystickRef.current.resetVelocity();
        dwellRef.current.cancel();
        setSnapshot(value => ({ ...value, rawGaze: null, calibratedGaze: null, gazePoint: null, activeTarget: null, dwellProgress: 0 }));
        setStatus('Waiting for a valid L2CS gaze estimate.');
        return;
      }
      const calibratedGaze = mapper?.map(smoothed, features) ?? null;
      if (!mapper && !fallbackLoggedRef.current) {
        fallbackLoggedRef.current = true;
        console.warn('[gaze-tracking] using joystick fallback', {
          calibrationReady: calibrationReadyRef.current,
          calibrationActive: calibrationActiveRef.current,
          gaze: smoothed,
        });
      }
      const point = mapper?.map(smoothed, features) ?? joystickRef.current.update(smoothed);
      const targetId = boardRef.current ? findVisibleTarget(boardRef.current, point.x, point.y) : null;
      if (!targetId) {
        dwellRef.current.cancel();
        setSnapshot(value => ({ ...value, rawGaze: { x: gaze.x, y: gaze.y }, calibratedGaze, gazePoint: point, activeTarget: null, dwellProgress: 0 }));
        setStatus('Tracking ready. Look at a communication action.');
        return;
      }
      const selection = dwellRef.current.update(targetId, timestamp);
      const dwellProgress = selection ? 1 : dwellRef.current.progress(targetId, timestamp);
      setSnapshot(value => ({ ...value, rawGaze: { x: gaze.x, y: gaze.y }, calibratedGaze, gazePoint: point, activeTarget: targetId, dwellProgress }));
      setStatus(`Looking at ${targetId}. Hold to select.`);
      if (selection) onSelect(targetId);
    } finally {
      processingRef.current = false;
      if (activeRef.current) frameRef.current = requestAnimationFrame(processFrame);
    }
  }, [boardRef, calibrationActiveRef, calibrationIndexRef, calibrationMapperRef, calibrationReadyRef, calibrationTargetsRef, modelTestingSession, onSelect, processCalibration, resetCalibration, resetInteraction, videoRef]);
  const calibrate = useCallback(() => {
    if (!activeRef.current) return;
    startCalibration();
    fallbackLoggedRef.current = false;
    resetInteraction();
    joystickRef.current.reset();
    setSnapshot(value => ({ ...value, calibrating: true, calibrationIndex: 0, calibrationTarget: calibrationTargetsRef.current[0], calibrationProgress: 0, calibrationReady: false, gazePoint: calibrationTargetsRef.current[0] }));
    setStatus('Calibration started. Look at the yellow dot.');
  }, [calibrationTargetsRef, resetInteraction, startCalibration]);
  const cancelCalibration = useCallback(() => {
    resetCalibration();
    setSnapshot(value => ({ ...value, calibrating: false, calibrationTarget: null, calibrationProgress: 0, calibrationFailed: false, calibrationFailure: null }));
  }, [resetCalibration]);
  const start = useCallback(async () => {
    if (activeRef.current || !videoRef.current) return;
    setError(null);
    setStatus('Requesting camera permission...');
    try {
      streamRef.current = await openCamera(videoRef.current);
      adapterRef.current = await createFaceAdapter();
      const l2cs = new L2CSOnnxEstimator();
      try { await l2cs.initialize(); l2csRef.current = l2cs; } catch (l2csError) { l2cs.dispose(); l2csDisabledRef.current = true; const message = l2csError instanceof Error ? l2csError.message : 'L2CS initialization failed.'; setSnapshot(value => ({ ...value, trackingPauseReason: 'l2cs-disabled', l2csError: message })); console.warn('[gaze-tracking] L2CS unavailable; using eye estimator', l2csError); }
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
  return { snapshot, status, error, start, stop, calibrate, cancelCalibration };
}
function getPoseSample(pose: ReturnType<typeof estimateRelativeFacePose>) { if (pose === null || pose.yaw === null || pose.pitch === null) return null;
  return { yaw: pose.yaw, pitch: pose.pitch, eyeScale: pose.eyeScale, interEyeDistance: pose.interEyeDistance };
}

function gazeFromL2CS(gaze: { yaw: number; pitch: number; confidence: number }, timestamp: number) {
  return { x: Math.min(1, Math.max(0, 0.5 + gaze.yaw / 180)), y: Math.min(1, Math.max(0, 0.5 - gaze.pitch / 180)), confidence: gaze.confidence, timestamp };
}
