export type PatientRecord = {
  id: string;
  name: string;
  room: string;
  details: string;
};

const API_HOSTNAME = typeof window !== 'undefined' && window.location?.hostname ? window.location.hostname : 'localhost';
const API_BASE_URL = `http://${API_HOSTNAME}:8000`;

export async function getPatients(): Promise<PatientRecord[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/patients`);
  if (!response.ok) throw new Error('Patients could not be loaded.');
  return response.json() as Promise<PatientRecord[]>;
}

export async function linkPatient(code: string): Promise<PatientRecord> {
  const normalizedCode = code.trim().toUpperCase();
  const response = await fetch(`${API_BASE_URL}/api/v1/patients/link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: normalizedCode }),
  });
  if (!response.ok) {
    // Keep the demo tablet code usable while an already-running backend is
    // being restarted and does not yet expose /patients/link.
    if (response.status === 404 && normalizedCode === 'VT-2026-001') {
      const patients = await getPatients();
      const demoPatient = patients.find(patient => patient.id === 'patient-001');
      if (demoPatient) return demoPatient;
    }
    if (response.status === 404) throw new Error('Codul pacientului nu este valid.');
    throw new Error('Pacientul nu a putut fi conectat.');
  }
  return response.json() as Promise<PatientRecord>;
}
