import React, { useEffect, useRef, useState } from 'react';
import { MediaPipeFaceLandmarkerAdapter } from '../vision/mediaPipeFaceLandmarker';
import { estimateGaze } from '../vision/gazeEstimator';
import { GazeSmoother } from '../vision/gazeSmoother';
import { GazeJoystickController } from '../vision/gazeJoystickController';
import { findGazeTarget } from '../vision/gazeTarget';
import { DwellSelector } from '../interaction/dwellSelector';
import { ActionDefinition, ActionId, COMMUNICATION_ACTIONS } from '../types/communication';

const DWELL_DURATION_MS = 1500;
const MODEL_PATH = '/models/face_landmarker.task';
const WASM_PATH = '/wasm';

export function BrowserTrackingApp() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const adapterRef = useRef<MediaPipeFaceLandmarkerAdapter | null>(null);
  const smootherRef = useRef(new GazeSmoother());
  const joystickRef = useRef(new GazeJoystickController({ invertX: true, invertY: true }));
  const dwellSelectorRef = useRef(new DwellSelector(DWELL_DURATION_MS));
  const animationFrameRef = useRef<number | null>(null);
  const trackingRef = useRef(false);
  const processingFrameRef = useRef(false);
  const [tracking, setTracking] = useState(false);
  const [status, setStatus] = useState('Camera is off. Start tracking to begin.');
  const [error, setError] = useState<string | null>(null);
  const [gazePoint, setGazePoint] = useState<{ x: number; y: number } | null>(null);
  const [activeTarget, setActiveTarget] = useState<ActionId | null>(null);
  const [dwellProgress, setDwellProgress] = useState(0);
  const [selectedAction, setSelectedAction] = useState<ActionId | null>(null);
  const [emergencyPending, setEmergencyPending] = useState(false);

  useEffect(() => stopTracking, []);

  async function startTracking() {
    setError(null);
    setStatus('Requesting camera permission...');

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
      setStatus('Tracking ready. Look at a communication action.');
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
    setGazePoint(null);
    setActiveTarget(null);
    setDwellProgress(0);
    setTracking(false);
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

      const smoothedGaze = smootherRef.current.update(gaze);
      const displayGaze = joystickRef.current.update(smoothedGaze);
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
      return;
    }

    setSelectedAction(actionId);
    setEmergencyPending(false);
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

      <section className="status-panel" aria-live="polite">
        <strong>{status}</strong>
        {error && <span>{error}</span>}
      </section>

      {emergencyPending && (
        <section className="confirmation-banner">
          <strong>Confirm emergency request</strong>
          <span>Look at Emergency again or touch it to confirm.</span>
        </section>
      )}

      {selectedAction && (
        <section className="selected-banner">
          Selected: <strong>{getAction(selectedAction).label}</strong>
        </section>
      )}

      <section ref={boardRef} className="board-section">
        <div className="section-heading">
          <h2>Common needs</h2>
          <span>Look or touch a choice</span>
        </div>
        <div className="action-grid">
          {COMMUNICATION_ACTIONS.map(action => (
            <button
              key={action.id}
              type="button"
              data-action-id={action.id}
              className={`action-card ${action.tone} ${activeTarget === action.id ? 'gaze-active' : ''} ${selectedAction === action.id ? 'selected' : ''}`}
              onClick={() => handleTouchSelection(action)}>
              <span className="action-label">{action.label}</span>
              <span className="action-description">{action.description}</span>
              {activeTarget === action.id && <span className="dwell-progress" style={{ width: `${dwellProgress * 100}%` }} />}
            </button>
          ))}
        </div>
      </section>

      <button type="button" className="tracking-button" onClick={tracking ? stopTracking : startTracking}>
        {tracking ? 'Stop eye tracking' : 'Start eye tracking'}
      </button>
      <p className="footer-note">Assistive communication prototype. Touch remains available at all times.</p>
    </main>
  );
}

function getAction(actionId: ActionId) {
  return COMMUNICATION_ACTIONS.find(action => action.id === actionId)!;
}