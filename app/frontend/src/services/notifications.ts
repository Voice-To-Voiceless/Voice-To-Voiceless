export type NotificationSeverity = 'info' | 'warning' | 'critical';

export type PatientMetadata = {
  patient_id: string;
  name?: string;
  room?: string;
  [key: string]: string | undefined;
};

export type PatientNotification = {
  id: string;
  source: string;
  type: string;
  severity: NotificationSeverity;
  message: string;
  patient_metadata: PatientMetadata;
  created_at: string;
  read: boolean;
};

const API_BASE_URL = `http://${window.location.hostname}:8000`;

export async function createNotification(notification: {
  source: string;
  type: string;
  severity: NotificationSeverity;
  message: string;
  patient_metadata: PatientMetadata;
}): Promise<PatientNotification> {
  const response = await fetch(`${API_BASE_URL}/api/v1/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(notification),
  });
  if (!response.ok) {
    throw new Error('Notification could not be sent.');
  }
  return response.json() as Promise<PatientNotification>;
}

export async function getNotifications(): Promise<PatientNotification[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/notifications`);
  if (!response.ok) {
    throw new Error('Notifications could not be loaded.');
  }
  return response.json() as Promise<PatientNotification[]>;
}

export async function markNotificationRead(id: string): Promise<PatientNotification> {
  const response = await fetch(`${API_BASE_URL}/api/v1/notifications/${id}/read`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Notification could not be marked as read.');
  }
  return response.json() as Promise<PatientNotification>;
}
