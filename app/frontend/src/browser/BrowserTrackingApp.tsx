import React, { useEffect, useRef, useState } from 'react';
import { MediaPipeFaceLandmarkerAdapter } from '../vision/mediaPipeFaceLandmarker';
import { estimateGaze } from '../vision/gazeEstimator';
import { GazeSmoother } from '../vision/gazeSmoother';
import { GazeJoystickController } from '../vision/gazeJoystickController';
import { CalibrationSample, GazeCalibrationMapper } from '../vision/gazeCalibration';
import { compensateGazeForPose, FacePoseReference, estimateRelativeFacePose } from '../vision/facePoseEstimator';
import { findGazeTarget } from '../vision/gazeTarget';
import { DwellSelector } from '../interaction/dwellSelector';
import { ActionDefinition, ActionId, COMMUNICATION_ACTIONS } from '../types/communication';
import { NormalizedGazePoint } from '../vision/gazeTypes';

const DWELL_DURATION_MS = 1200;
const MODEL_PATH = '/models/face_landmarker.task';
const WASM_PATH = '/wasm';
const CALIBRATION_SAMPLE_DELAY_MS = 350;
const CALIBRATION_POINT_DURATION_MS = 1000;
const ALERT_DURATION_MS = 3500;
const CALIBRATION_TARGETS = [
  { x: 0.1, y: 0.1 },
  { x: 0.5, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.1, y: 0.5 },
  { x: 0.5, y: 0.5 },
  { x: 0.9, y: 0.5 },
  { x: 0.1, y: 0.9 },
  { x: 0.5, y: 0.9 },
  { x: 0.9, y: 0.9 },
];

