import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionId } from '../../types/communication';
import { DwellSelector } from '../../interaction/dwellSelector';
import { GazeJoystickController } from '../../vision/tracking/gazeJoystickController';
import { GazeSmoother } from '../../vision/temporal/gazeSmoother';
import { BinocularVerticalOffsetEstimator, getGazeDiagnostics } from '../../vision/estimation/gazeEstimator';
import { getEyePositionDiagnostics } from '../../vision/estimation/eyePosition';
import { estimateRelativeFacePose } from '../../vision/estimation/facePoseEstimator';
import { FaceTrackingLossTracker } from '../../vision/tracking/trackingReliability';
import { closeCamera, createFaceAdapter, openCamera } from '../services/browserCameraSession';
import { findVisibleTarget } from '../services/gazeTargetResolver';
import { TrackingSnapshot } from '../browserTypes';
import { MediaPipeFaceLandmarkerAdapter } from '../../vision/mediapipe/mediaPipeFaceLandmarker';
import { ModelTestingSession } from '../../modelTesting/modelTestingSession';
import { useCalibration } from './useCalibration';
import { evaluateCalibrationSampleQuality } from '../../vision/calibration/calibrationQuality';
import { isPitchWithinEnvelope, isPoseWithinEnvelope } from '../../vision/tracking/poseEnvelope';
import { getCalibrationFeatures } from '../../vision/calibration/calibrationFeatures';
import { GazeTargetVoting } from '../../vision/estimation/gazeTargetVoting';
import { GazeTemporalFilter } from '../../vision/temporal/gazeTemporalFilter';
import { L2CSOnnxEstimator } from '../../vision/estimation/l2csGaze';
import { NormalizedGazePoint } from '../../vision/types/gazeTypes';

