import React, { useEffect, useRef, useState } from 'react';
import { Activity, Eye } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { applyStoredAccessibilitySettings } from '../components/accessibility/AccessibilityPanel';
import SettingsPanel, { applyStoredTheme, readStoredDebugOverlay, readStoredVisibleActions } from '../components/settings/SettingsPanel';
import CommunicationBoard from '../components/communication/CommunicationBoard';
import { ActionId, COMMUNICATION_ACTIONS } from '../types/communication';
import { createModelTestingSession } from '../modelTesting/modelTestingSession';
import { useBrowserTracking } from './hooks/useBrowserTracking';
import { useFaceRecognition } from './hooks/useFaceRecognition';
import { useSelectionFeedback } from './hooks/useSelectionFeedback';
import { CalibrationTarget } from './components/CalibrationTarget';
import { DebugOverlay } from './components/DebugOverlay';
import { createNotification, getNotifications, markNotificationRead, subscribeToNotifications, type PatientNotification } from '../services/notifications';
import { isLiveSignalNotification, readLiveSignal, sendLiveSignal } from '../services/liveMonitoring';
import { useLanguage } from '../i18n';
import { CalibrationModal, ConfidencePopup, NurseAlertPopup, TrackingGuideModal } from './components/TrackingModals';

const TABLET_PATIENT_ID = 'patient-001';
const ATTENTION_NOTIFICATION_DELAY_MS = 3500;
const CONFIDENCE_POPUP_DURATION_MS = 1000;

function publishMonitoringStatus(active: boolean): void {
  createNotification({
    source: 'patient',
    type: active ? 'monitoring_started' : 'monitoring_stopped',
    severity: active ? 'info' : 'warning',
    message: active ? 'Live monitoring is active.' : 'Live monitoring was stopped.',
    patient_metadata: { patient_id: TABLET_PATIENT_ID },
    recipient: 'nurse',
  }).catch(() => undefined);
}

type BrowserTrackingAppProps = {
  enableDiagnostics?: boolean;
  enableDebugOverlay?: boolean;
  layout?: 'phone' | 'tablet';
};

