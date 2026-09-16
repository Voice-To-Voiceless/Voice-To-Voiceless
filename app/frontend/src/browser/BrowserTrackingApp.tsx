import React, { useEffect, useRef, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import Header from '../components/layout/Header';
import { CameraPanel } from '../components/camera/CameraPanel';
import CameraPreview from '../components/camera/CameraPreview';
import CameraOverlay from '../components/camera/CameraOverlay';
import CommunicationBoard from '../components/communication/CommunicationBoard';
import { ActionId, COMMUNICATION_ACTIONS } from '../types/communication';
import { createModelTestingSession } from '../modelTesting/modelTestingSession';
import { useBrowserTracking } from './hooks/useBrowserTracking';
import { useFaceRecognition } from './hooks/useFaceRecognition';
import { useSelectionFeedback } from './hooks/useSelectionFeedback';
import { CalibrationTarget } from './components/CalibrationTarget';

const ALERT_DURATION_MS = 3000;

type BrowserTrackingAppProps = {
  enableDiagnostics?: boolean;
};

export function BrowserTrackingApp({ enableDiagnostics = true }: BrowserTrackingAppProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [modelTestingSession] = useState(() => createModelTestingSession({ enableDiagnostics }));
  const [statusVisible, setStatusVisible] = useState(true);
  const [selectedNoticeVisible, setSelectedNoticeVisible] = useState(false);
  const selection = useSelectionFeedback();
  const tracking = useBrowserTracking(videoRef, boardRef, selection.selectAction, modelTestingSession);
  const recognition = useFaceRecognition(videoRef);
  const trackingActive = tracking.snapshot.active;
  const recognitionActive = recognition.snapshot.active;

  useEffect(() => {
    setStatusVisible(true);
    const timer = window.setTimeout(() => setStatusVisible(false), ALERT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [tracking.status, tracking.error, recognition.error]);

  useEffect(() => {
    setSelectedNoticeVisible(selection.selectedAction !== null);
    if (selection.selectedAction === null) return undefined;
    const timer = window.setTimeout(() => setSelectedNoticeVisible(false), ALERT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [selection.selectedAction]);

  const status = trackingActive
    ? tracking.status
    : recognitionActive
      ? 'Face recognition is live.'
      : 'Camera is off. Start tracking to begin.';
  const faceDetected = recognitionActive
    ? recognition.snapshot.state !== 'no_face'
    : tracking.snapshot.gazePoint !== null;

  const startTracking = () => {
    if (!recognitionActive) tracking.start().catch(() => undefined);
  };

  const toggleRecognition = () => {
    if (trackingActive) return;
    if (recognitionActive) recognition.stop();
    else recognition.start().catch(() => undefined);
  };

  return (
    <AppLayout videoRef={videoRef} boardRef={boardRef}>
      <CalibrationTarget
        gazePoint={tracking.snapshot.gazePoint}
        target={tracking.snapshot.calibrating ? tracking.snapshot.calibrationTarget : null}
        progress={tracking.snapshot.calibrationProgress}
      />
      <Header />
      <CameraPanel isLive={trackingActive || recognitionActive} fps={60}>
        <CameraPreview>
          <video ref={videoRef} className="camera-preview" autoPlay muted playsInline />
        </CameraPreview>
        <CameraOverlay
          isLive={trackingActive || recognitionActive}
          fps={60}
          faceDetected={faceDetected}
          trackingActive={trackingActive}
          calibrationComplete={tracking.snapshot.calibrationReady}
          faceRecognitionActive={recognitionActive}
          faceState={recognition.snapshot.state}
          faceRisk={recognition.snapshot.risk}
          faceExpression={recognition.snapshot.expression}
          faceIndicators={recognition.snapshot.indicators}
        />
      </CameraPanel>

      <div className="toast-stack" aria-live="polite">
        {statusVisible && <section className="status-panel"><strong>{status}</strong>{(tracking.error ?? recognition.error) && <span>{tracking.error ?? recognition.error}</span>}</section>}
        {selection.emergencyPending && <section className="confirmation-banner"><strong>Confirm emergency request</strong><span>Look at Emergency again or touch it to confirm.</span></section>}
        {selection.selectedAction && selectedNoticeVisible && <section className="selected-banner">Selected: <strong>{getActionLabel(selection.selectedAction)}</strong></section>}
      </div>

      <CommunicationBoard
        actions={COMMUNICATION_ACTIONS}
        boardRef={boardRef}
        activeTarget={tracking.snapshot.activeTarget}
        selectedAction={selection.selectedAction}
        dwellProgress={tracking.snapshot.dwellProgress}
        onActionSelect={action => selection.selectAction(action.id)}
      />

      <button type="button" className="tracking-button" onClick={trackingActive ? tracking.stop : startTracking} disabled={recognitionActive}>
        {trackingActive ? 'Stop eye tracking' : 'Start eye tracking'}
      </button>
      <button type="button" className="face-recognition-button" onClick={toggleRecognition} disabled={trackingActive}>
        {recognitionActive ? 'Stop face recognition' : 'Test face recognition'}
      </button>
      {trackingActive && <button type="button" className="calibration-button" onClick={tracking.calibrate} disabled={tracking.snapshot.calibrating}>
        {tracking.snapshot.calibrating ? `Calibrating ${tracking.snapshot.calibrationIndex + 1}/9` : tracking.snapshot.calibrationReady ? 'Recalibrate gaze' : 'Calibrate gaze'}
      </button>}
      <p className="footer-note">Assistive communication prototype. Touch remains available at all times.</p>
    </AppLayout>
  );
}

function getActionLabel(actionId: ActionId): string {
  return COMMUNICATION_ACTIONS.find(action => action.id === actionId)?.label ?? actionId;
}
