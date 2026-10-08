import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Check, ChevronDown, ChevronRight, Clock3, HeartPulse, Keyboard, Languages, Moon, Search, ScanLine, Send, Settings, Sun, Users, Video, Wifi, X } from 'lucide-react';
import { deleteNotification, getNotifications, subscribeToNotifications, type PatientNotification } from '../services/notifications';
import { readLiveSignal, sendLiveSignal } from '../services/liveMonitoring';
import { getPatients, linkPatient } from '../services/patients';
import { useLanguage } from '../i18n';

type Patient = {
  id: string;
  name: string;
  room: string;
  status: 'online' | 'attention' | 'offline';
  lastSeen: string;
  note: string;
};

const fallbackPatients: Patient[] = [
  { id: 'patient-001', name: 'Maria Popescu', room: 'Camera 204', status: 'online', lastSeen: 'Acum 2 min', note: 'Raspunde prin placa de comunicare.' },
  { id: 'patient-002', name: 'Ion Stan', room: 'Camera 117', status: 'attention', lastSeen: 'Acum 8 min', note: 'A solicitat ajutor pentru medicatie.' },
  { id: 'patient-003', name: 'Elena Ionescu', room: 'Camera 302', status: 'offline', lastSeen: 'Acum 24 min', note: 'Tableta nu este conectata momentan.' },
];

const reminderOptions = ['Este timpul pentru medicatie.', 'Ai nevoie de ajutor?', 'Asistenta vine in curand.', 'Te rog raspunde cand vezi mesajul.'];
const localizedReminderOptions = {
  English: ['It is time for medication.', 'Do you need help?', 'The nurse will be here soon.', 'Please respond when you see this.'],
  Romanian: reminderOptions,
} as const;
const SETTINGS_STORAGE_KEY = 'voice-to-voiceless-settings';
const PHONE_THEME_STORAGE_KEY = 'voice-to-voiceless-phone-theme';

function isMonitoringStatusNotification(notification: PatientNotification): boolean {
  return notification.type === 'monitoring_started' || notification.type === 'monitoring_stopped';
}

function isLiveStreamSignalNotification(notification: PatientNotification): boolean {
  return notification.type.startsWith('live_stream_');
}

function isAttentionNotification(notification: PatientNotification): boolean {
  return notification.source === 'patient' && notification.type === 'patient_action' && notification.severity === 'critical' && !notification.read;
}

const caregiverCopy = {
  English: { menu: 'Open menu', closeMenu: 'Close menu', settings: 'Settings', preferences: 'Preferences', language: 'Language', darkMode: 'Dark mode', lightMode: 'Light mode', english: 'English', romanian: 'Romanian', goodMorning: 'Good morning', patientDashboard: 'Patient dashboard', synced: 'Synced now', scanNewPatient: 'Scan new patient', scanDescription: 'Scan the QR code on the tablet', myPatients: 'MY PATIENTS', active: 'active', notifications: 'Notifications', unread: 'Unread', clearAll: 'Clear all', noNotifications: 'No notifications for this patient.', all: 'All', emergencies: 'Emergency', markRead: 'Mark notification as read', toTablet: 'TO TABLET', sendReminder: 'Send a reminder', reminderDescription: 'The message will appear immediately on', sendToTablet: 'Send to tablet', sending: 'Sending...', online: 'Online', needsAttention: 'Needs attention', offline: 'Offline', monitoringLive: 'Live monitoring active', monitoringOffline: 'Live monitoring offline', settingsHint: 'Change the language and appearance.', patients: 'Patients', dashboard: 'Dashboard', searchPatients: 'Search patients', overview: 'TODAY AT A GLANCE', connected: 'Connected', attention: 'Attention' },
  Romanian: { menu: 'Deschide meniul', closeMenu: 'Inchide meniul', settings: 'Setari', preferences: 'Preferinte', language: 'Limba', darkMode: 'Mod intunecat', lightMode: 'Mod luminos', english: 'Engleza', romanian: 'Romana', goodMorning: 'Buna dimineata', patientDashboard: 'Panoul pacientilor', synced: 'Sincronizat acum', scanNewPatient: 'Scaneaza pacient nou', scanDescription: 'Citeste codul QR de pe tableta', myPatients: 'PACIENTII MEI', active: 'activi', notifications: 'Notificari', unread: 'necitite', clearAll: 'Sterge toate', noNotifications: 'Nu exista notificari pentru acest pacient.', all: 'Toate', emergencies: 'Urgente', markRead: 'Marcheaza notificarea ca citita', toTablet: 'CATRE TABLETA', sendReminder: 'Trimite un reminder', reminderDescription: 'Mesajul va aparea imediat pe tableta lui', sendToTablet: 'Trimite catre tableta', sending: 'Se trimite...', online: 'Online', needsAttention: 'Necesita atentie', offline: 'Offline', monitoringLive: 'Monitorizare live activa', monitoringOffline: 'Monitorizare live oprita', settingsHint: 'Schimba limba si aspectul aplicatiei.', patients: 'Pacienti', dashboard: 'Panou', searchPatients: 'Cauta pacienti', overview: 'SITUATIA DE AZI', connected: 'Conectati', attention: 'Atentie' },
} as const;