export function BrowserTrackingApp({ enableDiagnostics = true, enableDebugOverlay = false, layout = 'tablet' }: BrowserTrackingAppProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const gazeSurfaceRef = useRef<HTMLDivElement>(null);
  const [modelTestingSession] = useState(() => createModelTestingSession({ enableDiagnostics }));
  const [nurseAlert, setNurseAlert] = useState<PatientNotification | null>(null);
  const [showDebugOverlay, setShowDebugOverlay] = useState(() => enableDebugOverlay && readStoredDebugOverlay());
  const [visibleActionIds, setVisibleActionIds] = useState<ActionId[]>(readStoredVisibleActions);
  const [replying, setReplying] = useState(false);
  const [attentionElapsedMs, setAttentionElapsedMs] = useState(0);
  const [attentionNotificationSent, setAttentionNotificationSent] = useState(false);
  const [showTrackingGuide, setShowTrackingGuide] = useState(false);
  const [showConfidencePopup, setShowConfidencePopup] = useState(false);
  const [activePage, setActivePage] = useState<'Home' | 'Settings'>('Home');
  const { t } = useLanguage();
  const actionNotificationsInFlight = useRef(new Set<ActionId>());
  const attentionStartedAtRef = useRef<number | null>(null);
  const attentionNotificationSentRef = useRef(false);
  const livePeerRef = useRef<RTCPeerConnection | null>(null);
  const recognitionStreamRef = useRef<MediaStream | null>(null);
  const selection = useSelectionFeedback();
  const tracking = useBrowserTracking(videoRef, gazeSurfaceRef, targetId => {
    if (targetId.startsWith('nurse-reply:')) {
      const reply = decodeURIComponent(targetId.slice('nurse-reply:'.length));
      void replyToNurse(reply);
      return;
    }
    const action = COMMUNICATION_ACTIONS.find(item => item.id === targetId);
    if (action) {
      handleActionSelect(action.id);
    }
  }, modelTestingSession);
  const { calibrate } = tracking;
  const recognition = useFaceRecognition(videoRef);
  const trackingActive = tracking.snapshot.active;
  const recognitionActive = recognition.snapshot.active;
  useEffect(() => {
    recognitionStreamRef.current = recognition.stream;
  }, [recognition.stream]);
  const localizedActions = COMMUNICATION_ACTIONS.map(action => ({ ...action, label: t(action.id) }));

  useEffect(() => {
    if (tracking.snapshot.calibrationConfidence === null) return;
    setShowConfidencePopup(true);
    const timeout = window.setTimeout(() => setShowConfidencePopup(false), CONFIDENCE_POPUP_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [tracking.snapshot.calibrationConfidence]);

  useEffect(() => {
    if (recognition.snapshot.state !== 'attention_required') {
      attentionStartedAtRef.current = null;
      attentionNotificationSentRef.current = false;
      setAttentionElapsedMs(0);
      setAttentionNotificationSent(false);
      return;
    }

    attentionStartedAtRef.current ??= Date.now();
    const elapsed = Date.now() - attentionStartedAtRef.current;
    setAttentionElapsedMs(elapsed);
    const remaining = Math.max(0, ATTENTION_NOTIFICATION_DELAY_MS - elapsed);
    const progressTimer = window.setInterval(() => {
      if (attentionStartedAtRef.current !== null) {
        setAttentionElapsedMs(Date.now() - attentionStartedAtRef.current);
      }
    }, 100);
    const timeout = window.setTimeout(() => {
      if (attentionNotificationSentRef.current || recognition.snapshot.state !== 'attention_required') return;
      attentionNotificationSentRef.current = true;
      setAttentionNotificationSent(true);
      createNotification({
        source: 'face_recognition',
        type: 'attention_required',
        severity: 'critical',
        message: 'Attention required: the patient may need assistance.',
        patient_metadata: { patient_id: TABLET_PATIENT_ID },
        recipient: 'nurse',
      }).catch(() => {
        attentionNotificationSentRef.current = false;
        setAttentionNotificationSent(false);
      });
    }, remaining);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(progressTimer);
    };
  }, [recognition.snapshot.state]);

  useEffect(() => {
    applyStoredAccessibilitySettings();
    applyStoredTheme();
    const updateStoredSettings = () => {
      setShowDebugOverlay(enableDebugOverlay && readStoredDebugOverlay());
      setVisibleActionIds(readStoredVisibleActions());
    };
    window.addEventListener('voice-to-voiceless-settings-changed', updateStoredSettings);
    return () => window.removeEventListener('voice-to-voiceless-settings-changed', updateStoredSettings);
  }, [enableDebugOverlay]);

  useEffect(() => {
    let active = true;
    const loadNurseAlert = () => {
      getNotifications('patient')
        .then(items => {
          if (!active) return;
          const latest = items.find(item => item.recipient === 'patient' && item.patient_metadata.patient_id === TABLET_PATIENT_ID && !item.read && !isLiveSignalNotification(item));
          if (latest) setNurseAlert(latest);
          else setNurseAlert(current => current && readLiveSignal(current) ? null : current);
        })
        .catch(() => undefined);
    };

    loadNurseAlert();
    const refreshTimer = window.setInterval(loadNurseAlert, 1000);
    const socket = subscribeToNotifications('patient', notification => {
      const signal = readLiveSignal(notification);
      if (isLiveSignalNotification(notification) && !signal) return;
      if (signal) {
        setNurseAlert(current => current && readLiveSignal(current) ? null : current);
        if (signal.patientId !== TABLET_PATIENT_ID) return;
        if (signal.type === 'live_stream_request' && recognitionStreamRef.current) {
          const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
          livePeerRef.current = peer;
          recognitionStreamRef.current.getTracks().forEach(track => peer.addTrack(track, recognitionStreamRef.current as MediaStream));
          peer.onicecandidate = event => {
            if (event.candidate) {
              void sendLiveSignal({ type: 'live_stream_ice_candidate', patientId: TABLET_PATIENT_ID, requestId: signal.requestId, payload: JSON.stringify(event.candidate.toJSON()) }, 'patient');
            }
          };
          void peer.createOffer().then(offer => peer.setLocalDescription(offer)).then(() => {
            if (peer.localDescription) {
              return sendLiveSignal({ type: 'live_stream_offer', patientId: TABLET_PATIENT_ID, requestId: signal.requestId, payload: JSON.stringify(peer.localDescription) }, 'patient');
            }
            return undefined;
          });
        } else if (signal.type === 'live_stream_answer' && signal.payload && livePeerRef.current) {
          void livePeerRef.current.setRemoteDescription(JSON.parse(signal.payload) as RTCSessionDescriptionInit);
        } else if (signal.type === 'live_stream_ice_candidate' && signal.payload && livePeerRef.current) {
          void livePeerRef.current.addIceCandidate(JSON.parse(signal.payload) as RTCIceCandidateInit);
        }
        return;
      }
      if (notification.patient_metadata.patient_id === TABLET_PATIENT_ID && !notification.read) setNurseAlert(notification);
    });
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      socket?.close();
      livePeerRef.current?.close();
      livePeerRef.current = null;
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
    void tracking.start();
  };

  const stopTracking = () => {
    tracking.stop();
    setShowTrackingGuide(false);
  };

  const toggleRecognition = () => {
    if (trackingActive) return;
    if (recognitionActive) {
      stopRecognition();
    } else {
      recognition.start().then(() => publishMonitoringStatus(true)).catch(() => undefined);
    }
  };

  const stopRecognition = () => {
    recognition.stop();
    publishMonitoringStatus(false);
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

  async function notifyNurseOfAction(actionId: ActionId) {
    const action = COMMUNICATION_ACTIONS.find(item => item.id === actionId);
    if (!action || actionNotificationsInFlight.current.has(actionId)) return;

    actionNotificationsInFlight.current.add(actionId);
    try {
      await createNotification({
        source: 'patient',
        type: 'patient_action',
        severity: actionId === 'pain' || actionId === 'medication' ? 'critical' : 'info',
        message: t(actionId),
        patient_metadata: { patient_id: TABLET_PATIENT_ID },
        recipient: 'nurse',
      });
    } catch {
      // Allow retry when the notification request fails.
    } finally {
      actionNotificationsInFlight.current.delete(actionId);
    }
  }

  function handleActionSelect(actionId: ActionId) {
    selection.selectAction(actionId);
    void notifyNurseOfAction(actionId);
  }

  return (
    <AppLayout className={`tracking-layout tracking-layout--${layout}`} sidebarControls={activePage === 'Home' ? <>
      {!trackingActive && <button type="button" className="face-recognition-button" onClick={toggleRecognition}>
        <Activity size={22} />
        {recognitionActive ? t('stopFaceRecognition') : t('testFaceRecognition')}
      </button>}
      <button type="button" className="tracking-button" onClick={trackingActive ? stopTracking : startTracking} disabled={recognitionActive}>
        <Eye size={22} />
        {trackingActive ? t('stopEyeTracking') : t('startEyeTracking')}
      </button>
      {trackingActive && <button type="button" className="calibration-button" onClick={tracking.calibrate} disabled={tracking.snapshot.calibrating || tracking.snapshot.calibrationFailed}>
        {tracking.snapshot.calibrating ? `${t('calibrating')} ${tracking.snapshot.calibrationIndex + 1}/9` : tracking.snapshot.calibrationReady ? t('recalibrateGaze') : t('calibrateGaze')}
      </button>}
      {tracking.error && <span className="sidebar__control-error" role="alert">{tracking.error}</span>}
      {recognition.error && <span className="sidebar__control-error" role="alert">{recognition.error}</span>}
    </> : undefined} activeSidebarItem={activePage} onSidebarNavigate={item => {
      if (item === 'Settings') setActivePage('Settings');
      if (item === 'Home') setActivePage('Home');
    }}>
      {showTrackingGuide && !trackingActive && <TrackingGuideModal t={t} onClose={() => setShowTrackingGuide(false)} onBegin={beginTracking} />}
      {activePage === 'Settings' ? <SettingsPanel /> : <>
      <CalibrationTarget
        gazePoint={tracking.snapshot.gazePoint}
        target={tracking.snapshot.calibrationTarget}
        progress={tracking.snapshot.calibrationProgress}
        passKind={tracking.snapshot.calibrationPassKind}
        showTargetIndicator
      />
      {showDebugOverlay && <DebugOverlay rawGaze={tracking.snapshot.rawGaze} calibratedGaze={tracking.snapshot.calibratedGaze} showTarget />}
      <CalibrationModal
        tracking={tracking}
        recognition={recognition}
        videoRef={videoRef}
        faceDetected={faceDetected}
        trackingActive={trackingActive}
        recognitionActive={recognitionActive}
        onStopRecognition={stopRecognition}
        attentionNotificationRemainingMs={Math.max(0, ATTENTION_NOTIFICATION_DELAY_MS - attentionElapsedMs)}
        attentionNotificationSent={attentionNotificationSent}
        t={t}
      />
      {showConfidencePopup && tracking.snapshot.calibrationConfidence !== null && <ConfidencePopup score={tracking.snapshot.calibrationConfidence} t={t} onClose={() => setShowConfidencePopup(false)} />}

      <div ref={gazeSurfaceRef} className={`gaze-target-surface${nurseAlert && !isLiveSignalNotification(nurseAlert) ? ' has-nurse-alert' : ''}`}>
        <CommunicationBoard
          actions={localizedActions.filter(action => visibleActionIds.includes(action.id)).slice(0, 9)}
          activeTarget={tracking.snapshot.activeTarget}
          selectedAction={selection.selectedAction}
          dwellProgress={tracking.snapshot.dwellProgress}
          onActionSelect={action => handleActionSelect(action.id)}
        />

        {nurseAlert && !isLiveSignalNotification(nurseAlert) && <NurseAlertPopup message={nurseAlert.message} t={t} replying={replying} activeTarget={tracking.snapshot.activeTarget} dwellProgress={tracking.snapshot.dwellProgress} onReply={replyToNurse} />}
      </div>

      <p className="footer-note">{t('footerNote')}</p>
      </>}
    </AppLayout>
  );
}

