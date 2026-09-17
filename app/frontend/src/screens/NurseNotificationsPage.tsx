import { useEffect, useState } from 'react';
import {
  getNotifications,
  markNotificationRead,
  PatientNotification,
} from '../services/notifications';

type NurseNotificationsPageProps = {
  onBack: () => void;
};

export function NurseNotificationsPage({ onBack }: NurseNotificationsPageProps) {
  const [notifications, setNotifications] = useState<PatientNotification[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function loadNotifications() {
    try {
      setNotifications(await getNotifications());
      setError(null);
    } catch {
      setError('Backend-ul nu este disponibil. Verifică serviciul de pe portul 8000.');
    }
  }

  useEffect(() => {
    loadNotifications();
    const interval = window.setInterval(() => {
      loadNotifications();
    }, 3000);
    return () => window.clearInterval(interval);
  }, []);

  async function markRead(notification: PatientNotification) {
    try {
      const updated = await markNotificationRead(notification.id);
      setNotifications(previous => previous.map(item => item.id === updated.id ? updated : item));
    } catch {
      setError('Notificarea nu a putut fi actualizată.');
    }
  }

  return (
    <main className="nurse-page">
      <header className="nurse-header">
        <div>
          <p className="eyebrow">V2VL NURSE DESK</p>
          <h1>Patient notifications</h1>
          <p className="nurse-subtitle">Live events from eye tracking and face recognition.</p>
        </div>
        <button type="button" className="nurse-back-button" onClick={onBack}>Back to patient</button>
      </header>

      {error && <p className="nurse-error">{error}</p>}
      {notifications.length === 0 && !error && (
        <section className="nurse-empty">No patient notifications yet.</section>
      )}
      <section className="notification-list" aria-live="polite">
        {notifications.map(notification => (
          <article className={`notification-item ${notification.severity} ${notification.read ? 'read' : ''}`} key={notification.id}>
            <div className="notification-item-heading">
              <span className="notification-severity">{notification.severity}</span>
              <time dateTime={notification.created_at}>{new Date(notification.created_at).toLocaleString()}</time>
            </div>
            <h2>{notification.message}</h2>
            <p>{notification.patient_metadata.name || notification.patient_metadata.patient_id} · {notification.patient_metadata.room || 'Room not specified'}</p>
            <span className="notification-source">{notification.source} / {notification.type}</span>
            {!notification.read && <button type="button" className="notification-read-button" onClick={() => { markRead(notification); }}>Mark as read</button>}
          </article>
        ))}
      </section>
    </main>
  );
}