function readPhoneSettings(): { language: 'English' | 'Romanian'; darkMode: boolean } {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}') as { language?: 'English' | 'Romanian'; darkMode?: boolean };
    const phoneTheme = localStorage.getItem(PHONE_THEME_STORAGE_KEY);
    // Use the previous shared preference once when upgrading existing installations.
    const darkMode = phoneTheme === null ? saved.darkMode === true : phoneTheme === 'dark';
    return { language: saved.language === 'Romanian' ? 'Romanian' : 'English', darkMode };
  } catch {
    return { language: 'English', darkMode: false };
  }
}

function savePhoneSetting(key: 'language' | 'darkMode', value: 'English' | 'Romanian' | boolean) {
  if (key === 'darkMode') {
    localStorage.setItem(PHONE_THEME_STORAGE_KEY, value ? 'dark' : 'light');
    window.dispatchEvent(new Event('voice-to-voiceless-settings-changed'));
    return;
  }

  let sharedSettings: Record<string, unknown> = {};
  try {
    sharedSettings = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}') as Record<string, unknown>;
  } catch {
  }
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...sharedSettings, [key]: value }));
  window.dispatchEvent(new Event('voice-to-voiceless-settings-changed'));
}

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

function PatientCodeScreen({ onBack, onCodeConfirmed }: { onBack: () => void; onCodeConfirmed: (code: string) => Promise<void> }) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState('');

  const submitCode = useCallback(async (code: string) => {
    if (!code.trim()) return;
    setError('');
    try {
      await onCodeConfirmed(code);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Codul nu a putut fi folosit.');
    }
  }, [onCodeConfirmed]);

  useEffect(() => {
    if (manualMode) return;
    let active = true;
    let detectorTimer: number | undefined;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (!active) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraReady(true);
        const Detector = window.BarcodeDetector;
        if (!Detector || !videoRef.current) return;
        const detector = new Detector({ formats: ['qr_code'] });
        const detect = async () => {
          if (!active || !videoRef.current) return;
          try {
            const result = await detector.detect(videoRef.current);
            const code = result[0]?.rawValue?.trim();
            if (code) {
              setManualCode(code);
              setManualMode(true);
              submitCode(code);
              return;
            }
          } catch {
          }
          detectorTimer = window.setTimeout(detect, 350);
        };
        detectorTimer = window.setTimeout(detect, 500);
      } catch {
      }
    }

    startCamera();
    return () => {
      active = false;
      if (detectorTimer) window.clearTimeout(detectorTimer);
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };
  }, [manualMode, submitCode]);

  function updateManualCode(value: string) {
    const normalized = value.replace(/[^a-z0-9-]/gi, '').toUpperCase();
    setManualCode(normalized);
  }

  const formattedCode = manualCode;

  function confirmCode() {
    const code = manualCode.trim();
    submitCode(code);
  }

  return (
    <main className={`caregiver-app caregiver-app--scanner whatsapp-link-screen${manualMode ? ' is-manual' : ''}`}>
      <header className="whatsapp-link-header">
        <button type="button" className="scanner-close-button" onClick={onBack} aria-label={t('close')}><X size={31} strokeWidth={1.8} /></button>
        <h1>{manualMode ? t('manualCodeTitle') : t('scanQrTitle')}</h1>
        <span aria-hidden="true" />
      </header>

      {manualMode ? <section className="whatsapp-manual-content">
        <p>{t('manualCodeDescription')}</p>
        <label htmlFor="patient-code">{t('connectionCode')}</label>
        <input id="patient-code" value={formattedCode} onChange={event => updateManualCode(event.target.value)} placeholder={t('enterManualCode')} autoComplete="off" autoFocus />
        <button type="button" className="whatsapp-primary-button" onClick={confirmCode} disabled={!manualCode.trim()}>{t('confirmCode')}</button>
        {error && <p className="scanner-error" role="alert">{error}</p>}
      </section> : <>
        <section className="whatsapp-scan-copy"><p>{t('scannerDescription')}</p></section>
        <section className="qr-scanner" aria-label={t('scanQrTitle')}>
          <video ref={videoRef} className="qr-scanner__video" muted playsInline aria-label={t('camera')} />
          {!cameraReady && <div className="qr-scanner__placeholder"><ScanLine size={27} /><span>{t('preparingCamera')}</span></div>}
          <div className="qr-scanner__frame" aria-hidden="true"><i /><i /><i /><i /><span /></div>
        </section>
        <button type="button" className="whatsapp-manual-link" onClick={() => setManualMode(true)}><Keyboard size={18} /> {t('enterManualCode')}</button>
      </>}
    </main>
  );
}

