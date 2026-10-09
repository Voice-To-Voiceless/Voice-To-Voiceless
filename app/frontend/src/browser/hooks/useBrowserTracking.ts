import { useCallback, useEffect, useRef, useState } from 'react';
import { DwellSelector } from '../../interaction/dwellSelector';
import { GazeJoystickController } from '../../vision/tracking/gazeJoystickController';
import { GazeSmoother } from '../../vision/temporal/gazeSmoother';
import { closeEyeTrackingCamera, openEyeTrackingCamera } from '../services/eyeTrackingCameraSession';
import { findVisibleTarget } from '../services/gazeTargetResolver';
import { TrackingSnapshot } from '../browserTypes';
import { ModelTestingSession } from '../../modelTesting/modelTestingSession';
import { useCalibration } from './useCalibration';
import { evaluateCalibrationSampleQuality } from '../../vision/calibration/calibrationQuality';
import { BrowserWebGazerAdapter, waitForWebGazerShutdown } from '../../vision/webgazer/webgazerAdapter';
import { createWebGazerCalibrationBackend } from '../../vision/webgazer/webgazerCalibration';

const initialSnapshot: TrackingSnapshot = { active: false, rawGaze: null, calibratedGaze: null, gazePoint: null, activeTarget: null, dwellProgress: 0, calibrating: false, calibrationIndex: 0, calibrationTarget: null, calibrationProgress: 0, calibrationPassKind: null, calibrationFailed: false, calibrationFailure: null, calibrationReady: false, calibrationConfidence: null, trackingPauseReason: null };

