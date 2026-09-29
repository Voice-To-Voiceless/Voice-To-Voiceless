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
import { useCalibration } from './useCalibration';
import { evaluateCalibrationSampleQuality } from '../../vision/calibration/calibrationQuality';
import { L2CSOnnxEstimator } from '../../vision/estimation/l2csGaze';
import { getCalibrationFeatures } from '../../vision/calibration/calibrationFeatures';
import { BrowserWebGazerAdapter } from '../../vision/webgazer/webgazerAdapter';
import { createWebGazerCalibrationBackend } from '../../vision/webgazer/webgazerCalibration';

type GazeProvider = 'webgazer' | 'l2cs';

function getGazeProvider(): GazeProvider {
  if (typeof window === 'undefined') return 'l2cs';
  return new URLSearchParams(window.location.search).get('gazeProvider') === 'l2cs' ? 'l2cs' : 'webgazer';
}

const initialSnapshot: TrackingSnapshot = { active: false, rawGaze: null, calibratedGaze: null, gazePoint: null, activeTarget: null, dwellProgress: 0, calibrating: false, calibrationIndex: 0, calibrationTarget: null, calibrationProgress: 0, calibrationPassKind: null, calibrationFailed: false, calibrationFailure: null, calibrationReady: false, trackingPauseReason: null, l2csError: null, l2csYaw: null, l2csPitch: null, l2csProvider: null, l2csInferenceLatencyMs: null, l2csEstimatesPerSecond: null, l2csCropPreview: null, poseStatus: 'unknown' };

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
  const smootherRef = useRef(new GazeSmoother(0.18, 0.006));
  const l2csStabilityRef = useRef<Array<{ x: number; y: number; timestamp: number }>>([]);
  // Gaze coordinates are already screen-space normalized coordinates: y increases downward.
  // Keep the fallback cursor aligned with the raw gaze direction vertically.
  const joystickRef = useRef(new GazeJoystickController({ invertX: true, invertY: false }));
  const fallbackLoggedRef = useRef(false);
  const dwellRef = useRef(new DwellSelector(1200));
  const lossRef = useRef(new FaceTrackingLossTracker());
  const poseRef = useRef<FacePoseReference | null>(null);
  const l2csRef = useRef<L2CSOnnxEstimator | null>(null);
  const gazeProviderRef = useRef<GazeProvider>(getGazeProvider());
  const webgazerRef = useRef<BrowserWebGazerAdapter | null>(null);
  const calibrationBackendRef = useRef<ReturnType<typeof createWebGazerCalibrationBackend> | null>(null);
  const l2csDisabledRef = useRef(false);
  const {
    activeRef: calibrationActiveRef,
    indexRef: calibrationIndexRef,
    readyRef: calibrationReadyRef,
    mapper: calibrationMapperRef,
    targetsRef: calibrationTargetsRef,
    passKindRef: calibrationPassKindRef,
    start: startCalibration,
    reset: resetCalibration,
    pause: pauseCalibration,
    process: processCalibration,
  } = useCalibration(modelTestingSession, calibrationBackendRef);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [status, setStatus] = useState('Camera is off. Start tracking to begin.');
  const [error, setError] = useState<string | null>(null);
  const resetInteraction = useCallback(() => {
    smootherRef.current.reset();
    lossRef.current.reset();
    dwellRef.current.cancel();
    joystickRef.current.reset();
    poseRef.current = null;
    l2csStabilityRef.current = [];
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
    void webgazerRef.current?.stop();
    webgazerRef.current = null;
    calibrationBackendRef.current = null;
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
      const webgazerPrediction = gazeProviderRef.current === 'webgazer' ? webgazerRef.current?.getPrediction() ?? null : null;
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
      if (l2csResult) setSnapshot(value => ({ ...value, l2csYaw: l2csResult!.gaze.yaw, l2csPitch: l2csResult!.gaze.pitch, l2csProvider: l2csResult!.diagnostics.provider, l2csInferenceLatencyMs: l2csResult!.diagnostics.latencyMs, l2csEstimatesPerSecond: l2csResult!.diagnostics.estimatesPerSecond, l2csCropPreview: l2csResult!.diagnostics.cropPreview ?? value.l2csCropPreview }));
      const l2csIsActive = l2csRef.current !== null && !l2csDisabledRef.current;
      if (calibrationActiveRef.current && gazeProviderRef.current === 'l2cs' && l2csIsActive && !l2csResult) {
        pauseCalibration(timestamp);
        smootherRef.current.reset();
        setStatus('Waiting for a valid L2CS gaze estimate before recording.');
        return;
      }
      const trainingWebGazer = gazeProviderRef.current === 'webgazer' && calibrationActiveRef.current && calibrationPassKindRef.current === 'training';
      if (gazeProviderRef.current === 'webgazer' && !webgazerPrediction && !trainingWebGazer) {
        if (calibrationActiveRef.current) pauseCalibration(timestamp);
        smootherRef.current.reset();
        dwellRef.current.cancel();
        setSnapshot(value => ({ ...value, rawGaze: null, calibratedGaze: null, gazePoint: null, activeTarget: null, dwellProgress: 0 }));
        setStatus('Waiting for a valid WebGazer estimate. Keep your eyes visible.');
        return;
      }
      const gazeDiagnostics = getGazeDiagnostics(observation);
      const gaze = webgazerPrediction
        ? gazeFromWebGazer(webgazerPrediction)
        : l2csResult ? gazeFromL2CS(l2csResult.gaze, timestamp) : estimateGaze(observation);
      if (!gaze) {
        if (calibrationActiveRef.current) pauseCalibration(timestamp);
        joystickRef.current.resetVelocity();
        dwellRef.current.cancel();
        setSnapshot(value => ({ ...value, rawGaze: null, calibratedGaze: null, gazePoint: null, activeTarget: null, dwellProgress: 0 }));
        setStatus('Gaze confidence is low. Keep your eyes visible.');
        return;
      }
      if (!poseRef.current && pose !== null && pose.yaw !== null && pose.pitch !== null) poseRef.current = { yaw: pose.yaw, pitch: pose.pitch };
      const poseSample = getPoseSample(pose);
      const features = getCalibrationFeatures(gazeDiagnostics, pose, l2csResult?.gaze);
      const temporalStable = l2csResult ? updateL2CSStability(l2csStabilityRef.current, gaze) : true;
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
          temporalStable,
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
            l2cs: l2csResult?.gaze ?? null,
            l2csProvider: l2csResult?.diagnostics.provider ?? null,
            l2csInferenceLatencyMs: l2csResult?.diagnostics.latencyMs ?? null,
            l2csEstimatesPerSecond: l2csResult?.diagnostics.estimatesPerSecond ?? null,
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
          rawGaze: { x: smoothed.x, y: smoothed.y },
          gazePoint: gazeProviderRef.current === 'webgazer' && !webgazerPrediction ? null : { x: smoothed.x, y: smoothed.y },
          activeTarget: null,
          dwellProgress: 0,
          calibrating: calibrationActiveRef.current,
          calibrationIndex: calibrationIndexRef.current,
          calibrationTarget: result.target,
          calibrationProgress: result.settleProgress,
          calibrationPassKind: calibrationActiveRef.current ? calibrationPassKindRef.current : null,
          calibrationFailed: Boolean(result.failed) || (result.complete && !calibrationReadyRef.current),
          calibrationFailure: result.failed || (result.complete && !calibrationReadyRef.current) ? result.status : null,
          calibrationReady: calibrationReadyRef.current,
        }));
        if (result.resetSmoother) {
          smootherRef.current.reset();
          l2csStabilityRef.current = [];
        }
        if (result.status) setStatus(result.status);
        return;
      }
      const mapper = calibrationMapperRef.current;
      if (!mapper || !calibrationReadyRef.current) {
        const previewPoint = joystickRef.current.update(smoothed);
        dwellRef.current.cancel();
        setSnapshot(value => ({
          ...value,
          rawGaze: { x: smoothed.x, y: smoothed.y },
          calibratedGaze: null,
          gazePoint: previewPoint,
          activeTarget: null,
          dwellProgress: 0,
        }));
        setStatus('Calibration validation required before gaze selection.');
        return;
      }
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
        setSnapshot(value => ({ ...value, rawGaze: { x: smoothed.x, y: smoothed.y }, calibratedGaze, gazePoint: point, activeTarget: null, dwellProgress: 0 }));
        setStatus('Tracking ready. Look at a communication action.');
        return;
      }
      const selection = dwellRef.current.update(targetId, timestamp);
      const dwellProgress = selection ? 1 : dwellRef.current.progress(targetId, timestamp);
      setSnapshot(value => ({ ...value, rawGaze: { x: smoothed.x, y: smoothed.y }, calibratedGaze, gazePoint: point, activeTarget: targetId, dwellProgress }));
      setStatus(`Looking at ${targetId}. Hold to select.`);
      if (selection) onSelect(targetId);
    } finally {
      processingRef.current = false;
      if (activeRef.current) frameRef.current = requestAnimationFrame(processFrame);
    }
  }, [boardRef, calibrationActiveRef, calibrationIndexRef, calibrationMapperRef, calibrationPassKindRef, calibrationReadyRef, calibrationTargetsRef, modelTestingSession, onSelect, pauseCalibration, processCalibration, resetCalibration, resetInteraction, videoRef]);
  const calibrate = useCallback(async () => {
    if (!activeRef.current) return;
    try {
      if (modelTestingSession?.nextPassKind !== 'validation') {
        await calibrationBackendRef.current?.clearTrainingData();
      }
    } catch (calibrationError) {
      const message = calibrationError instanceof Error ? calibrationError.message : 'WebGazer training data could not be cleared.';
      setError(message);
      setStatus('Calibration could not start. Restart tracking and try again.');
      return;
    }
    if (!activeRef.current) return;
    startCalibration();
    fallbackLoggedRef.current = false;
    resetInteraction();
    joystickRef.current.reset();
    setSnapshot(value => ({ ...value, calibrating: true, calibrationIndex: 0, calibrationTarget: calibrationTargetsRef.current[0], calibrationProgress: 0, calibrationPassKind: calibrationPassKindRef.current, calibrationFailed: false, calibrationFailure: null, calibrationReady: false, gazePoint: null }));
    setStatus('Calibration started. Look at the yellow dot.');
  }, [calibrationPassKindRef, calibrationTargetsRef, modelTestingSession, resetInteraction, startCalibration]);
  const cancelCalibration = useCallback(() => {
    resetCalibration();
    setSnapshot(value => ({ ...value, calibrating: false, calibrationTarget: null, calibrationProgress: 0, calibrationPassKind: null, calibrationFailed: false, calibrationFailure: null }));
  }, [resetCalibration]);
  const start = useCallback(async () => {
    if (activeRef.current || !videoRef.current) return;
    setError(null);
    setStatus('Requesting camera permission...');
    try {
      streamRef.current = await openCamera(videoRef.current);
      adapterRef.current = await createFaceAdapter();
      if (gazeProviderRef.current === 'webgazer') {
        setStatus('Initializing WebGazer...');
        const webgazer = new BrowserWebGazerAdapter(streamRef.current);
        webgazerRef.current = webgazer;
        calibrationBackendRef.current = createWebGazerCalibrationBackend(webgazer);
        await webgazer.start();
      } else {
        const l2cs = new L2CSOnnxEstimator();
        try { await l2cs.initialize(); l2csRef.current = l2cs; } catch (l2csError) { l2cs.dispose(); l2csDisabledRef.current = true; const message = l2csError instanceof Error ? l2csError.message : 'L2CS initialization failed.'; setSnapshot(value => ({ ...value, trackingPauseReason: 'l2cs-disabled', l2csError: message })); console.warn('[gaze-tracking] L2CS unavailable; using eye estimator', l2csError); }
      }
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

export function gazeFromL2CS(gaze: { yaw: number; pitch: number; confidence: number }, timestamp: number) {
  // L2CS yaw is positive toward the camera's left, while screen X increases
  // toward the user's right. Invert yaw when converting to screen space.
  return { x: Math.min(1, Math.max(0, 0.5 - gaze.yaw / 180)), y: Math.min(1, Math.max(0, 0.5 - gaze.pitch / 180)), confidence: gaze.confidence, timestamp };
}

export function gazeFromWebGazer(gaze: { x: number; y: number; timestamp: number }) {
  return {
    x: Math.min(1, Math.max(0, gaze.x / window.innerWidth)),
    y: Math.min(1, Math.max(0, gaze.y / window.innerHeight)),
    confidence: 1,
    timestamp: gaze.timestamp,
  };
}

function updateL2CSStability(history: Array<{ x: number; y: number; timestamp: number }>, gaze: { x: number; y: number; timestamp: number }): boolean {
  history.push({ x: gaze.x, y: gaze.y, timestamp: gaze.timestamp });
  while (history.length > 0 && gaze.timestamp - history[0]!.timestamp > 900) history.shift();
  if (history.length < 3) return false;
  const xValues = history.map(sample => sample.x);
  const yValues = history.map(sample => sample.y);
  return Math.max(...xValues) - Math.min(...xValues) <= 0.035 && Math.max(...yValues) - Math.min(...yValues) <= 0.035;
}
