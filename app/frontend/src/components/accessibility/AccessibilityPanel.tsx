import { useEffect, useState } from 'react';
import { Check, Eye, Headphones, Minus, Plus, RotateCcw, Sparkles, Volume2 } from 'lucide-react';

type TextScale = 'standard' | 'large' | 'extra-large';

const TEXT_SCALE_LABELS: Record<TextScale, string> = {
  standard: 'Standard',
  large: 'Large',
  'extra-large': 'Extra large',
};

export default function AccessibilityPanel() {
  const [textScale, setTextScale] = useState<TextScale>(() => readSetting('textScale', 'standard'));
  const [highContrast, setHighContrast] = useState(() => readSetting('highContrast', false));
  const [reducedMotion, setReducedMotion] = useState(() => readSetting('reducedMotion', false));
  const [audioFeedback, setAudioFeedback] = useState(() => readSetting('audioFeedback', true));

  useEffect(() => {
    applyAccessibilityAttributes({ textScale, highContrast, reducedMotion });
    localStorage.setItem('voice-to-voiceless-accessibility', JSON.stringify({ textScale, highContrast, reducedMotion, audioFeedback }));
  }, [audioFeedback, highContrast, reducedMotion, textScale]);

  function resetSettings() {
    setTextScale('standard');
    setHighContrast(false);
    setReducedMotion(false);
    setAudioFeedback(true);
  }

  return (
    <section className="accessibility-panel" aria-labelledby="accessibility-title">
      <div className="accessibility-panel__intro">
        <div>
          <span className="eyebrow"><Sparkles size={14} /> PERSONALIZED EXPERIENCE</span>
          <h1 id="accessibility-title">Accessibility</h1>
          <p>Choose how the app helps you communicate more easily.</p>
        </div>
        <button type="button" className="accessibility-reset" onClick={resetSettings}><RotateCcw size={16} /> Reset</button>
      </div>

      <div className="accessibility-grid">
        <section className="accessibility-card" aria-labelledby="visual-title">
          <div className="accessibility-card__heading"><span className="accessibility-icon"><Eye size={19} /></span><div><h2 id="visual-title">Visual</h2><p>Make the interface easier to follow.</p></div></div>
          <div className="accessibility-control">
            <div className="accessibility-control__label"><span>Text size</span><strong>{TEXT_SCALE_LABELS[textScale]}</strong></div>
            <div className="segmented-control" role="group" aria-label="Text size">
              {(Object.keys(TEXT_SCALE_LABELS) as TextScale[]).map(scale => <button key={scale} type="button" className={textScale === scale ? 'is-selected' : ''} onClick={() => setTextScale(scale)}>{scale === 'standard' ? <Minus size={15} /> : scale === 'large' ? <Plus size={15} /> : <><Plus size={15} /><Plus size={15} /></>}</button>)}
            </div>
          </div>
          <ToggleRow label="High contrast" description="Increase the difference between text and background." checked={highContrast} onChange={setHighContrast} />
          <ToggleRow label="Reduce motion" description="Keep transitions simple and subtle." checked={reducedMotion} onChange={setReducedMotion} />
        </section>

        <section className="accessibility-card" aria-labelledby="audio-title">
          <div className="accessibility-card__heading"><span className="accessibility-icon"><Headphones size={19} /></span><div><h2 id="audio-title">Feedback</h2><p>Receive confirmation when you take an action.</p></div></div>
          <ToggleRow label="Audio feedback" description="Play a sound when an option is selected." checked={audioFeedback} onChange={setAudioFeedback} />
          <button type="button" className="accessibility-action" onClick={() => audioFeedback && window.speechSynthesis?.speak(new SpeechSynthesisUtterance('Audio feedback is active'))}><Volume2 size={17} /> Test audio feedback</button>
        </section>
      </div>

      <div className="accessibility-status" role="status"><Check size={16} /> Your preferences are saved automatically on this device.</div>
    </section>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="accessibility-toggle"><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /><span className="toggle-track" aria-hidden="true" /></label>;
}

function readSetting<T>(key: string, fallback: T): T {
  try {
    const saved = JSON.parse(localStorage.getItem('voice-to-voiceless-accessibility') ?? '{}') as Record<string, unknown>;
    return (saved[key] as T | undefined) ?? fallback;
  } catch {
    return fallback;
  }
}

export function applyStoredAccessibilitySettings(): void {
  applyAccessibilityAttributes({
    textScale: readSetting('textScale', 'standard'),
    highContrast: readSetting('highContrast', false),
    reducedMotion: readSetting('reducedMotion', false),
  });
}

function applyAccessibilityAttributes(settings: Pick<{ textScale: TextScale; highContrast: boolean; reducedMotion: boolean }, 'textScale' | 'highContrast' | 'reducedMotion'>): void {
  const root = document.documentElement;
  root.dataset.textScale = settings.textScale;
  root.dataset.highContrast = String(settings.highContrast);
  root.dataset.reducedMotion = String(settings.reducedMotion);
}