export function useBrowserTracking(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  boardRef: React.RefObject<HTMLDivElement | null>,
  onSelect: (targetId: string) => void,
  modelTestingSession?: ModelTestingSession,
) {
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const onSelectRef = useRef(onSelect);
  const activeRef = useRef(false);
  const processingRef = useRef(false);
  const smootherRef = useRef(new GazeSmoother(0.18, 0.006));
  // Gaze coordinates are already screen-space normalized coordinates: y increases downward.
  // Keep the fallback cursor aligned with the raw gaze direction vertically.
  const joystickRef = useRef(new GazeJoystickController({ invertX: true, invertY: false }));
  const fallbackLoggedRef = useRef(false);
  const dwellRef = useRef(new DwellSelector(900));
  const webgazerRef = useRef<BrowserWebGazerAdapter | null>(null);
  const shutdownRef = useRef(Promise.resolve());
  const calibrationBackendRef = useRef<ReturnType<typeof createWebGazerCalibrationBackend> | null>(null);
  const startRef = useRef<(() => Promise<void>) | null>(null);
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
  onSelectRef.current = onSelect;
  const resetInteraction = useCallback(() => {
    smootherRef.current.reset();
    dwellRef.current.cancel();
    joystickRef.current.reset();
    setSnapshot(value => ({ ...value, rawGaze: null, calibratedGaze: null, gazePoint: null, activeTarget: null, dwellProgress: 0 }));
  }, []);
  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    activeRef.current = false;
    processingRef.current = false;
    const webgazer = webgazerRef.current;
    if (webgazer) {
      shutdownRef.current = webgazer.stop().catch(() => undefined);
    }
    webgazerRef.current = null;
    calibrationBackendRef.current = null;
    closeEyeTrackingCamera(streamRef.current);
    if (videoRef.current) videoRef.current.srcObject = null;
    streamRef.current = null;
    resetCalibration();
    resetInteraction();
    setSnapshot(initialSnapshot);
    setStatus('Camera is off. Start tracking to begin.');
  }, [resetCalibration, resetInteraction, videoRef]);
  const processFrame = useCallback(async (timestamp: number) => {
    const video = videoRef.current;
    if (!activeRef.current || processingRef.current || !video) return;
    processingRef.current = true;
    try {
      const webgazerPrediction = webgazerRef.current?.getPrediction() ?? null;
      const trainingWebGazer = calibrationActiveRef.current && calibrationPassKindRef.current === 'training';
      const trainingTarget = trainingWebGazer ? calibrationTargetsRef.current[calibrationIndexRef.current] : null;
      if (!webgazerPrediction && !trainingWebGazer) {
        if (calibrationActiveRef.current) pauseCalibration(timestamp);
        smootherRef.current.reset();
        dwellRef.current.cancel();
        setSnapshot(value => ({ ...value, rawGaze: null, calibratedGaze: null, gazePoint: null, activeTarget: null, dwellProgress: 0 }));
        setStatus('Waiting for a valid WebGazer estimate. Keep your eyes visible.');
        return;
      }
      const gaze = webgazerPrediction
        ? gazeFromWebGazer(webgazerPrediction)
        : trainingTarget
          ? { ...trainingTarget, confidence: 1, timestamp }
          : null;
      if (!gaze) {
        if (calibrationActiveRef.current) pauseCalibration(timestamp);
        joystickRef.current.resetVelocity();
        dwellRef.current.cancel();
        setSnapshot(value => ({ ...value, rawGaze: null, calibratedGaze: null, gazePoint: null, activeTarget: null, dwellProgress: 0 }));
        setStatus('Gaze confidence is low. Keep your eyes visible.');
        return;
      }
      const smoothed = smootherRef.current.update(gaze);
      if (calibrationActiveRef.current) {
        const quality = evaluateCalibrationSampleQuality({
          gaze,
          leftConfidence: 1,
          rightConfidence: 1,
        });
        const result = processCalibration(smoothed, timestamp, {
          raw: gaze,
          compensated: gaze,
          pose: null,
          poseSource: null,
          quality,
        });
        setSnapshot(value => ({
          ...value,
          rawGaze: { x: smoothed.x, y: smoothed.y },
          gazePoint: !webgazerPrediction ? null : { x: smoothed.x, y: smoothed.y },
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
          calibrationConfidence: result.confidenceScore ?? value.calibrationConfidence,
        }));
        if (result.resetSmoother) {
          smootherRef.current.reset();
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
      const calibratedGaze = mapper?.map(smoothed) ?? null;
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
        setSnapshot(value => ({ ...value, rawGaze: { x: smoothed.x, y: smoothed.y }, calibratedGaze, gazePoint: point, activeTarget: null, dwellProgress: 0 }));
        setStatus('Tracking ready. Look at a communication action.');
        return;
      }
      const selection = dwellRef.current.update(targetId, timestamp);
      const dwellProgress = selection ? 1 : dwellRef.current.progress(targetId, timestamp);
      setSnapshot(value => ({ ...value, rawGaze: { x: smoothed.x, y: smoothed.y }, calibratedGaze, gazePoint: point, activeTarget: targetId, dwellProgress }));
      setStatus(`Looking at ${targetId}. Hold to select.`);
      if (selection) onSelectRef.current(targetId);
    } finally {
      processingRef.current = false;
      if (activeRef.current) frameRef.current = requestAnimationFrame(processFrame);
    }
  }, [boardRef, calibrationActiveRef, calibrationIndexRef, calibrationMapperRef, calibrationPassKindRef, calibrationReadyRef, calibrationTargetsRef, pauseCalibration, processCalibration, videoRef]);
  const calibrate = useCallback(async () => {
    if (!activeRef.current) {
      await startRef.current?.();
      return;
    }
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
    setSnapshot(value => ({ ...value, calibrating: true, calibrationIndex: 0, calibrationTarget: calibrationTargetsRef.current[0], calibrationProgress: 0, calibrationPassKind: calibrationPassKindRef.current, calibrationFailed: false, calibrationFailure: null, calibrationReady: false, calibrationConfidence: null, gazePoint: null }));
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
      await waitForWebGazerShutdown();
      await shutdownRef.current;
      streamRef.current = await openEyeTrackingCamera(videoRef.current);
      setStatus('Initializing WebGazer...');
      const webgazer = new BrowserWebGazerAdapter(streamRef.current);
      webgazerRef.current = webgazer;
      calibrationBackendRef.current = createWebGazerCalibrationBackend(webgazer);
      await webgazer.start();
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
  startRef.current = start;
  useEffect(() => stop, [stop]);
  return { snapshot, status, error, start, stop, calibrate, cancelCalibration };
}

export function gazeFromWebGazer(gaze: { x: number; y: number; timestamp: number }) {
  return {
    x: Math.min(1, Math.max(0, gaze.x / window.innerWidth)),
    y: Math.min(1, Math.max(0, gaze.y / window.innerHeight)),
    confidence: 1,
    timestamp: gaze.timestamp,
  };
}
