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