function NotificationsScreen({ notifications, patients, copy, language, onRead, onClearAll }: { notifications: PatientNotification[]; patients: Patient[]; copy: Record<string, string>; language: 'English' | 'Romanian'; onRead: (notification: PatientNotification) => void; onClearAll: () => void }) {
  const [filter, setFilter] = useState<'all' | 'unread' | 'emergency'>('all');
  const userNotifications = notifications.filter(notification => !isMonitoringStatusNotification(notification) && !isLiveStreamSignalNotification(notification));
  const visibleNotifications = userNotifications.filter(notification => filter === 'all' || (filter === 'unread' && !notification.read) || (filter === 'emergency' && notification.severity === 'critical'));
  const unreadCount = userNotifications.filter(notification => !notification.read).length;
  const emergencyCount = userNotifications.filter(notification => notification.severity === 'critical').length;

  return <section className="phone-notifications-screen" aria-label={copy.notifications}>
    <header className="phone-notifications-header"><div><Bell size={23} /><h2>{copy.notifications}</h2></div></header>
    <div className="phone-notification-filters" role="tablist"><button type="button" className={filter === 'all' ? 'is-selected' : ''} onClick={() => setFilter('all')}>{copy.all}</button><button type="button" className={filter === 'unread' ? 'is-selected' : ''} onClick={() => setFilter('unread')}>{copy.unread}<span>{unreadCount}</span></button><button type="button" className={`phone-filter-emergency${filter === 'emergency' ? ' is-selected' : ''}`} onClick={() => setFilter('emergency')}>{copy.emergencies}<span>{emergencyCount}</span></button>{userNotifications.length > 0 && <button type="button" className="phone-clear-notifications" onClick={onClearAll}>{copy.clearAll}</button>}</div>
    <div className="phone-notification-list">{visibleNotifications.length === 0 ? <div className="caregiver-empty">{copy.noNotifications}</div> : visibleNotifications.map(notification => { const patient = patients.find(item => item.id === notification.patient_metadata.patient_id); const patientName = patient?.name || notification.patient_metadata.name || 'Patient'; const patientRoom = patient?.room || notification.patient_metadata.room || 'Room'; return <button type="button" key={notification.id} className={`phone-notification-card phone-notification-card--${notification.severity}${notification.read ? '' : ' is-unread'}`} onClick={() => onRead(notification)} aria-label={copy.markRead}><span className="phone-notification-card__icon"><Bell size={19} /></span><span className="phone-notification-card__body"><strong>{notification.message}</strong><small>{patientName} · {localizeRoom(patientRoom, language)}</small><span>{formatNotificationTime(notification.created_at)}</span></span>{!notification.read && <span className="phone-notification-card__dot" />}</button>; })}</div>
  </section>;
}

