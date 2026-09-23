import React, { useEffect, useRef, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import AccessibilityPanel, { applyStoredAccessibilitySettings } from '../components/accessibility/AccessibilityPanel';
import SettingsPanel, { applyStoredTheme, readStoredTargetIndicator, readStoredVisibleActions } from '../components/settings/SettingsPanel';
import { CameraPanel } from '../components/camera/CameraPanel';
import CameraPreview from '../components/camera/CameraPreview';
import CommunicationBoard from '../components/communication/CommunicationBoard';
import { ActionId, COMMUNICATION_ACTIONS } from '../types/communication';
import { createModelTestingSession } from '../modelTesting/modelTestingSession';
import { useBrowserTracking } from './hooks/useBrowserTracking';
import { useFaceRecognition } from './hooks/useFaceRecognition';
import { useSelectionFeedback } from './hooks/useSelectionFeedback';
import { CalibrationTarget } from './components/CalibrationTarget';
import { DebugOverlay } from './components/DebugOverlay';
import { Bell, Camera, CheckCircle2, Eye, X } from 'lucide-react';
import { createNotification, getNotifications, markNotificationRead, subscribeToNotifications, type PatientNotification } from '../services/notifications';
import { useLanguage } from '../i18n';

const TABLET_PATIENT_ID = 'patient-001';
const ALERT_DURATION_MS = 5000;

type BrowserTrackingAppProps = {
  enableDiagnostics?: boolean;
  enableDebugOverlay?: boolean;
  layout?: 'phone' | 'tablet';
};

export function BrowserTrackingApp({ enableDiagnostics = true, enableDebugOverlay = false, layout = 'tablet' }: BrowserTrackingAppProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [modelTestingSession] = useState(() => createModelTestingSession({ enableDiagnostics }));
  const [nurseAlert, setNurseAlert] = useState<PatientNotification | null>(null);
  const [showTargetIndicator, setShowTargetIndicator] = useState(readStoredTargetIndicator);
  const [visibleActionIds, setVisibleActionIds] = useState<ActionId[]>(readStoredVisibleActions);
  const [replying, setReplying] = useState(false);
  const [statusVisible, setStatusVisible] = useState(false);
  const [selectedNoticeVisible, setSelectedNoticeVisible] = useState(false);
  const [activePage, setActivePage] = useState<'Home' | 'Accessibility' | 'Settings'>('Home');
  const { t } = useLanguage();
  const actionNotificationsInFlight = useRef(new Set<ActionId>());
  const selection = useSelectionFeedback();
  const tracking = useBrowserTracking(videoRef, boardRef, selection.selectAction, modelTestingSession);
  const { calibrate } = tracking;
  const recognition = useFaceRecognition(videoRef);
  const trackingActive = tracking.snapshot.active;
  const recognitionActive = recognition.snapshot.active;
  const localizedActions = COMMUNICATION_ACTIONS.map(action => ({ ...action, label: t(action.id) }));

  useEffect(() => {
    applyStoredAccessibilitySettings();
    applyStoredTheme();
    const updateStoredSettings = () => {
      setShowTargetIndicator(readStoredTargetIndicator());
      setVisibleActionIds(readStoredVisibleActions());
    };
    window.addEventListener('voice-to-voiceless-settings-changed', updateStoredSettings);
    return () => window.removeEventListener('voice-to-voiceless-settings-changed', updateStoredSettings);
  }, []);

  useEffect(() => {
    let active = true;
    const loadNurseAlert = () => {
      getNotifications()
        .then(items => {
          if (!active) return;
          const latest = items.find(item => item.recipient === 'patient' && item.patient_metadata.patient_id === TABLET_PATIENT_ID && !item.read);
          if (latest) setNurseAlert(latest);
        })
        .catch(() => undefined);
    };

    loadNurseAlert();
    const refreshTimer = window.setInterval(loadNurseAlert, 1000);
    const socket = subscribeToNotifications('patient', notification => {
      if (notification.patient_metadata.patient_id === TABLET_PATIENT_ID && !notification.read) setNurseAlert(notification);
    });
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      socket?.close();
    };
  }, []);

  useEffect(() => {
    setStatusVisible(true);
    const timer = window.setTimeout(() => setStatusVisible(false), ALERT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [tracking.error, recognition.error]);

  useEffect(() => {
    setSelectedNoticeVisible(selection.selectedAction !== null);
    if (selection.selectedAction === null) return undefined;
    const timer = window.setTimeout(() => setSelectedNoticeVisible(false), ALERT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [selection.selectedAction]);

  useEffect(() => {
    const handleCalibrationRequest = () => {
      setActivePage('Home');
      calibrate();
    };
    window.addEventListener('request-gaze-calibration', handleCalibrationRequest);
    return () => window.removeEventListener('request-gaze-calibration', handleCalibrationRequest);
  }, [calibrate]);

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

  const replyToNurse = async (message: string) => {
    if (!nurseAlert || replying) return;
    setReplying(true);
    try {
      await createNotification({
        source: 'patient',
        type: 'patient_response',
        severity: 'info',
        message,
        patient_metadata: { patient_id: TABLET_PATIENT_ID },
        recipient: 'nurse',
      });
      await markNotificationRead(nurseAlert.id);
      setNurseAlert(null);
    } finally {
      setReplying(false);
    }
  };

  const notifyNurseOfAction = async (actionId: ActionId) => {
    const action = COMMUNICATION_ACTIONS.find(item => item.id === actionId);
    if (!action || actionNotificationsInFlight.current.has(actionId)) return;

    actionNotificationsInFlight.current.add(actionId);
    try {
      await createNotification({
        source: 'patient',
        type: 'patient_action',
        severity: actionId === 'pain' ? 'critical' : 'info',
        message: t(actionId),
        patient_metadata: { patient_id: TABLET_PATIENT_ID },
        recipient: 'nurse',
      });
    } catch {
      // Allow retry when the notification request fails.
    } finally {
      actionNotificationsInFlight.current.delete(actionId);
    }
  };

  return (
    <AppLayout className={`tracking-layout tracking-layout--${layout}`} activeSidebarItem={activePage} onSidebarNavigate={item => {
      if (item === 'Accessibility') setActivePage('Accessibility');
      if (item === 'Settings') setActivePage('Settings');
      if (item === 'Home') setActivePage('Home');
    }}>
      {activePage === 'Accessibility' ? <AccessibilityPanel /> : activePage === 'Settings' ? <SettingsPanel /> : <>
      <CalibrationTarget
        gazePoint={tracking.snapshot.gazePoint}
        target={tracking.snapshot.calibrationTarget}
        progress={tracking.snapshot.calibrationProgress}
        passKind={tracking.snapshot.calibrationPassKind}
      />
      {enableDebugOverlay && <DebugOverlay rawGaze={tracking.snapshot.rawGaze} calibratedGaze={tracking.snapshot.calibratedGaze} showTarget={showTargetIndicator} />}
      <section
        className={`calibration-modal${tracking.snapshot.calibrationTarget !== null || tracking.snapshot.calibrating || tracking.snapshot.calibrationFailed || recognitionActive ? '' : ' calibration-modal--hidden'}`}
        role="dialog"
        aria-modal="true"
        aria-label={tracking.snapshot.calibrating ? t('cameraCalibration') : t('faceRecognition')}
      >
        <div className="calibration-modal__content">
          <button
            type="button"
            className="calibration-modal__close"
            aria-label={t('closeCameraPopup')}
            title={t('close')}
            onClick={tracking.snapshot.calibrationTarget !== null || tracking.snapshot.calibrating || tracking.snapshot.calibrationFailed ? tracking.cancelCalibration : recognition.stop}
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
              <aside className="camera-status-sidebar camera-status-sidebar--details" aria-label={t('faceRecognition')}>
                <strong>{t('faceRecognition')}</strong>
                <StatusDetail label={t('state')} value={recognition.snapshot.state} />
                <StatusDetail label={t('risk')} value={recognition.snapshot.risk.toFixed(2)} />
                <StatusDetail label={t('expression')} value={recognition.snapshot.expression} />
                <StatusDetail label={t('indicators')} value={recognition.snapshot.indicators.length > 0 ? recognition.snapshot.indicators.join(', ') : t('none')} />
              </aside>
            ) : (
              <aside className="camera-status-sidebar" aria-label={t('eyeTrackingReady')}>
                <StatusItem icon={<Camera size={16} />} label={faceDetected ? t('faceDetected') : t('noFaceDetected')} active={faceDetected} />
                <StatusItem icon={<Eye size={16} />} label={trackingActive ? t('eyeTrackingActive') : t('eyeTrackingOff')} active={trackingActive} />
                <StatusItem icon={<CheckCircle2 size={16} />} label={tracking.snapshot.calibrationReady ? t('calibrationReady') : t('calibrationRequired')} active={tracking.snapshot.calibrationReady} />
              </aside>
            )}
          </div>
          <div className="calibration-modal__progress" aria-live="polite">
            {(tracking.snapshot.calibrating || tracking.snapshot.calibrationFailed) && <span>{tracking.snapshot.calibrationIndex + 1}/9</span>}
            <strong>{recognitionActive ? t('faceRecognitionLive') : tracking.status}</strong>
            {tracking.snapshot.calibrationFailed && <div className="calibration-modal__actions"><button type="button" onClick={tracking.calibrate}>{t('retry')}</button><button type="button" onClick={tracking.cancelCalibration}>{t('cancel')}</button></div>}
          </div>
        </div>
      </section>

      <CommunicationBoard
        actions={localizedActions.filter(action => visibleActionIds.includes(action.id)).slice(0, 9)}
        boardRef={boardRef}
        activeTarget={tracking.snapshot.activeTarget}
        selectedAction={selection.selectedAction}
        dwellProgress={tracking.snapshot.dwellProgress}
        onActionSelect={action => {
          selection.selectAction(action.id);
          notifyNurseOfAction(action.id);
        }}
      />

      {nurseAlert && <section className="patient-notification-popup" role="dialog" aria-modal="true" aria-labelledby="patient-notification-title">
        <div className="patient-notification-popup__icon"><Bell size={22} aria-hidden="true" /></div>
        <span className="patient-notification-popup__eyebrow">{t('messageFromNurse')}</span>
        <h2 id="patient-notification-title">{nurseAlert.message}</h2>
        <p>{t('chooseReply')}</p>
        <div className="patient-notification-popup__actions">
          <button type="button" onClick={() => replyToNurse(`${t('needHelp')}.`)} disabled={replying}>{t('needHelp')}</button>
          <button type="button" onClick={() => replyToNurse(`${t('understood')}.`)} disabled={replying}>{t('understood')}</button>
          <button type="button" onClick={() => replyToNurse(`${t('later')}.`)} disabled={replying}>{t('later')}</button>
        </div>
      </section>}

      <div className="camera-controls" aria-label={t('camera')}>
        <button type="button" className="tracking-button" onClick={trackingActive ? tracking.stop : startTracking} disabled={recognitionActive}>
          {trackingActive ? t('stopEyeTracking') : t('startEyeTracking')}
        </button>
        {!trackingActive && <button type="button" className="face-recognition-button" onClick={toggleRecognition}>
          {recognitionActive ? t('stopFaceRecognition') : t('testFaceRecognition')}
        </button>}
        {trackingActive && <button type="button" className="calibration-button" onClick={tracking.calibrate} disabled={tracking.snapshot.calibrating || tracking.snapshot.calibrationFailed}>
          {tracking.snapshot.calibrating ? `${t('calibrating')} ${tracking.snapshot.calibrationIndex + 1}/9` : tracking.snapshot.calibrationReady ? t('recalibrateGaze') : t('calibrateGaze')}
        </button>}
      </div>

      <p className="footer-note">{t('footerNote')}</p>
      </>}
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