export function BrowserTrackingApp() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const adapterRef = useRef<MediaPipeFaceLandmarkerAdapter | null>(null);
  const smootherRef = useRef(new GazeSmoother());
  const joystickRef = useRef(new GazeJoystickController({ invertX: true, invertY: true }));
  const calibrationMapperRef = useRef<GazeCalibrationMapper | null>(null);
  const calibrationActiveRef = useRef(false);
  const calibrationIndexRef = useRef(0);
  const calibrationStartedAtRef = useRef(0);
  const calibrationSamplesRef = useRef<CalibrationSample[]>([]);
  const calibrationPointSamplesRef = useRef<CalibrationSample[]>([]);
  const poseReferenceRef = useRef<FacePoseReference | null>(null);
  const dwellSelectorRef = useRef(new DwellSelector(DWELL_DURATION_MS));
  const animationFrameRef = useRef<number | null>(null);
  const trackingRef = useRef(false);
  const processingFrameRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [tracking, setTracking] = useState(false);
  const [status, setStatus] = useState('Camera is off. Start tracking to begin.');
  const [error, setError] = useState<string | null>(null);
  const [gazePoint, setGazePoint] = useState<{ x: number; y: number } | null>(null);
  const [activeTarget, setActiveTarget] = useState<ActionId | null>(null);
  const [dwellProgress, setDwellProgress] = useState(0);
  const [selectedAction, setSelectedAction] = useState<ActionId | null>(null);
  const [emergencyPending, setEmergencyPending] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationIndex, setCalibrationIndex] = useState(0);
  const [calibrationReady, setCalibrationReady] = useState(false);
  const [statusVisible, setStatusVisible] = useState(true);
  const [selectedNoticeVisible, setSelectedNoticeVisible] = useState(false);

  useEffect(() => stopTracking, []);

  useEffect(() => {
    setStatusVisible(true);
    const timer = window.setTimeout(() => setStatusVisible(false), ALERT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [status, error]);

  useEffect(() => {
    if (selectedAction === null) {
      setSelectedNoticeVisible(false);
      return;
    }

    setSelectedNoticeVisible(true);
    const timer = window.setTimeout(() => setSelectedNoticeVisible(false), ALERT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [selectedAction]);

  async function startTracking() {
    setError(null);
    setStatus('Requesting camera permission...');
    prepareAudio().catch(() => undefined);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current === null) {
        throw new Error('Video preview is unavailable.');
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setStatus('Loading face and iris landmark model...');

      const adapter = new MediaPipeFaceLandmarkerAdapter({
        wasmPath: WASM_PATH,
        modelPath: MODEL_PATH,
      });
      await adapter.initialize();
      adapterRef.current = adapter;
      trackingRef.current = true;
      setTracking(true);
      startCalibration();
      animationFrameRef.current = requestAnimationFrame(processFrame);
    } catch (trackingError) {
      stopTracking();
      const message = trackingError instanceof Error ? trackingError.message : 'Tracking could not start.';
      setError(message);
      setStatus('Tracking unavailable. Touch remains available.');
    }
  }

  function stopTracking() {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    adapterRef.current?.dispose();
    adapterRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    trackingRef.current = false;
    processingFrameRef.current = false;
    joystickRef.current.resetVelocity();
    calibrationActiveRef.current = false;
    calibrationSamplesRef.current = [];
    calibrationPointSamplesRef.current = [];
    poseReferenceRef.current = null;
    setGazePoint(null);
    setActiveTarget(null);
    setDwellProgress(0);
    setTracking(false);
    setCalibrating(false);
  }

  async function processFrame(timestamp: number) {
    const video = videoRef.current;
    const adapter = adapterRef.current;
    if (!trackingRef.current || processingFrameRef.current || video === null || adapter === null) {
      return;
    }

    processingFrameRef.current = true;
    try {
      const observation = await adapter.processFrame({ data: video, timestamp });
      if (observation === null) {
        setGazePoint(null);
        joystickRef.current.resetVelocity();
        resetGaze('Face not detected. Keep your face in view.');
        return;
      }

      const gaze = estimateGaze(observation);
      if (gaze === null) {
        setGazePoint(null);
        joystickRef.current.resetVelocity();
        resetGaze('Gaze confidence is low. Keep your eyes visible.');
        return;
      }

      const pose = estimateRelativeFacePose(observation);
      if (poseReferenceRef.current === null && pose !== null && pose.yaw !== null && pose.pitch !== null) {
        poseReferenceRef.current = { yaw: pose.yaw, pitch: pose.pitch };
      }
      const poseCompensatedGaze = compensateGazeForPose(gaze, pose, poseReferenceRef.current);
      const smoothedGaze = smootherRef.current.update(poseCompensatedGaze);
      if (calibrationActiveRef.current) {
        processCalibrationSample(smoothedGaze, timestamp);
        return;
      }

      const displayGaze = calibrationMapperRef.current
        ? calibrationMapperRef.current.map(smoothedGaze)
        : joystickRef.current.update(smoothedGaze);
      const targetId = findVisibleTarget(displayGaze.x, displayGaze.y);
      setGazePoint(displayGaze);

      if (targetId === null) {
        resetGaze('Tracking ready. Look at a communication action.');
      } else {
        const selection = dwellSelectorRef.current.update(targetId, timestamp);
        setActiveTarget(targetId);
        setDwellProgress(dwellSelectorRef.current.progress(targetId, timestamp));
        setStatus(`Looking at ${targetId}. Hold to select.`);
        if (selection !== null) {
          selectAction(targetId);
          setDwellProgress(0);
        }
      }
    } finally {
      processingFrameRef.current = false;
      if (trackingRef.current) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
      }
    }
  }

  function resetGaze(nextStatus: string) {
    dwellSelectorRef.current.cancel();
    setActiveTarget(null);
    setDwellProgress(0);
    setStatus(nextStatus);
  }

  function startCalibration() {
    if (!trackingRef.current) {
      return;
    }

    calibrationMapperRef.current = null;
    calibrationActiveRef.current = true;
    calibrationIndexRef.current = 0;
    calibrationStartedAtRef.current = performance.now();
    calibrationSamplesRef.current = [];
    calibrationPointSamplesRef.current = [];
    poseReferenceRef.current = null;
    joystickRef.current.reset();
    setCalibrationIndex(0);
    setCalibrationReady(false);
    setCalibrating(true);
    setGazePoint(CALIBRATION_TARGETS[0]);
    setStatus('Calibration started. Look at the yellow dot.');
  }

  function processCalibrationSample(gaze: NormalizedGazePoint, timestamp: number) {
    const target = CALIBRATION_TARGETS[calibrationIndexRef.current];
    const elapsed = timestamp - calibrationStartedAtRef.current;
    if (elapsed >= CALIBRATION_SAMPLE_DELAY_MS) {
      const sample = { gaze, target };
      calibrationPointSamplesRef.current.push(sample);
      calibrationSamplesRef.current.push(sample);
    }

    setGazePoint(target);
    setStatus(`Calibration point ${calibrationIndexRef.current + 1} of ${CALIBRATION_TARGETS.length}. Look at the dot.`);

    if (elapsed < CALIBRATION_POINT_DURATION_MS) {
      return;
    }

    if (calibrationPointSamplesRef.current.length === 0) {
      calibrationStartedAtRef.current = timestamp;
      setStatus('No stable gaze detected. Keep looking at the yellow dot.');
      return;
    }

    const nextIndex = calibrationIndexRef.current + 1;
    if (nextIndex >= CALIBRATION_TARGETS.length) {
      const mapper = GazeCalibrationMapper.fit(calibrationSamplesRef.current);
      calibrationMapperRef.current = mapper;
      calibrationActiveRef.current = false;
      setCalibrating(false);
      setCalibrationReady(mapper !== null);
      setStatus(mapper ? 'Calibration complete. Look at a communication action.' : 'Calibration failed. Try again.');
      setGazePoint(null);
      return;
    }

    calibrationIndexRef.current = nextIndex;
    calibrationStartedAtRef.current = timestamp;
    calibrationPointSamplesRef.current = [];
    setCalibrationIndex(nextIndex);
  }

  function findVisibleTarget(x: number, y: number): ActionId | null {
    const board = boardRef.current;
    if (board === null) {
      return null;
    }

    const bounds = Array.from(board.querySelectorAll<HTMLButtonElement>('[data-action-id]')).map(
      button => {
        const rectangle = button.getBoundingClientRect();
        return {
          id: button.dataset.actionId!,
          left: rectangle.left / window.innerWidth,
          top: rectangle.top / window.innerHeight,
          right: rectangle.right / window.innerWidth,
          bottom: rectangle.bottom / window.innerHeight,
        };
      },
    );

    return findGazeTarget({ x, y, confidence: 1, timestamp: performance.now() }, bounds) as ActionId | null;
  }

  function selectAction(actionId: ActionId) {
    if (actionId === 'emergency' && !emergencyPending) {
      setEmergencyPending(true);
      setSelectedAction(null);
      playSelectionSound(420);
      return;
    }

    setSelectedAction(actionId);
    setEmergencyPending(false);
    playSelectionSound(actionId === 'emergency' ? 680 : 560);
  }

  async function prepareAudio() {
    if (typeof window === 'undefined' || !window.AudioContext) {
      return;
    }

    audioContextRef.current ??= new window.AudioContext();
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  }

  function playSelectionSound(frequency: number) {
    prepareAudio()
      .then(() => {
      const context = audioContextRef.current;
      if (context === null) {
        return;
      }

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startTime = context.currentTime;
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.12, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.16);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.18);
      })
      .catch(() => undefined);
  }

  function handleTouchSelection(action: ActionDefinition) {
    selectAction(action.id);
  }

  return (
    <main className="tracking-app">
      {gazePoint && (
        <span
          aria-hidden="true"
          className="gaze-cursor"
          style={{
            left: `${Math.min(100, Math.max(0, gazePoint.x * 100))}%`,
            top: `${Math.min(100, Math.max(0, gazePoint.y * 100))}%`,
          }}
        />
      )}
      {calibrating && (
        <span
          aria-hidden="true"
          className="calibration-target"
          style={{ left: `${CALIBRATION_TARGETS[calibrationIndex].x * 100}%`, top: `${CALIBRATION_TARGETS[calibrationIndex].y * 100}%` }}
        />
      )}
      <header className="app-header">
        <div>
          <p className="eyebrow">V2VL EYE TRACKING PROTOTYPE</p>
          <h1>How can we help?</h1>
        </div>
        <span className={tracking ? 'connection-badge ready' : 'connection-badge'}>
          <span className="connection-dot" />
          {tracking ? 'Tracking live' : 'Touch fallback'}
        </span>
      </header>

      <section className="camera-panel">
        <video ref={videoRef} className="camera-preview" autoPlay muted playsInline />
        <div className="camera-overlay">
          <span className="camera-status-dot" />
          {tracking ? 'Camera and face model ready' : 'Camera preview'}
        </div>
      </section>

      <div className="toast-stack" aria-live="polite">
        {statusVisible && (
          <section className="status-panel">
            <strong>{status}</strong>
            {error && <span>{error}</span>}
          </section>
        )}

        {emergencyPending && (
          <section className="confirmation-banner">
            <strong>Confirm emergency request</strong>
            <span>Look at Emergency again or touch it to confirm.</span>
          </section>
        )}

        {selectedAction && selectedNoticeVisible && (
          <section className="selected-banner">
            Selected: <strong>{getAction(selectedAction).label}</strong>
          </section>
        )}
      </div>

      <section ref={boardRef} className="board-section">
        <div className="section-heading">
          <h2>Common needs</h2>
          <span>Look or touch a choice</span>
        </div>
        <div className={`action-grid ${activeTarget ? 'has-gaze-target' : ''}`}>
          {COMMUNICATION_ACTIONS.map(action => (
            <button
              key={action.id}
              type="button"
              data-action-id={action.id}
              aria-pressed={selectedAction === action.id}
              className={`action-card ${action.tone} ${activeTarget === action.id ? 'gaze-active' : ''} ${selectedAction === action.id ? 'selected' : ''}`}
              onClick={() => handleTouchSelection(action)}>
              <span className="action-label">{action.label}</span>
              <span className="action-description">{action.description}</span>
              {selectedAction === action.id && <span className="selected-marker">Chosen</span>}
              {activeTarget === action.id && <span className="dwell-progress" style={{ width: `${dwellProgress * 100}%` }} />}
            </button>
          ))}
        </div>
      </section>

      <button type="button" className="tracking-button" onClick={tracking ? stopTracking : startTracking}>
        {tracking ? 'Stop eye tracking' : 'Start eye tracking'}
      </button>
      {tracking && (
        <button type="button" className="calibration-button" onClick={startCalibration} disabled={calibrating}>
          {calibrating ? `Calibrating ${calibrationIndex + 1}/${CALIBRATION_TARGETS.length}` : calibrationReady ? 'Recalibrate gaze' : 'Calibrate gaze'}
        </button>
      )}
      <p className="footer-note">Assistive communication prototype. Touch remains available at all times.</p>
    </main>
  );
}

function getAction(actionId: ActionId) {
  return COMMUNICATION_ACTIONS.find(action => action.id === actionId)!;
}
