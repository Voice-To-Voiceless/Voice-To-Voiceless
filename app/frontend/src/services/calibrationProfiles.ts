export type CalibrationPoint = { x: number; y: number };

export type CalibrationValidationSample = {
  prediction: CalibrationPoint;
  target: CalibrationPoint;
  target_index: number;
  accepted?: boolean;
};

export type CalibrationProfilePayload = {
  setup_key: string;
  engine: string;
  engine_version: string;
  payload_version: number;
  score_version: number;
  accuracy_score: number;
  training_data: Record<string, unknown>;
  setup_metadata: Record<string, unknown>;
  pose_reference: Record<string, unknown>;
  validation_samples: CalibrationValidationSample[];
};

export type CalibrationProfile = Omit<CalibrationProfilePayload, 'validation_samples'> & {
  id: string;
  patient_id: string;
  installation_id: string;
  validation_rms: number;
  validation_p95: number;
  created_at: string;
  updated_at: string;
  last_verified_at: string | null;
  last_verification_score: number | null;
};

export type SaveCalibrationResult = { outcome: 'created' | 'replaced' | 'kept_existing'; profile: CalibrationProfile };

const API_HOSTNAME = typeof window !== 'undefined' && window.location?.hostname ? window.location.hostname : 'localhost';
const API_BASE_URL = `http://${API_HOSTNAME}:8000`;
const INSTALLATION_STORAGE_KEY = 'v2vl.calibration.installation-id';

function getInstallationId(): string {
  const stored = window.localStorage.getItem(INSTALLATION_STORAGE_KEY);
  if (stored) return stored;
  const installationId = crypto.randomUUID();
  window.localStorage.setItem(INSTALLATION_STORAGE_KEY, installationId);
  return installationId;
}

export function getCalibrationInstallationId(): string {
  return getInstallationId();
}

export function getCalibrationSetupMetadata(video: HTMLVideoElement): Record<string, unknown> {
  const stream = video.srcObject instanceof MediaStream ? video.srcObject : null;
  const settings = stream?.getVideoTracks()[0]?.getSettings();
  return {
    camera_device_id: settings?.deviceId ?? null,
    camera_width: settings?.width ?? null,
    camera_height: settings?.height ?? null,
    camera_facing_mode: settings?.facingMode ?? null,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    screen_width: window.screen.width,
    screen_height: window.screen.height,
    orientation: window.screen.orientation?.type ?? null,
    device_pixel_ratio: window.devicePixelRatio,
  };
}

export async function getCalibrationProfile(patientId: string, setupKey: string): Promise<CalibrationProfile | null> {
  const response = await fetch(`${API_BASE_URL}/api/v1/patients/${encodeURIComponent(patientId)}/calibration-profiles/${getInstallationId()}/${setupKey}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Calibration profile could not be loaded.');
  return response.json() as Promise<CalibrationProfile>;
}

export async function saveCalibrationProfile(patientId: string, payload: CalibrationProfilePayload): Promise<SaveCalibrationResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/patients/${encodeURIComponent(patientId)}/calibration-profiles/${getInstallationId()}/${payload.setup_key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Calibration profile could not be saved.');
  return response.json() as Promise<SaveCalibrationResult>;
}

export async function deleteCalibrationProfile(patientId: string, setupKey: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/patients/${encodeURIComponent(patientId)}/calibration-profiles/${getInstallationId()}/${setupKey}`, { method: 'DELETE' });
  if (!response.ok && response.status !== 404) throw new Error('Calibration profile could not be deleted.');
}

export async function verifyCalibrationProfile(patientId: string, setupKey: string, score: number): Promise<CalibrationProfile> {
  const response = await fetch(`${API_BASE_URL}/api/v1/patients/${encodeURIComponent(patientId)}/calibration-profiles/${getInstallationId()}/${setupKey}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ score }),
  });
  if (!response.ok) throw new Error('Calibration profile verification failed.');
  return response.json() as Promise<CalibrationProfile>;
}

export async function createCalibrationSetupKey(metadata: Record<string, unknown>): Promise<string> {
  const canonicalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, canonicalize(nested)]));
    }
    return value;
  };
  const encoded = new TextEncoder().encode(JSON.stringify(canonicalize(metadata)));
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}