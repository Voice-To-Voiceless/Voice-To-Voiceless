import React, { useEffect, useRef, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import AccessibilityPanel, { applyStoredAccessibilitySettings } from '../components/accessibility/AccessibilityPanel';
import SettingsPanel, { applyStoredTheme, readStoredDebugOverlay, readStoredTargetIndicator, readStoredVisibleActions } from '../components/settings/SettingsPanel';
import CommunicationBoard from '../components/communication/CommunicationBoard';
import { ActionId, COMMUNICATION_ACTIONS } from '../types/communication';
import { createModelTestingSession } from '../modelTesting/modelTestingSession';
import { useBrowserTracking } from './hooks/useBrowserTracking';
import { useFaceRecognition } from './hooks/useFaceRecognition';
import { useSelectionFeedback } from './hooks/useSelectionFeedback';
import { CalibrationTarget } from './components/CalibrationTarget';
import { DebugOverlay } from './components/DebugOverlay';
import { createNotification, getNotifications, markNotificationRead, subscribeToNotifications, type PatientNotification } from '../services/notifications';
import { useLanguage } from '../i18n';
import { CalibrationModal, NurseAlertPopup, TrackingGuideModal } from './components/TrackingModals';

const TABLET_PATIENT_ID = 'patient-001';

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
  const [showDebugOverlay, setShowDebugOverlay] = useState(() => enableDebugOverlay && readStoredDebugOverlay());
  const [visibleActionIds, setVisibleActionIds] = useState<ActionId[]>(readStoredVisibleActions);
  const [replying, setReplying] = useState(false);
  const [showTrackingGuide, setShowTrackingGuide] = useState(false);
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
      setShowDebugOverlay(enableDebugOverlay && readStoredDebugOverlay());
      setVisibleActionIds(readStoredVisibleActions());
    };
    window.addEventListener('voice-to-voiceless-settings-changed', updateStoredSettings);
    return () => window.removeEventListener('voice-to-voiceless-settings-changed', updateStoredSettings);
  }, [enableDebugOverlay]);

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
    if (!recognitionActive) setShowTrackingGuide(true);
  };

  const beginTracking = () => {
    setShowTrackingGuide(false);
    tracking.start().catch(() => undefined);
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
      {showTrackingGuide && !trackingActive && <TrackingGuideModal t={t} onClose={() => setShowTrackingGuide(false)} onBegin={beginTracking} />}
      {activePage === 'Accessibility' ? <AccessibilityPanel /> : activePage === 'Settings' ? <SettingsPanel /> : <>
      <CalibrationTarget
        gazePoint={tracking.snapshot.gazePoint}
        target={tracking.snapshot.calibrationTarget}
        progress={tracking.snapshot.calibrationProgress}
        passKind={tracking.snapshot.calibrationPassKind}
      />
      {showDebugOverlay && <DebugOverlay rawGaze={tracking.snapshot.rawGaze} calibratedGaze={tracking.snapshot.calibratedGaze} showTarget={showTargetIndicator} />}
      <CalibrationModal tracking={tracking} recognition={recognition} videoRef={videoRef} faceDetected={faceDetected} trackingActive={trackingActive} recognitionActive={recognitionActive} t={t} />

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

      {nurseAlert && <NurseAlertPopup message={nurseAlert.message} t={t} replying={replying} onReply={replyToNurse} />}

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

