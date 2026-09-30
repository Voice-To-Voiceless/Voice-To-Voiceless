import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Check, ChevronRight, HeartPulse, Keyboard, Languages, Moon, ScanLine, Send, Settings, Sun, Users, X } from 'lucide-react';
import { deleteNotification, getNotifications, subscribeToNotifications, type PatientNotification } from '../services/notifications';
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

const caregiverCopy = {
  English: { menu: 'Open menu', closeMenu: 'Close menu', settings: 'Settings', preferences: 'Preferences', language: 'Language', darkMode: 'Dark mode', lightMode: 'Light mode', english: 'English', romanian: 'Romanian', goodMorning: 'Good morning', patientDashboard: 'Patient dashboard', synced: 'Synced now', scanNewPatient: 'Scan new patient', scanDescription: 'Scan the QR code on the tablet', myPatients: 'MY PATIENTS', active: 'active', notifications: 'Notifications', unread: 'Unread', clearAll: 'Clear all', noNotifications: 'No notifications for this patient.', all: 'All', emergencies: 'Emergency', markRead: 'Mark notification as read', toTablet: 'TO TABLET', sendReminder: 'Send a reminder', reminderDescription: 'The message will appear immediately on', sendToTablet: 'Send to tablet', sending: 'Sending...', online: 'Online', needsAttention: 'Needs attention', offline: 'Offline', settingsHint: 'Change the language and appearance.', patients: 'Patients', dashboard: 'Dashboard' },
  Romanian: { menu: 'Deschide meniul', closeMenu: 'Inchide meniul', settings: 'Setari', preferences: 'Preferinte', language: 'Limba', darkMode: 'Mod intunecat', lightMode: 'Mod luminos', english: 'Engleza', romanian: 'Romana', goodMorning: 'Buna dimineata', patientDashboard: 'Panoul pacientilor', synced: 'Sincronizat acum', scanNewPatient: 'Scaneaza pacient nou', scanDescription: 'Citeste codul QR de pe tableta', myPatients: 'PACIENTII MEI', active: 'activi', notifications: 'Notificari', unread: 'necitite', clearAll: 'Sterge toate', noNotifications: 'Nu exista notificari pentru acest pacient.', all: 'Toate', emergencies: 'Urgente', markRead: 'Marcheaza notificarea ca citita', toTablet: 'CATRE TABLETA', sendReminder: 'Trimite un reminder', reminderDescription: 'Mesajul va aparea imediat pe tableta lui', sendToTablet: 'Trimite catre tableta', sending: 'Se trimite...', online: 'Online', needsAttention: 'Necesita atentie', offline: 'Offline', settingsHint: 'Schimba limba si aspectul aplicatiei.', patients: 'Pacienti', dashboard: 'Panou' },
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
    // Start with defaults when stored settings are malformed.
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
  const visibleNotifications = notifications.filter(notification => filter === 'all' || (filter === 'unread' && !notification.read) || (filter === 'emergency' && notification.severity === 'critical'));
  const unreadCount = notifications.filter(notification => !notification.read).length;
  const emergencyCount = notifications.filter(notification => notification.severity === 'critical').length;

  return <section className="phone-notifications-screen" aria-label={copy.notifications}>
    <header className="phone-notifications-header"><div><Bell size={23} /><h2>{copy.notifications}</h2></div></header>
    <div className="phone-notification-filters" role="tablist"><button type="button" className={filter === 'all' ? 'is-selected' : ''} onClick={() => setFilter('all')}>{copy.all}</button><button type="button" className={filter === 'unread' ? 'is-selected' : ''} onClick={() => setFilter('unread')}>{copy.unread}<span>{unreadCount}</span></button><button type="button" className={`phone-filter-emergency${filter === 'emergency' ? ' is-selected' : ''}`} onClick={() => setFilter('emergency')}>{copy.emergencies}<span>{emergencyCount}</span></button>{notifications.length > 0 && <button type="button" className="phone-clear-notifications" onClick={onClearAll}>{copy.clearAll}</button>}</div>
    <div className="phone-notification-list">{visibleNotifications.length === 0 ? <div className="caregiver-empty">{copy.noNotifications}</div> : visibleNotifications.map(notification => { const patient = patients.find(item => item.id === notification.patient_metadata.patient_id); const patientName = patient?.name || notification.patient_metadata.name || 'Patient'; const patientRoom = patient?.room || notification.patient_metadata.room || 'Room'; return <button type="button" key={notification.id} className={`phone-notification-card phone-notification-card--${notification.severity}${notification.read ? '' : ' is-unread'}`} onClick={() => onRead(notification)} aria-label={copy.markRead}><span className="phone-notification-card__icon"><Bell size={19} /></span><span className="phone-notification-card__body"><strong>{notification.message}</strong><small>{patientName} · {localizeRoom(patientRoom, language)}</small><span>{formatNotificationTime(notification.created_at)}</span></span>{!notification.read && <span className="phone-notification-card__dot" />}</button>; })}</div>
  </section>;
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
  const [activeScreen, setActiveScreen] = useState<'dashboard' | 'notifications'>('dashboard');
  const selectedPatient = patients.find(patient => patient.id === selectedPatientId) ?? patients[0];

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
      .filter(item => item.patient_metadata.patient_id === selectedPatient.id)
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

  useEffect(() => {
    let active = true;
    const loadNotifications = () => {
      getNotifications('nurse')
        .then(items => {
          if (!active) return;
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
      setNotifications(current => current.some(item => item.id === notification.id) ? current : [notification, ...current]);
    });

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      socket?.close();
    };
  }, [patients]);

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
      setFeedback('Reminderul nu a putut fi trimis. Verifica serverul.');
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
      <section className="caregiver-welcome"><div><h2>{copy.patientDashboard}</h2></div></section>
      {feedback && <div className="caregiver-feedback caregiver-feedback--banner" role="status"><Check size={16} /> {feedback}</div>}

      <button type="button" className="patient-code-button" onClick={() => setShowCodeScanner(true)}><span className="patient-code-button__icon"><ScanLine size={21} /></span><span><strong>{copy.scanNewPatient}</strong><small>{copy.scanDescription}</small></span><ChevronRight size={18} /></button>

      <section className="caregiver-patient-list" aria-label="Pacienti">
        <div className="caregiver-section-label"><span><Users size={15} /> {copy.myPatients}</span><strong>{patients.length} {copy.active}</strong></div>
        {patients.map(patient => <button key={patient.id} type="button" className={`patient-row${patient.id === selectedPatient.id ? ' is-selected' : ''}`} onClick={() => setSelectedPatientId(patient.id)}><span className={`patient-avatar patient-avatar--${patient.status}`}>{patient.name.split(' ').map(part => part[0]).join('')}</span><span className="patient-row__details"><strong>{patient.name}</strong><span>{localizeRoom(patient.room, language)} · {localizeLastSeen(patient.lastSeen, language)}</span></span><span className={`patient-status patient-status--${patient.status}`} /> <ChevronRight size={17} /></button>)}
      </section>

      <section className="caregiver-panel caregiver-reminder"><div className="caregiver-panel__heading"><div><span><Send size={15} /> {copy.toTablet}</span><h2>{copy.sendReminder}</h2></div></div><p>{copy.reminderDescription} {selectedPatient.name.split(' ')[0]}.</p><select value={message} onChange={event => setMessage(event.target.value)} aria-label={copy.sendReminder}>{reminderOptionsForLanguage.map(option => <option key={option}>{option}</option>)}</select><button className="caregiver-send-button" type="button" onClick={sendReminder} disabled={sending || selectedPatient.status === 'offline'}><Send size={17} /> {sending ? copy.sending : copy.sendToTablet}</button></section>
      </>}

      <nav className="phone-bottom-nav" aria-label="Navigare principala"><button type="button" className={activeScreen === 'dashboard' ? 'is-active' : ''} onClick={() => setActiveScreen('dashboard')}><Users size={19} /><span>{copy.dashboard}</span></button><button type="button" className={activeScreen === 'notifications' ? 'is-active' : ''} onClick={() => setActiveScreen('notifications')}><Bell size={19} />{notifications.some(notification => !notification.read) && <i /> }<span>{copy.notifications}</span></button><button type="button" onClick={() => setSidebarOpen(true)}><Settings size={19} /><span>{copy.settings}</span></button></nav>
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
