import { useEffect, useState } from 'react';
import { GazePoint } from '../browserTypes';
import { L2CSDebugPreview } from '../../vision/estimation/l2csGaze';

type Props = {
  rawGaze: GazePoint | null;
  calibratedGaze: GazePoint | null;
  showTarget: boolean;
  l2csYaw?: number | null;
  l2csPitch?: number | null;
  provider?: string | null;
  latencyMs?: number | null;
  estimatesPerSecond?: number | null;
  poseStatus?: string;
  l2csCropPreview?: L2CSDebugPreview | null;
};

type PointerState = { point: GazePoint; target: string | null } | null;

export function DebugOverlay({ rawGaze, calibratedGaze, showTarget, l2csYaw, l2csPitch, provider, latencyMs, estimatesPerSecond, poseStatus, l2csCropPreview }: Props) {
  const [pointer, setPointer] = useState<PointerState>(null);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const element = document.elementFromPoint(event.clientX, event.clientY);
      const card = element?.closest<HTMLElement>('[data-action-id]');
      setPointer({
        point: { x: event.clientX / window.innerWidth, y: event.clientY / window.innerHeight },
        target: card?.querySelector('h2')?.textContent?.trim() ?? null,
      });
    };
    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

  return (
    <aside className="debug-overlay" aria-label="Eye tracking debug overlay">
      <DebugMarker point={mirrorHorizontal(rawGaze)} label="Raw gaze" className="debug-marker--raw" />
      <DebugMarker point={calibratedGaze} label="Calibrated gaze" className="debug-marker--calibrated" />
      <DebugMarker point={pointer?.point ?? null} label="Mouse cursor" className="debug-marker--mouse" />
      {showTarget && <div className="debug-overlay__target">Target: {pointer?.target ?? 'None'}</div>}
      <div className="debug-overlay__metrics">L2CS {provider ?? 'off'} · yaw {format(l2csYaw)}° · pitch {format(l2csPitch)}° · {format(latencyMs)} ms · {format(estimatesPerSecond)} est/s · pose {poseStatus ?? 'unknown'}</div>
      {isLocalDebugHost() && l2csCropPreview && <div className="debug-overlay__crop-bounds" aria-label="L2CS crop bounds">
        <code><span className="debug-overlay__crop-red">red</span> {formatBounds(l2csCropPreview.bounds)}</code>
      </div>}
    </aside>
  );
}

function format(value: number | null | undefined): string { return value === null || value === undefined ? '—' : value.toFixed(1); }

function formatBounds(bounds: L2CSDebugPreview['bounds']): string { return `crop l=${bounds.left.toFixed(3)} t=${bounds.top.toFixed(3)} r=${bounds.right.toFixed(3)} b=${bounds.bottom.toFixed(3)}`; }
function isLocalDebugHost(): boolean { return typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location?.hostname ?? ''); }

function mirrorHorizontal(point: GazePoint | null): GazePoint | null {
  return point ? { ...point, x: 1 - point.x } : null;
}

function DebugMarker({ point, label, className }: { point: GazePoint | null; label: string; className: string }) {
  if (!point) return null;
  return <span className={`debug-marker ${className}`} style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} aria-label={label} />;
}
