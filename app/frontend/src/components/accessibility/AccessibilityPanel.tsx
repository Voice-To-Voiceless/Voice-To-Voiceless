import { useEffect, useState } from 'react';
import { Check, Eye, Headphones, RotateCcw, Sparkles, Volume2 } from 'lucide-react';
import { useLanguage } from '../../i18n';

type TextScale = number;

const DEFAULT_TEXT_SCALE = 100;
const MIN_TEXT_SCALE = 100;
const MAX_TEXT_SCALE = 150;

export default function AccessibilityPanel() {
  const { t } = useLanguage();
  const [textScale, setTextScale] = useState<TextScale>(() => normalizeTextScale(readSetting('textScale', DEFAULT_TEXT_SCALE)));
  const [highContrast, setHighContrast] = useState(() => readSetting('highContrast', false));
  const [reducedMotion, setReducedMotion] = useState(() => readSetting('reducedMotion', false));
  const [audioFeedback, setAudioFeedback] = useState(() => readSetting('audioFeedback', true));

  useEffect(() => {
    applyAccessibilityAttributes({ textScale, highContrast, reducedMotion });
    localStorage.setItem('voice-to-voiceless-accessibility', JSON.stringify({ textScale, highContrast, reducedMotion, audioFeedback }));
  }, [audioFeedback, highContrast, reducedMotion, textScale]);

  function resetSettings() {
    setTextScale(DEFAULT_TEXT_SCALE);
    setHighContrast(false);
    setReducedMotion(false);
    setAudioFeedback(true);
  }

  return (
    <section className="accessibility-panel" aria-labelledby="accessibility-title">
      <div className="accessibility-panel__intro">
        <div>
          <span className="eyebrow"><Sparkles size={14} /> {t('personalizedExperience')}</span>
          <h1 id="accessibility-title">{t('accessibility')}</h1>
          <p>{t('accessibilityDescription')}</p>
        </div>
        <button type="button" className="accessibility-reset" onClick={resetSettings}><RotateCcw size={16} /> {t('reset')}</button>
      </div>

      <div className="accessibility-grid">
        <section className="accessibility-card" aria-labelledby="visual-title">
          <div className="accessibility-card__heading"><span className="accessibility-icon"><Eye size={19} /></span><div><h2 id="visual-title">{t('visual')}</h2><p>{t('visualDescription')}</p></div></div>
          <div className="accessibility-control">
            <div className="accessibility-control__label"><span>{t('textSize')}</span><strong>{textScale}%</strong></div>
            <div className="text-size-slider">
              <span aria-hidden="true">A</span>
              <input
                type="range"
                min={MIN_TEXT_SCALE}
                max={MAX_TEXT_SCALE}
                step="1"
                value={textScale}
                aria-label={t('textSize')}
                aria-valuetext={`${textScale}%`}
                onChange={event => setTextScale(Number(event.target.value))}
                style={{ '--slider-progress': `${((textScale - MIN_TEXT_SCALE) / (MAX_TEXT_SCALE - MIN_TEXT_SCALE)) * 100}%` } as React.CSSProperties}
              />
              <span aria-hidden="true">A</span>
            </div>
           
          </div>
          <ToggleRow label={t('highContrast')} description={t('highContrastDescription')} checked={highContrast} onChange={setHighContrast} />
          <ToggleRow label={t('reduceMotion')} description={t('reduceMotionDescription')} checked={reducedMotion} onChange={setReducedMotion} />
        </section>

        <section className="accessibility-card" aria-labelledby="audio-title">
          <div className="accessibility-card__heading"><span className="accessibility-icon"><Headphones size={19} /></span><div><h2 id="audio-title">{t('feedback')}</h2><p>{t('feedbackDescription')}</p></div></div>
          <ToggleRow label={t('audioFeedback')} description={t('audioFeedbackDescription')} checked={audioFeedback} onChange={setAudioFeedback} />
          <button type="button" className="accessibility-action" onClick={() => audioFeedback && window.speechSynthesis?.speak(new SpeechSynthesisUtterance(t('audioFeedbackActive')))}><Volume2 size={17} /> {t('testAudioFeedback')}</button>
        </section>
      </div>

      <div className="accessibility-status" role="status"><Check size={16} /> {t('preferencesSaved')}</div>
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
    textScale: normalizeTextScale(readSetting('textScale', DEFAULT_TEXT_SCALE)),
    highContrast: readSetting('highContrast', false),
    reducedMotion: readSetting('reducedMotion', false),
  });
}

function applyAccessibilityAttributes(settings: Pick<{ textScale: TextScale; highContrast: boolean; reducedMotion: boolean }, 'textScale' | 'highContrast' | 'reducedMotion'>): void {
  const root = document.documentElement;
  root.dataset.textScale = String(settings.textScale);
  root.style.setProperty('--text-scale', String(settings.textScale / 100));
  root.dataset.highContrast = String(settings.highContrast);
  root.dataset.reducedMotion = String(settings.reducedMotion);
}

function normalizeTextScale(value: unknown): TextScale {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.min(MAX_TEXT_SCALE, Math.max(MIN_TEXT_SCALE, value));
  if (value === 'large') return 125;
  if (value === 'extra-large') return 150;
  return DEFAULT_TEXT_SCALE;
}