function ReminderSelect({ value, options, label, onChange }: { value: string; options: readonly string[]; label: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  function chooseOption(option: string) {
    onChange(option);
    setOpen(false);
  }

  return <div className={`caregiver-select-wrap${open ? ' is-open' : ''}`} ref={selectRef}>
    <button type="button" className="caregiver-select-trigger" aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={() => setOpen(current => !current)}><span>{value}</span><ChevronDown size={16} aria-hidden="true" /></button>
    {open && <div className="caregiver-select-menu" role="listbox" aria-label={label}>{options.map(option => <button type="button" role="option" aria-selected={option === value} className={option === value ? 'is-selected' : ''} key={option} onClick={() => chooseOption(option)}><span>{option}</span>{option === value && <Check size={15} aria-hidden="true" />}</button>)}</div>}
  </div>;
}

export function PhoneTrackingApp() {
  const { language } = useLanguage();
  const copy = caregiverCopy[language];
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => readPhoneSettings().darkMode);
  const [showCodeScanner, setShowCodeScanner] = useState(false);
  const [patients, setPatients] = useState<Patient[]>(fallbackPatients);
  const [selectedPatientId, setSelectedPatientId] = useState(fallbackPatients[0]?.id ?? '');
  const [notifications, setNotifications] = useState<PatientNotification[]>([]);
  const [message, setMessage] = useState<string>(localizedReminderOptions.English[0]);
  const reminderOptionsForLanguage = localizedReminderOptions[language];
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [patientQuery, setPatientQuery] = useState('');
  const [activeScreen, setActiveScreen] = useState<'dashboard' | 'notifications'>('dashboard');
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const livePeerRef = useRef<RTCPeerConnection | null>(null);
  const liveRequestIdRef = useRef<string | null>(null);
  const [liveViewerOpen, setLiveViewerOpen] = useState(false);
  const [liveViewerConnecting, setLiveViewerConnecting] = useState(false);
  const selectedPatient = patients.find(patient => patient.id === selectedPatientId) ?? patients[0];
  const filteredPatients = patients.filter(patient => patient.name.toLowerCase().includes(patientQuery.toLowerCase()) || patient.room.toLowerCase().includes(patientQuery.toLowerCase()));
  const connectedPatients = patients.filter(patient => patient.status === 'online').length;
  const attentionPatientIds = new Set(notifications.filter(isAttentionNotification).map(notification => notification.patient_metadata.patient_id));
  const attentionPatients = attentionPatientIds.size;
  const monitoringStatusByPatient = useMemo(() => {
    const latestStatus = new Map<string, 'monitoring_started' | 'monitoring_stopped'>();
    [...notifications]
      .filter(notification => notification.type === 'monitoring_started' || notification.type === 'monitoring_stopped')
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .forEach(notification => {
        const status = notification.type === 'monitoring_started' ? 'monitoring_started' : 'monitoring_stopped';
        if (!latestStatus.has(notification.patient_metadata.patient_id)) {
          latestStatus.set(notification.patient_metadata.patient_id, status);
        }
      });
    return latestStatus;
  }, [notifications]);
  const selectedMonitoringLive = monitoringStatusByPatient.get(selectedPatient.id) === 'monitoring_started';

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(''), 3000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    setMessage(localizedReminderOptions[language][0]);
  }, [language]);
  const patientNotifications = useMemo(
    () => notifications
      .filter(item => item.patient_metadata.patient_id === selectedPatient.id && !isMonitoringStatusNotification(item) && !isLiveStreamSignalNotification(item))
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()),
    [notifications, selectedPatient.id],
  );

  useEffect(() => {
    let active = true;
    getPatients()
      .then(records => {
        if (!active) return;
        const loadedPatients: Patient[] = records.map((record, index) => ({
          id: record.id,
          name: record.name,
          room: record.room || 'Camera nealocata',
          status: index === 0 ? 'online' : 'offline',
          lastSeen: 'Acum',
          note: record.details || 'Nu exista detalii pentru acest pacient.',
        }));
        setPatients(loadedPatients);
        setSelectedPatientId(current => loadedPatients.some(patient => patient.id === current) ? current : loadedPatients[0]?.id ?? '');
      })
      .catch(() => setFeedback('Pacientii nu au putut fi incarcati din baza de date.'));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (patients.length === 0) return;
    setNotifications(current => current.map(notification => {
      const patient = patients.find(item => item.id === notification.patient_metadata.patient_id);
      return patient ? { ...notification, patient_metadata: { ...notification.patient_metadata, name: patient.name, room: patient.room } } : notification;
    }));
  }, [patients]);

  useEffect(() => {
    const updateSettings = () => {
      const settings = readPhoneSettings();
      setDarkMode(settings.darkMode);
      document.documentElement.dataset.theme = settings.darkMode ? 'dark' : 'light';
    };
    updateSettings();
    window.addEventListener('voice-to-voiceless-settings-changed', updateSettings);
    return () => window.removeEventListener('voice-to-voiceless-settings-changed', updateSettings);
  }, []);

  function toggleDarkMode() {
    savePhoneSetting('darkMode', !darkMode);
  }

  const handleLiveSignal = useCallback((notification: PatientNotification): boolean => {
    const signal = readLiveSignal(notification);
    if (!signal) return false;
    if (signal.type === 'live_stream_offer' && signal.payload && signal.requestId === liveRequestIdRef.current && !livePeerRef.current) {
      const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      livePeerRef.current = peer;
      peer.ontrack = event => {
        if (liveVideoRef.current) liveVideoRef.current.srcObject = event.streams[0];
        setLiveViewerConnecting(false);
      };
      peer.onicecandidate = event => {
        if (event.candidate) {
          void sendLiveSignal({ type: 'live_stream_ice_candidate', patientId: signal.patientId, requestId: signal.requestId, payload: JSON.stringify(event.candidate.toJSON()) }, 'nurse');
        }
      };
      void peer.setRemoteDescription(JSON.parse(signal.payload) as RTCSessionDescriptionInit)
        .then(() => peer.createAnswer())
        .then(answer => peer.setLocalDescription(answer))
        .then(() => {
          if (peer.localDescription) {
            return sendLiveSignal({ type: 'live_stream_answer', patientId: signal.patientId, requestId: signal.requestId, payload: JSON.stringify(peer.localDescription) }, 'nurse');
          }
          return undefined;
        })
        .catch(() => setLiveViewerConnecting(false));
    } else if (signal.type === 'live_stream_ice_candidate' && signal.payload && signal.requestId === liveRequestIdRef.current && livePeerRef.current) {
      void livePeerRef.current.addIceCandidate(JSON.parse(signal.payload) as RTCIceCandidateInit);
    }
    return true;
  }, []);

  useEffect(() => {
    let active = true;
    const loadNotifications = () => {
      getNotifications('nurse')
        .then(items => {
          if (!active) return;
          items.forEach(handleLiveSignal);
          setNotifications(items.map(notification => {
            const patient = patients.find(item => item.id === notification.patient_metadata.patient_id);
            return patient ? { ...notification, patient_metadata: { ...notification.patient_metadata, name: patient.name, room: patient.room } } : notification;
          }));
        })
        .catch(() => setFeedback('Notificarile nu au putut fi incarcate.'));
    };

    loadNotifications();
    const refreshTimer = window.setInterval(loadNotifications, 2000);
    const socket = subscribeToNotifications('nurse', notification => {
      if (handleLiveSignal(notification)) return;
      setNotifications(current => current.some(item => item.id === notification.id) ? current : [notification, ...current]);
    });

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      socket?.close();
    };
  }, [handleLiveSignal, patients]);

  async function openLiveViewer() {
    const requestId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}`;
    liveRequestIdRef.current = requestId;
    setLiveViewerOpen(true);
    setLiveViewerConnecting(true);
    try {
      await sendLiveSignal({ type: 'live_stream_request', patientId: selectedPatient.id, requestId }, 'nurse');
    } catch {
      setLiveViewerConnecting(false);
      setFeedback('Live monitoring nu a putut fi deschis.');
    }
  }

  function closeLiveViewer() {
    liveRequestIdRef.current = null;
    livePeerRef.current?.close();
    livePeerRef.current = null;
    if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
    setLiveViewerOpen(false);
    setLiveViewerConnecting(false);
  }

  async function sendReminder() {
    setSending(true);
    setFeedback('');
    try {
      const response = await fetch(`http://${window.location.hostname}:8000/api/v1/nurse/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          severity: 'info',
          patient_metadata: { patient_id: selectedPatient.id, name: selectedPatient.name, room: selectedPatient.room },
          nurse_metadata: { name: 'Asistenta de serviciu' },
        }),
      });
      if (!response.ok) throw new Error('send failed');
      setFeedback(`Reminder trimis catre ${selectedPatient.name}.`);
    } catch {
      setFeedback('Reminder-ul nu a putut fi trimis. Verifica serverul.');
    } finally {
      setSending(false);
    }
  }

  async function readNotification(notification: PatientNotification) {
    try {
      await deleteNotification(notification.id);
      setNotifications(current => current.filter(item => item.id !== notification.id));
    } catch {
      setFeedback('Mesajul nu a putut fi sters.');
    }
  }

  async function dismissAllNotifications() {
    const notificationIds = patientNotifications.map(notification => notification.id);
    setFeedback('');
    const results = await Promise.allSettled(notificationIds.map(notificationId => deleteNotification(notificationId)));
    const deletedIds = new Set(notificationIds.filter((_, index) => results[index].status === 'fulfilled'));
    setNotifications(current => current.filter(notification => !deletedIds.has(notification.id)));
    if (results.some(result => result.status === 'rejected')) {
      setFeedback('Unele mesaje nu au putut fi sterse.');
    }
  }

  async function handlePatientCode(code: string) {
    const linkedPatient = await linkPatient(code);
    const patient: Patient = {
      id: linkedPatient.id,
      name: linkedPatient.name,
      room: linkedPatient.room || 'Camera nealocata',
      status: 'online',
      lastSeen: 'Acum',
      note: linkedPatient.details || 'Nu exista detalii pentru acest pacient.',
    };
    const alreadyLinked = patients.some(item => item.id === patient.id);
    setPatients(current => current.some(item => item.id === patient.id) ? current : [...current, patient]);
    setSelectedPatientId(patient.id);
    setFeedback(alreadyLinked ? `${patient.name} este deja conectat.` : `Conectarea a reusit: ${patient.name} a fost adaugat la pacientii tai.`);
    setShowCodeScanner(false);
  }

  if (showCodeScanner) return <PatientCodeScreen onBack={() => setShowCodeScanner(false)} onCodeConfirmed={handlePatientCode} />;

  return (
    <main className="caregiver-app">
      <header className="caregiver-header">
        <div className="caregiver-brand"><span className="caregiver-brand__mark"><HeartPulse size={20} /></span><div><span>CARE TEAM</span><h1>VoiceToVoiceless</h1></div></div>
      </header>

      {sidebarOpen && <>
        <button type="button" className="caregiver-sidebar-backdrop" aria-label={copy.closeMenu} onClick={() => setSidebarOpen(false)} />
        <aside className="caregiver-sidebar" aria-label={copy.settings}>
          <div className="caregiver-sidebar__header"><div><span>{copy.preferences}</span><h2>{copy.settings}</h2></div><button type="button" className="caregiver-sidebar__close" onClick={() => setSidebarOpen(false)} aria-label={copy.closeMenu}><X size={19} /></button></div>
          <p className="caregiver-sidebar__hint">{copy.settingsHint}</p>
          <div className="caregiver-sidebar__section"><div className="caregiver-sidebar__label"><Languages size={17} /> {copy.language}</div><div className="caregiver-language-options"><button type="button" className={language === 'English' ? 'is-selected' : ''} onClick={() => savePhoneSetting('language', 'English')}>{copy.english}</button><button type="button" className={language === 'Romanian' ? 'is-selected' : ''} onClick={() => savePhoneSetting('language', 'Romanian')}>{copy.romanian}</button></div></div>
          <div className="caregiver-sidebar__section"><div className="caregiver-sidebar__label">{darkMode ? <Moon size={17} /> : <Sun size={17} />} {darkMode ? copy.darkMode : copy.lightMode}</div><button type="button" className={`caregiver-theme-toggle${darkMode ? ' is-on' : ''}`} onClick={toggleDarkMode} aria-pressed={darkMode}><span /></button></div>
        </aside>
      </>}

      {activeScreen === 'notifications' ? <NotificationsScreen notifications={notifications} patients={patients} copy={copy} language={language} onRead={readNotification} onClearAll={dismissAllNotifications} /> : <>
      {feedback && <div className="caregiver-feedback caregiver-feedback--banner" role="status"><Check size={16} /> {feedback}</div>}

      <button type="button" className="patient-code-button" onClick={() => setShowCodeScanner(true)}><span className="patient-code-button__icon"><ScanLine size={21} /></span><span><strong>{copy.scanNewPatient}</strong><small>{copy.scanDescription}</small></span><ChevronRight size={18} /></button>

      <section className="caregiver-quick-stats" aria-label={copy.overview}><div><span className="quick-stat-icon quick-stat-icon--teal"><Users size={16} /></span><strong>{patients.length}</strong><small>{copy.patients}</small></div><div><span className="quick-stat-icon quick-stat-icon--green"><Wifi size={16} /></span><strong>{connectedPatients}</strong><small>{copy.connected}</small></div><div><span className="quick-stat-icon quick-stat-icon--amber"><Clock3 size={16} /></span><strong>{attentionPatients}</strong><small>{copy.attention}</small></div></section>

      <section className="caregiver-patient-list" aria-label="Pacienti">
        <div className="caregiver-section-label"><span><Users size={15} /> {copy.myPatients}</span><strong>{patients.length} {copy.active}</strong></div>
        <label className="patient-search"><Search size={16} /><input value={patientQuery} onChange={event => setPatientQuery(event.target.value)} placeholder={copy.searchPatients} aria-label={copy.searchPatients} /></label>
        {filteredPatients.map(patient => { const monitoringLive = monitoringStatusByPatient.get(patient.id) === 'monitoring_started'; const hasAttention = attentionPatientIds.has(patient.id); const visualStatus = hasAttention ? 'attention' : patient.status; return <button key={patient.id} type="button" className={`patient-row${patient.id === selectedPatient.id ? ' is-selected' : ''}${hasAttention ? ' has-attention' : ''}`} onClick={() => setSelectedPatientId(patient.id)}><span className={`patient-avatar patient-avatar--${visualStatus}`}>{patient.name.split(' ').map(part => part[0]).join('')}</span><span className="patient-row__details"><strong>{patient.name}</strong><span>{localizeRoom(patient.room, language)} · {localizeLastSeen(patient.lastSeen, language)}</span></span><span className={`patient-monitoring-status patient-monitoring-status--${monitoringLive ? 'live' : 'offline'}`}>{monitoringLive ? 'LIVE' : 'OFFLINE'}</span><span className={`patient-status patient-status--${visualStatus}`} /> <ChevronRight size={17} /></button>; })}
      </section>

      <section className="caregiver-panel caregiver-monitoring-status"><div className="caregiver-panel__heading"><div><span><HeartPulse size={15} /> {copy.patientDashboard}</span><h2>{selectedPatient.name}</h2></div><span className={`patient-monitoring-status patient-monitoring-status--${selectedMonitoringLive ? 'live' : 'offline'}`}>{selectedMonitoringLive ? 'LIVE' : 'OFFLINE'}</span></div><p>{selectedMonitoringLive ? copy.monitoringLive : copy.monitoringOffline}</p>{selectedMonitoringLive && <button type="button" className="caregiver-live-button" onClick={openLiveViewer} disabled={liveViewerOpen}><Video size={17} /> Vezi camera live</button>}</section>

      <section className="caregiver-panel caregiver-reminder"><div className="caregiver-panel__heading"><div><span><Send size={15} /> {copy.toTablet}</span><h2>{copy.sendReminder}</h2></div></div><p>{copy.reminderDescription} {selectedPatient.name.split(' ')[0]}.</p><ReminderSelect value={message} options={reminderOptionsForLanguage} label={copy.sendReminder} onChange={setMessage} /><button className="caregiver-send-button" type="button" onClick={sendReminder} disabled={sending || selectedPatient.status === 'offline'}><Send size={17} /> {sending ? copy.sending : copy.sendToTablet}</button></section>
      </>}

      {liveViewerOpen && <section className="live-viewer-backdrop" role="dialog" aria-modal="true" aria-label={`Live monitoring ${selectedPatient.name}`}><div className="live-viewer"><header className="live-viewer__header"><div><span><Video size={16} /> LIVE MONITORING</span><h2>{selectedPatient.name}</h2></div><button type="button" className="live-viewer__close" onClick={closeLiveViewer} aria-label="Inchide camera live"><X size={20} /></button></header><div className="live-viewer__video-wrap"><video ref={liveVideoRef} autoPlay playsInline muted />{liveViewerConnecting && <div className="live-viewer__state">Se conecteaza la camera pacientului...</div>}</div></div></section>}

      <nav className="phone-bottom-nav" aria-label="Navigare principala"><button type="button" className={activeScreen === 'dashboard' ? 'is-active' : ''} onClick={() => setActiveScreen('dashboard')}><Users size={19} /><span>{copy.dashboard}</span></button><button type="button" className={activeScreen === 'notifications' ? 'is-active' : ''} onClick={() => setActiveScreen('notifications')}><Bell size={19} />{notifications.some(notification => !notification.read && !isMonitoringStatusNotification(notification) && !isLiveStreamSignalNotification(notification)) && <i /> }<span>{copy.notifications}</span></button><button type="button" onClick={() => setSidebarOpen(true)}><Settings size={19} /><span>{copy.settings}</span></button></nav>
    </main>
  );
}

function formatNotificationTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Acum';
  return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

function localizeRoom(value: string, language: 'English' | 'Romanian'): string {
  if (language === 'English') {
    return value.replace(/^Camera\b/, 'Room').replace(/^Room nealocata$/, 'Unassigned room');
  }
  return value.replace(/^Room\b/, 'Camera').replace(/^Unassigned room$/, 'Camera nealocata');
}

function localizeLastSeen(value: string, language: 'English' | 'Romanian'): string {
  return language === 'English' ? value.replace(/^Acum\b/, 'Now') : value.replace(/^Now\b/, 'Acum');
}
