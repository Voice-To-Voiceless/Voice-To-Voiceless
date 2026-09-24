import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bell, Check, ChevronRight, Clock3, HeartPulse, Keyboard, MessageSquareText, ScanLine, Send, UserRound, Users, Wifi } from 'lucide-react';
import { deleteNotification, getNotifications, subscribeToNotifications, type PatientNotification } from '../services/notifications';

type Patient = {
  id: string;
  name: string;
  room: string;
  age: number;
  status: 'online' | 'attention' | 'offline';
  lastSeen: string;
  note: string;
};

const patients: Patient[] = [
  { id: 'patient-001', name: 'Maria Popescu', room: 'Camera 204', age: 72, status: 'online', lastSeen: 'Acum 2 min', note: 'Raspunde prin placa de comunicare.' },
  { id: 'patient-002', name: 'Ion Stan', room: 'Camera 117', age: 68, status: 'attention', lastSeen: 'Acum 8 min', note: 'A solicitat ajutor pentru medicatie.' },
  { id: 'patient-003', name: 'Elena Ionescu', room: 'Camera 302', age: 81, status: 'offline', lastSeen: 'Acum 24 min', note: 'Tableta nu este conectata momentan.' },
];

const reminderOptions = ['Este timpul pentru medicatie.', 'Ai nevoie de ajutor?', 'Asistenta vine in curand.', 'Te rog raspunde cand vezi mesajul.'];

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

function PatientCodeScreen({ onBack }: { onBack: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [scannerMessage, setScannerMessage] = useState('Aliniaza codul QR in chenar');
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    let active = true;
    let detectorTimer: number | undefined;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerMessage('Camera nu este disponibila. Introdu codul manual mai jos.');
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
              setScannerMessage('Cod detectat. Verifica-l si confirma.');
              return;
            }
          } catch {
            setScannerMessage('Nu am putut citi codul. Incearca din nou sau foloseste codul manual.');
          }
          detectorTimer = window.setTimeout(detect, 350);
        };
        detectorTimer = window.setTimeout(detect, 500);
      } catch {
        setScannerMessage('Permisiunea pentru camera nu a fost acordata. Introdu codul manual mai jos.');
      }
    }

    startCamera();
    return () => {
      active = false;
      if (detectorTimer) window.clearTimeout(detectorTimer);
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };
  }, []);

  function confirmCode() {
    const code = manualCode.trim();
    setScannerMessage(code ? `Cod pregatit: ${code}` : 'Introdu un cod valid pentru a continua.');
  }

  return (
    <main className="caregiver-app caregiver-app--scanner">
      <header className="caregiver-header">
        <button type="button" className="scanner-back-button" onClick={onBack} aria-label="Inapoi la pacienti"><ArrowLeft size={19} /></button>
        <div className="caregiver-brand"><span className="caregiver-brand__mark"><HeartPulse size={20} /></span><div><span>CARE TEAM</span><h1>VoiceToVoiceless</h1></div></div>
        <span className="scanner-header-spacer" aria-hidden="true" />
      </header>

      <section className="scanner-intro"><span>ADAUGA UN PACIENT</span><h2>Scaneaza codul pacientului</h2><p>Apropie camera de codul QR de pe tableta pacientului.</p></section>

      <section className="qr-scanner" aria-label="Scanner cod QR">
        <video ref={videoRef} className="qr-scanner__video" muted playsInline aria-label="Previzualizare camera" />
        {!cameraReady && <div className="qr-scanner__placeholder"><ScanLine size={27} /><span>Pregatim camera...</span></div>}
        <div className="qr-scanner__frame" aria-hidden="true"><i /><i /><i /><i /><span /></div>
        <div className="qr-scanner__hint"><ScanLine size={16} /> {scannerMessage}</div>
      </section>

      <div className="scanner-divider"><span>sau</span></div>

      <section className="manual-code-panel">
        <div className="manual-code-panel__heading"><Keyboard size={18} /><div><strong>Introdu codul manual</strong><span>Codul se gaseste sub codul QR.</span></div></div>
        <label htmlFor="patient-code">Cod pacient</label>
        <input id="patient-code" value={manualCode} onChange={event => setManualCode(event.target.value)} placeholder="Ex: PT-1024-5678" autoComplete="off" />
        <button type="button" className="caregiver-send-button" onClick={confirmCode} disabled={!manualCode.trim()}><Check size={17} /> Confirma codul</button>
      </section>
    </main>
  );
}