const POSE_RETURN_STABILITY_MS = 300;
const initialSnapshot: TrackingSnapshot = { active: false, rawGaze: null, calibratedGaze: null, gazePoint: null, activeTarget: null, dwellProgress: 0, calibrating: false, calibrationIndex: 0, calibrationTarget: null, calibrationProgress: 0, calibrationPassKind: null, calibrationFailed: false, calibrationFailure: null, calibrationReady: false, trackingPauseReason: null, l2csYaw: null, l2csPitch: null, l2csProvider: null, l2csInferenceLatencyMs: null, l2csEstimatesPerSecond: null, poseStatus: 'unknown' };
export function useBrowserTracking(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  boardRef: React.RefObject<HTMLDivElement | null>,
  onSelect: (actionId: ActionId) => void,
  modelTestingSession?: ModelTestingSession,
) {
  const streamRef = useRef<MediaStream | null>(null);
  const adapterRef = useRef<MediaPipeFaceLandmarkerAdapter | null>(null);
  const l2csRef = useRef<L2CSOnnxEstimator | null>(null);
  const frameRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const processingRef = useRef(false);
  const smootherRef = useRef(new GazeSmoother());
  const joystickRef = useRef(new GazeJoystickController({ invertX: true, invertY: true }));
  const fallbackLoggedRef = useRef(false);
  const dwellRef = useRef(new DwellSelector(1200));
  const lossRef = useRef(new FaceTrackingLossTracker());
  const targetVotingRef = useRef(new GazeTargetVoting<ActionId>());
  const temporalFilterRef = useRef(new GazeTemporalFilter());
  const verticalOffsetEstimatorRef = useRef(new BinocularVerticalOffsetEstimator());
  const poseReturnStableSinceRef = useRef<number | null>(null);
  const { activeRef: calibrationActiveRef, indexRef: calibrationIndexRef, readyRef: calibrationReadyRef, mapper: calibrationMapperRef, poseEnvelope: calibrationPoseEnvelopeRef, targetsRef: calibrationTargetsRef, passKindRef: calibrationPassKindRef, failedRef: calibrationFailedRef, failureRef: calibrationFailureRef, start: startCalibration, reset: resetCalibration, pause: pauseCalibration, process: processCalibration } = useCalibration(modelTestingSession);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [status, setStatus] = useState('Camera is off. Start tracking to begin.');
  const [error, setError] = useState<string | null>(null);
  const resetInteraction = useCallback(() => {
    smootherRef.current.reset();
    lossRef.current.reset();
    dwellRef.current.cancel();
    dwellRef.current.resetCompletedTarget();
    targetVotingRef.current.reset();
    temporalFilterRef.current.reset();
    joystickRef.current.reset();
    poseReturnStableSinceRef.current = null;
    setSnapshot(value => ({ ...value, rawGaze: null, calibratedGaze: null, gazePoint: null, activeTarget: null, dwellProgress: 0 }));
  }, []);
  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null; activeRef.current = false; processingRef.current = false; adapterRef.current?.dispose(); adapterRef.current = null; l2csRef.current?.dispose(); l2csRef.current = null; closeCamera(streamRef.current); streamRef.current = null;
    resetCalibration();
    resetInteraction();
    setSnapshot(initialSnapshot);
    setStatus('Camera is off. Start tracking to begin.');
  }, [resetCalibration, resetInteraction]);
  const processFrame = useCallback(async (timestamp: number) => {
    const video = videoRef.current; const adapter = adapterRef.current;
    if (!activeRef.current || processingRef.current || !video || !adapter) return;
    processingRef.current = true;
    try {
      if (calibrationFailedRef.current) {
        setStatus(calibrationFailureRef.current ?? 'Calibration failed. Retry or cancel calibration.'); return;
      }
      const observation = await adapter.processFrame({ data: video, timestamp });
      if (!observation) {
        pauseCalibration(timestamp); const sustainedLoss = lossRef.current.markLost(); joystickRef.current.resetVelocity(); dwellRef.current.cancel(); targetVotingRef.current.reset(); poseReturnStableSinceRef.current = null;
        setSnapshot(value => ({ ...value, rawGaze: null, calibratedGaze: null, gazePoint: null, activeTarget: null, dwellProgress: 0, trackingPauseReason: 'face-lost' }));
        if (sustainedLoss) resetInteraction();
        setStatus('Face not detected. Keep your face in view.');
        return;
      }
      lossRef.current.markDetected();
      const unalignedDiagnostics = getGazeDiagnostics(observation);
      if (calibrationActiveRef.current && calibrationPassKindRef.current === 'training') {
        verticalOffsetEstimatorRef.current.update(unalignedDiagnostics);
      }
      const verticalOffset = verticalOffsetEstimatorRef.current.current;
      const l2cs = l2csRef.current;
      if (!l2cs) throw new Error('L2CS ONNX session is unavailable.');
      let gaze: NormalizedGazePoint | null;
      let angularGaze;
      let l2csDiagnostics;
      try {
        const estimate = await l2cs.estimate(video, observation, timestamp);
        angularGaze = estimate.gaze;
        l2csDiagnostics = estimate.diagnostics;
        gaze = { x: clamp(0.5 + estimate.gaze.yaw / 120), y: clamp(0.5 + estimate.gaze.pitch / 90), confidence: estimate.gaze.confidence, timestamp };
      } catch (l2csError) {
        const message = l2csError instanceof Error ? l2csError.message : 'L2CS gaze inference is unavailable.';
        stop();
        pauseCalibration(timestamp);
        setError(message);
        setStatus(`Tracking stopped: ${message}`);
        setSnapshot(value => ({ ...value, rawGaze: null, calibratedGaze: null, gazePoint: null, activeTarget: null, dwellProgress: 0, trackingPauseReason: 'invalid-gaze' }));
        return;
      }
      if (!gaze) {
        pauseCalibration(timestamp); joystickRef.current.resetVelocity(); dwellRef.current.cancel(); targetVotingRef.current.reset(); poseReturnStableSinceRef.current = null;
        setSnapshot(value => ({ ...value, rawGaze: null, calibratedGaze: null, gazePoint: null, activeTarget: null, dwellProgress: 0, trackingPauseReason: 'invalid-pose' }));
        setStatus('Gaze confidence is low. Keep your eyes visible.');
        return;
      }
      setSnapshot(value => ({ ...value, l2csYaw: angularGaze?.yaw ?? null, l2csPitch: angularGaze?.pitch ?? null, l2csProvider: l2csDiagnostics?.provider ?? null, l2csInferenceLatencyMs: l2csDiagnostics?.latencyMs ?? null, l2csEstimatesPerSecond: l2csDiagnostics?.estimatesPerSecond ?? null }));
      const rawGazeDiagnostics = getGazeDiagnostics(observation, verticalOffset);
      const filtered = temporalFilterRef.current.update({ gaze, diagnostics: rawGazeDiagnostics, leftConfidence: observation.leftEye.confidence, rightConfidence: observation.rightEye.confidence });
      if (!filtered.accepted || filtered.gaze === null || filtered.diagnostics === null) {
        pauseCalibration(timestamp);
        dwellRef.current.cancel();
        if (calibrationActiveRef.current && modelTestingSession) {
          modelTestingSession.recordQualityDecision(calibrationIndexRef.current, { accepted: false, rejectionReasons: ['temporal filter rejection'] });
        }
        setSnapshot(value => ({ ...value, rawGaze: { x: gaze.x, y: gaze.y }, calibratedGaze: null, gazePoint: null, activeTarget: null, dwellProgress: 0, trackingPauseReason: 'invalid-gaze' }));
        setStatus(`Gaze paused: ${filtered.rejectionReason ?? 'temporal filter rejection'}.`);
        return;
      }
      const filteredGaze = filtered.gaze;
      const pose = estimateRelativeFacePose(observation);
      setSnapshot(value => ({ ...value, poseStatus: pose === null ? 'unavailable' : 'stable' }));
      if (calibrationActiveRef.current && calibrationPassKindRef.current === 'validation' && !isPitchWithinEnvelope(calibrationPoseEnvelopeRef.current, pose)) {
        pauseCalibration(timestamp);
        dwellRef.current.cancel();
        setSnapshot(value => ({ ...value, rawGaze: { x: gaze.x, y: gaze.y }, calibratedGaze: null, gazePoint: null, activeTarget: null, dwellProgress: 0, trackingPauseReason: 'face-drift' }));
        setStatus('Calibration paused. Keep your head level and return to the calibrated position.');
        return;
      }
      if (!calibrationActiveRef.current && calibrationReadyRef.current && !isPoseWithinEnvelope(calibrationPoseEnvelopeRef.current, pose)) {
        poseReturnStableSinceRef.current = null; joystickRef.current.resetVelocity(); dwellRef.current.cancel(); targetVotingRef.current.reset();
        setSnapshot(value => ({ ...value, rawGaze: { x: gaze.x, y: gaze.y }, calibratedGaze: null, gazePoint: null, activeTarget: null, dwellProgress: 0, trackingPauseReason: 'face-drift' }));
        setStatus('Head position changed. Reposition your face inside the calibrated area.');
        return;
      }
      if (!calibrationActiveRef.current && calibrationReadyRef.current) {
        if (poseReturnStableSinceRef.current === null) poseReturnStableSinceRef.current = timestamp;
        if (timestamp - poseReturnStableSinceRef.current < POSE_RETURN_STABILITY_MS) {
          dwellRef.current.cancel();
          setSnapshot(value => ({ ...value, rawGaze: { x: gaze.x, y: gaze.y }, calibratedGaze: null, gazePoint: null, activeTarget: null, dwellProgress: 0, trackingPauseReason: 'face-drift' }));
          setStatus('Head position stabilizing. Hold still.');
          return;
        }
      }
      const poseSample = getPoseSample(pose);
      const gazeDiagnostics = filtered.diagnostics;
      const calibrationFeatures = getCalibrationFeatures(gazeDiagnostics, pose, angularGaze);
      const smoothed = smootherRef.current.update(filteredGaze);
      if (calibrationActiveRef.current) {
        const targetIndex = calibrationIndexRef.current;
        const quality = evaluateCalibrationSampleQuality({
          gaze,
          leftConfidence: observation.leftEye.confidence,
          rightConfidence: observation.rightEye.confidence,
          diagnostics: gazeDiagnostics,
          pose: poseSample,
        });
        if (modelTestingSession) modelTestingSession.recordEyeDiagnostics(targetIndex, { targetIndex, target: calibrationTargetsRef.current[targetIndex], timestamp, leftEye: { landmarks: observation.leftEye, ...getEyePositionDiagnostics(observation.leftEye) }, rightEye: { landmarks: observation.rightEye, ...getEyePositionDiagnostics(observation.rightEye) }, gazeDiagnostics, gaze, smoothed });
        const result = processCalibration(smoothed, timestamp, { raw: gaze, compensated: gaze, pose: poseSample, poseSource: pose, features: calibrationFeatures, quality });
        setSnapshot(value => ({ ...value, rawGaze: { x: gaze.x, y: gaze.y }, gazePoint: result.target, activeTarget: null, dwellProgress: 0, calibrating: !result.complete && !result.failed, calibrationIndex: calibrationIndexRef.current, calibrationTarget: result.target, calibrationProgress: result.settleProgress, calibrationPassKind: result.complete ? null : result.passKind, calibrationFailed: result.failed ?? false, calibrationFailure: result.failed ? result.status : null, calibrationReady: calibrationReadyRef.current, trackingPauseReason: null }));
        if (result.resetSmoother) smootherRef.current.reset();
        if (result.status) setStatus(result.status);
        return;
      }
      const mapper = calibrationMapperRef.current;
      const calibratedGaze = mapper?.map(smoothed, calibrationFeatures) ?? null;
      if (!mapper && !fallbackLoggedRef.current) {
        fallbackLoggedRef.current = true; console.warn('[gaze-tracking] using joystick fallback', { calibrationReady: calibrationReadyRef.current, calibrationActive: calibrationActiveRef.current, gaze: smoothed });
      }
      const point = calibratedGaze ?? joystickRef.current.update(smoothed);
      const candidateTargetId = boardRef.current ? findVisibleTarget(boardRef.current, point.x, point.y) : null;
      const targetId = targetVotingRef.current.update(candidateTargetId, timestamp);
      if (!targetId) {
        dwellRef.current.update(null, timestamp);
        const retainedTarget = dwellRef.current.getActiveTargetId();
        const retainedProgress = retainedTarget === null ? 0 : dwellRef.current.progress(retainedTarget, timestamp);
        if (candidateTargetId === null && retainedTarget === null) dwellRef.current.resetCompletedTarget();
        setSnapshot(value => ({ ...value, rawGaze: { x: gaze.x, y: gaze.y }, calibratedGaze, gazePoint: point, activeTarget: retainedTarget as ActionId | null, dwellProgress: retainedProgress, trackingPauseReason: null }));
        setStatus('Tracking ready. Look at a communication action.');
        return;
      }
      const selection = dwellRef.current.update(targetId, timestamp);
      const dwellProgress = selection ? 1 : dwellRef.current.progress(targetId, timestamp);
      setSnapshot(value => ({ ...value, rawGaze: { x: gaze.x, y: gaze.y }, calibratedGaze, gazePoint: point, activeTarget: targetId, dwellProgress, trackingPauseReason: null }));
      setStatus(`Looking at ${targetId}. Hold to select.`);
      if (selection) onSelect(targetId);
    } finally {
      processingRef.current = false;
      if (activeRef.current) frameRef.current = requestAnimationFrame(processFrame);
    }
  }, [boardRef, calibrationActiveRef, calibrationFailedRef, calibrationFailureRef, calibrationIndexRef, calibrationMapperRef, calibrationPassKindRef, calibrationPoseEnvelopeRef, calibrationReadyRef, calibrationTargetsRef, modelTestingSession, onSelect, pauseCalibration, processCalibration, resetInteraction, stop, videoRef]);
  const calibrate = useCallback(() => {
    if (!activeRef.current) return;
    startCalibration();
    if (calibrationPassKindRef.current === 'training') verticalOffsetEstimatorRef.current.reset();
    fallbackLoggedRef.current = false;
    resetInteraction();
    joystickRef.current.reset();
    setSnapshot(value => ({ ...value, calibrating: true, calibrationIndex: 0, calibrationTarget: calibrationTargetsRef.current[0], calibrationProgress: 0, calibrationPassKind: calibrationPassKindRef.current, calibrationFailed: false, calibrationFailure: null, calibrationReady: false, gazePoint: calibrationTargetsRef.current[0] }));
    setStatus(calibrationPassKindRef.current === 'training' ? 'Training pass started. Look at the yellow dot.' : 'Validation pass started. Look at the blue dot.');
  }, [calibrationPassKindRef, calibrationTargetsRef, resetInteraction, startCalibration]);
  const cancelCalibration = useCallback(() => {
    resetCalibration();
    resetInteraction();
    setSnapshot(value => ({ ...value, calibrating: false, calibrationTarget: null, calibrationPassKind: null, calibrationFailed: false, calibrationFailure: null }));
    setStatus('Calibration cancelled.');
  }, [resetCalibration, resetInteraction]);
  const start = useCallback(async () => {
    if (activeRef.current || !videoRef.current) return;
    setError(null);
    setStatus('Requesting camera permission...');
    try {
      streamRef.current = await openCamera(videoRef.current);
      adapterRef.current = await createFaceAdapter();
      l2csRef.current = new L2CSOnnxEstimator();
      await l2csRef.current.initialize();
      activeRef.current = true;
      setSnapshot(value => ({ ...value, active: true }));
      resetInteraction();
      frameRef.current = requestAnimationFrame(processFrame);
      calibrate();
    } catch (startError) {
      stop(); setError(startError instanceof Error ? startError.message : 'Tracking could not start.'); setStatus('Tracking unavailable. Touch remains available.');
    }
  }, [calibrate, processFrame, resetInteraction, stop, videoRef]);
  useEffect(() => stop, [stop]); return { snapshot, status, error, start, stop, calibrate, cancelCalibration };
}
function getPoseSample(pose: ReturnType<typeof estimateRelativeFacePose>) { return pose === null || pose.yaw === null || pose.pitch === null ? null : { yaw: pose.yaw, pitch: pose.pitch, eyeScale: pose.eyeScale, interEyeDistance: pose.interEyeDistance }; }
function clamp(value: number): number { return Math.max(0, Math.min(1, value)); }
