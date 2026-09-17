import React, { useEffect, useRef, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import Header from '../components/layout/Header';
import { CameraPanel } from '../components/camera/CameraPanel';
import CameraPreview from '../components/camera/CameraPreview';
import CommunicationBoard from '../components/communication/CommunicationBoard';
import { ActionId, COMMUNICATION_ACTIONS } from '../types/communication';
import { createModelTestingSession } from '../modelTesting/modelTestingSession';
import { useBrowserTracking } from './hooks/useBrowserTracking';
import { useFaceRecognition } from './hooks/useFaceRecognition';
import { useSelectionFeedback } from './hooks/useSelectionFeedback';
import { CalibrationTarget } from './components/CalibrationTarget';
import { Bell, Camera, CheckCircle2, Eye, X } from 'lucide-react';

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
    <AppLayout sidebarNotification={
      <section className="sidebar__notification" aria-live="polite">
        <div className="sidebar__notification-heading"><Bell size={14} aria-hidden="true" /> Notifications</div>
        {statusVisible ? <><strong>{status}</strong>{(tracking.error ?? recognition.error) && <span>{tracking.error ?? recognition.error}</span>}</> : selection.selectedAction && selectedNoticeVisible ? <><strong>Action selected</strong><span>{getActionLabel(selection.selectedAction)} is ready.</span></> : <span>All systems are ready.</span>}
      </section>
    }>
      <CalibrationTarget
        gazePoint={tracking.snapshot.gazePoint}
        target={tracking.snapshot.calibrating ? tracking.snapshot.calibrationTarget : null}
        progress={tracking.snapshot.calibrationProgress}
      />
      <Header trackingActive={trackingActive} recognitionActive={recognitionActive} />
      <section
        className={`calibration-modal${tracking.snapshot.calibrating || recognitionActive ? '' : ' calibration-modal--hidden'}`}
        role="dialog"
        aria-modal="true"
        aria-label={tracking.snapshot.calibrating ? 'Camera calibration' : 'Face recognition'}
      >
        <div className="calibration-modal__content">
          <button
            type="button"
            className="calibration-modal__close"
            aria-label="Close camera popup"
            title="Close"
            onClick={tracking.snapshot.calibrating ? tracking.stop : recognition.stop}
          >
            <X size={20} aria-hidden="true" />
          </button>
          <div className="calibration-modal__body">
            <div className="calibration-modal__preview">
              <CameraPanel isLive={trackingActive || recognitionActive} fps={60}>
                <CameraPreview>
                  <video ref={videoRef} className="camera-preview" autoPlay muted playsInline />
                </CameraPreview>
              </CameraPanel>
            </div>
            {recognitionActive ? (
              <aside className="camera-status-sidebar camera-status-sidebar--details" aria-label="Face recognition status">
                <strong>Face recognition</strong>
                <StatusDetail label="State" value={recognition.snapshot.state} />
                <StatusDetail label="Risk" value={recognition.snapshot.risk.toFixed(2)} />
                <StatusDetail label="Expression" value={recognition.snapshot.expression} />
                <StatusDetail label="Indicators" value={recognition.snapshot.indicators.length > 0 ? recognition.snapshot.indicators.join(', ') : 'None'} />
              </aside>
            ) : (
              <aside className="camera-status-sidebar" aria-label="Eye tracking status">
                <StatusItem icon={<Camera size={16} />} label={faceDetected ? 'Face detected' : 'No face detected'} active={faceDetected} />
                <StatusItem icon={<Eye size={16} />} label={trackingActive ? 'Eye tracking active' : 'Eye tracking off'} active={trackingActive} />
                <StatusItem icon={<CheckCircle2 size={16} />} label={tracking.snapshot.calibrationReady ? 'Calibration ready' : 'Calibration required'} active={tracking.snapshot.calibrationReady} />
              </aside>
            )}
          </div>
          <div className="calibration-modal__progress" aria-live="polite">
            {tracking.snapshot.calibrating && <span>{tracking.snapshot.calibrationIndex + 1}/9</span>}
            <strong>{recognitionActive ? 'Face recognition is live.' : tracking.status}</strong>
          </div>
        </div>
      </section>

      <CommunicationBoard
        actions={COMMUNICATION_ACTIONS}
        boardRef={boardRef}
        activeTarget={tracking.snapshot.activeTarget}
        selectedAction={selection.selectedAction}
        dwellProgress={tracking.snapshot.dwellProgress}
        onActionSelect={action => selection.selectAction(action.id)}
      />

      <div className="camera-controls" aria-label="Camera controls">
        <button type="button" className="tracking-button" onClick={trackingActive ? tracking.stop : startTracking} disabled={recognitionActive}>
          {trackingActive ? 'Stop eye tracking' : 'Start eye tracking'}
        </button>
        <button type="button" className="face-recognition-button" onClick={toggleRecognition} disabled={trackingActive}>
          {recognitionActive ? 'Stop face recognition' : 'Test face recognition'}
        </button>
        {trackingActive && <button type="button" className="calibration-button" onClick={tracking.calibrate} disabled={tracking.snapshot.calibrating}>
          {tracking.snapshot.calibrating ? `Calibrating ${tracking.snapshot.calibrationIndex + 1}/9` : tracking.snapshot.calibrationReady ? 'Recalibrate gaze' : 'Calibrate gaze'}
        </button>}
      </div>

      <p className="footer-note">Assistive communication prototype. Touch remains available at all times.</p>
    </AppLayout>
  );
}

type StatusItemProps = {
  icon: React.ReactNode;
  label: string;
  active: boolean;
};

function StatusItem({ icon, label, active }: StatusItemProps) {
  return (
    <div className={`camera-status-sidebar__item${active ? ' camera-status-sidebar__item--active' : ''}`}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

function StatusDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="camera-status-sidebar__detail">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getActionLabel(actionId: ActionId): string {
  return COMMUNICATION_ACTIONS.find(action => action.id === actionId)?.label ?? actionId;
}