export function PhoneTrackingApp() {
  const [showCodeScanner, setShowCodeScanner] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0].id);
  const [notifications, setNotifications] = useState<PatientNotification[]>([]);
  const [message, setMessage] = useState(reminderOptions[0]);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const selectedPatient = patients.find(patient => patient.id === selectedPatientId) ?? patients[0];
  const patientNotifications = useMemo(
    () => notifications
      .filter(item => item.patient_metadata.patient_id === selectedPatient.id)
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()),
    [notifications, selectedPatient.id],
  );

  useEffect(() => {
    let active = true;
    const loadNotifications = () => {
      getNotifications()
        .then(items => {
          if (!active) return;
          setNotifications(items);
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
  }, []);

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

  if (showCodeScanner) return <PatientCodeScreen onBack={() => setShowCodeScanner(false)} />;

  return (
    <main className="caregiver-app">
      <header className="caregiver-header">
        <div className="caregiver-brand"><span className="caregiver-brand__mark"><HeartPulse size={20} /></span><div><span>CARE TEAM</span><h1>VoiceToVoiceless</h1></div></div>
        <button className="caregiver-profile" type="button" aria-label="Profil asistenta"><UserRound size={18} /><span>AS</span></button>
      </header>

      <section className="caregiver-welcome"><div><span>Buna dimineata</span><h2>Panoul pacientilor</h2></div><div className="caregiver-sync"><Wifi size={15} /> Sincronizat acum</div></section>

      <button type="button" className="patient-code-button" onClick={() => setShowCodeScanner(true)}><span className="patient-code-button__icon"><ScanLine size={21} /></span><span><strong>Scaneaza pacient nou</strong><small>Citeste codul QR de pe tableta</small></span><ChevronRight size={18} /></button>

      <section className="caregiver-patient-list" aria-label="Pacienti">
        <div className="caregiver-section-label"><span><Users size={15} /> PACIENTII MEI</span><strong>{patients.length} activi</strong></div>
        {patients.map(patient => <button key={patient.id} type="button" className={`patient-row${patient.id === selectedPatient.id ? ' is-selected' : ''}`} onClick={() => setSelectedPatientId(patient.id)}><span className={`patient-avatar patient-avatar--${patient.status}`}>{patient.name.split(' ').map(part => part[0]).join('')}</span><span className="patient-row__details"><strong>{patient.name}</strong><span>{patient.room} · {patient.lastSeen}</span></span><span className={`patient-status patient-status--${patient.status}`} /> <ChevronRight size={17} /></button>)}
      </section>

      <section className="caregiver-patient-card"><div className="caregiver-patient-card__top"><div><span>PROFIL PACIENT</span><h2>{selectedPatient.name}</h2><p>{selectedPatient.age} ani · {selectedPatient.room}</p></div><span className={`patient-badge patient-badge--${selectedPatient.status}`}>{selectedPatient.status === 'online' ? 'Online' : selectedPatient.status === 'attention' ? 'Needs attention' : 'Offline'}</span></div><div className="caregiver-metrics"><div><HeartPulse size={16} /><span>Stare</span><strong>{selectedPatient.status === 'attention' ? 'Atentie' : 'Stabil'}</strong></div><div><Clock3 size={16} /><span>Ultimul contact</span><strong>{selectedPatient.lastSeen}</strong></div><div><MessageSquareText size={16} /><span>Comunicare</span><strong>Tableta activa</strong></div></div><p className="caregiver-note">{selectedPatient.note}</p></section>

      <section className="caregiver-panel"><div className="caregiver-panel__heading"><div><span><Bell size={15} /> NOTIFICARI</span><h2>Activitate recenta</h2></div><div className="caregiver-notification-actions"><strong>{patientNotifications.filter(item => !item.read).length} necitite</strong>{patientNotifications.length > 0 && <button type="button" className="notification-clear-button" onClick={dismissAllNotifications}>Sterge toate</button>}</div></div>{patientNotifications.length === 0 ? <div className="caregiver-empty">Nu exista notificari pentru acest pacient.</div> : <div className="notification-list">{patientNotifications.map(notification => <button type="button" key={notification.id} className={`notification-row${notification.read ? '' : ' is-unread'}`} onClick={() => readNotification(notification)} aria-label={`Marcheaza mesajul ca citit: ${notification.message}`}><span className={`notification-icon notification-icon--${notification.severity}`}><Bell size={15} /></span><span><strong>{notification.message}</strong><small>{formatNotificationTime(notification.created_at)}</small></span>{!notification.read && <span className="notification-unread" />}</button>)}</div>}</section>

      <section className="caregiver-panel caregiver-reminder"><div className="caregiver-panel__heading"><div><span><Send size={15} /> CATRE TABLETA</span><h2>Trimite un reminder</h2></div></div><p>Mesajul va aparea imediat pe tableta lui {selectedPatient.name.split(' ')[0]}.</p><select value={message} onChange={event => setMessage(event.target.value)} aria-label="Mesaj reminder">{reminderOptions.map(option => <option key={option}>{option}</option>)}</select><button className="caregiver-send-button" type="button" onClick={sendReminder} disabled={sending || selectedPatient.status === 'offline'}><Send size={17} /> {sending ? 'Se trimite...' : 'Trimite catre tableta'}</button>{feedback && <div className="caregiver-feedback" role="status"><Check size={15} /> {feedback}</div>}</section>
    </main>
  );
}

function formatNotificationTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Acum';
  return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}