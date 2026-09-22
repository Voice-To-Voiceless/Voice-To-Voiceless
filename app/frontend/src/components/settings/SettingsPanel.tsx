import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Camera, Check, Languages, Moon, MessageSquare, RotateCcw, Settings as SettingsIcon } from 'lucide-react';
import { COMMUNICATION_ACTIONS, type ActionId } from '../../types/communication';

const SETTINGS_STORAGE_KEY = 'voice-to-voiceless-settings';
const DEFAULT_VISIBLE_ACTIONS = COMMUNICATION_ACTIONS.map(action => action.id);

type AppSettings = {
  language: 'English' | 'Romanian';
  darkMode: boolean;
  cameraId: string;
  visibleActions: ActionId[];
};

const DEFAULT_SETTINGS: AppSettings = {
  language: 'English',
  darkMode: false,
  cameraId: '',
  visibleActions: DEFAULT_VISIBLE_ACTIONS,
};

export function applyStoredTheme() {
  const settings = readSettings();
  document.documentElement.dataset.theme = settings.darkMode ? 'dark' : 'light';
}

export default function SettingsPanel() {
  const [settings, setSettings] = useState<AppSettings>(() => readSettings());
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraStatus, setCameraStatus] = useState('Camera permission has not been checked.');

  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    document.documentElement.dataset.theme = settings.darkMode ? 'dark' : 'light';
  }, [settings]);

  useEffect(() => {
    loadCameras().catch(() => setCameraStatus('Unable to inspect available cameras.'));
  }, []);

  async function loadCameras() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const availableCameras = devices.filter(device => device.kind === 'videoinput');
    setCameras(availableCameras);
    setCameraStatus(availableCameras.length > 0 ? 'Camera available.' : 'No camera detected.');
  }

  async function checkCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('Camera access is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setCameraStatus('Camera permission granted.');
      await loadCameras();
    } catch {
      setCameraStatus('Camera permission was denied.');
    }
  }

  function updateSetting<Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]) {
    setSettings(current => ({ ...current, [key]: value }));
  }

  function toggleAction(actionId: ActionId) {
    setSettings(current => ({
      ...current,
      visibleActions: current.visibleActions.includes(actionId)
        ? current.visibleActions.filter(id => id !== actionId)
        : [...current.visibleActions, actionId],
    }));
  }

  function resetAppSettings() {
    localStorage.removeItem('voice-to-voiceless-accessibility');
    setSettings(DEFAULT_SETTINGS);
    document.documentElement.dataset.theme = 'light';
    document.documentElement.dataset.textScale = 'standard';
    document.documentElement.dataset.highContrast = 'false';
    document.documentElement.dataset.reducedMotion = 'false';
  }

  return (
    <section className="settings-panel" aria-labelledby="settings-title">
      <div className="settings-panel__intro">
        <div>
          <span className="eyebrow"><SettingsIcon size={14} /> APP CONFIGURATION</span>
          <h1 id="settings-title">Settings</h1>
            <p>Configure the language, appearance, devices, and communication board.</p>
        </div>
        <button type="button" className="accessibility-reset" onClick={resetAppSettings}><RotateCcw size={16} /> Reset app settings</button>
      </div>

      <div className="settings-grid">
        <SettingsCard icon={<Languages size={19} />} title="Language" description="Choose the language used by the application.">
          <select className="settings-select" value={settings.language} onChange={event => updateSetting('language', event.target.value as AppSettings['language'])}>
            <option>English</option>
            <option>Romanian</option>
          </select>
        </SettingsCard>

        <SettingsCard icon={<Moon size={19} />} title="Appearance" description="Choose the visual theme for the application.">
          <SettingsToggle label="Dark mode" checked={settings.darkMode} onChange={value => updateSetting('darkMode', value)} />
        </SettingsCard>

        <SettingsCard icon={<Camera size={19} />} title="Camera" description="Manage the camera used for tracking.">
          <select className="settings-select" value={settings.cameraId} onChange={event => updateSetting('cameraId', event.target.value)} aria-label="Select camera">
            <option value="">Default camera</option>
            {cameras.map((camera, index) => <option key={camera.deviceId} value={camera.deviceId}>{camera.label || `Camera ${index + 1}`}</option>)}
          </select>
          <button type="button" className="settings-action" onClick={checkCamera}><Camera size={16} /> Check camera permission</button>
          <p className="settings-status" role="status">{cameraStatus}</p>
        </SettingsCard>

        <SettingsCard icon={<MessageSquare size={19} />} title="Communication board" description="Choose which actions appear on the board.">
          <div className="settings-actions-grid">
            {COMMUNICATION_ACTIONS.map(action => <label className="settings-check" key={action.id}><input type="checkbox" checked={settings.visibleActions.includes(action.id)} onChange={() => toggleAction(action.id)} /><span>{action.label}</span><span className="settings-toggle-track" aria-hidden="true" /></label>)}
          </div>
        </SettingsCard>
      </div>

      <div className="accessibility-status" role="status"><Check size={16} /> Your settings are saved automatically on this device.</div>
    </section>
  );
}

function SettingsCard({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return <section className="accessibility-card" aria-label={title}><div className="accessibility-card__heading"><span className="accessibility-icon">{icon}</span><div><h2>{title}</h2><p>{description}</p></div></div>{children}</section>;
}

function SettingsToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => unknown }) {
  return <label className="accessibility-toggle"><span><strong>{label}</strong></span><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /><span className="toggle-track" aria-hidden="true" /></label>;
}

function readSettings(): AppSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}') as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...saved, visibleActions: saved.visibleActions ?? DEFAULT_VISIBLE_ACTIONS };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
