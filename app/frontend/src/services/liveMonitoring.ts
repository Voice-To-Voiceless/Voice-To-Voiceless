import { createNotification, type PatientNotification } from './notifications';

export type LiveSignalType = 'live_stream_request' | 'live_stream_offer' | 'live_stream_answer' | 'live_stream_ice_candidate';

export type LiveSignal = {
  type: LiveSignalType;
  patientId: string;
  requestId: string;
  payload?: string;
};

export async function sendLiveSignal(signal: LiveSignal, sender: 'patient' | 'nurse'): Promise<void> {
  await createNotification({
    source: sender,
    type: signal.type,
    severity: 'info',
    message: signal.type,
    recipient: sender === 'patient' ? 'nurse' : 'patient',
    patient_metadata: {
      patient_id: signal.patientId,
      request_id: signal.requestId,
      ...(signal.payload ? { payload: signal.payload } : {}),
    },
  });
}

export function isLiveSignalNotification(notification: PatientNotification): boolean {
  return notification.type.startsWith('live_stream_');
}

export function readLiveSignal(notification: PatientNotification): LiveSignal | null {
  if (!isLiveSignalNotification(notification)) return null;
  const requestId = notification.patient_metadata.request_id;
  if (!requestId) return null;
  return {
    type: notification.type as LiveSignalType,
    patientId: notification.patient_metadata.patient_id,
    requestId,
    payload: notification.patient_metadata.payload,
  };
}
