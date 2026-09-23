import { useEffect, useState } from 'react';
import { GazePoint } from '../browserTypes';

type Props = {
  rawGaze: GazePoint | null;
  calibratedGaze: GazePoint | null;
  showTarget: boolean;
};

type PointerState = { point: GazePoint; target: string | null } | null;

export function DebugOverlay({ rawGaze, calibratedGaze, showTarget }: Props) {
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
    </aside>
  );
}

function mirrorHorizontal(point: GazePoint | null): GazePoint | null {
  return point ? { ...point, x: 1 - point.x } : null;
}

function DebugMarker({ point, label, className }: { point: GazePoint | null; label: string; className: string }) {
  if (!point) return null;
  return <span className={`debug-marker ${className}`} style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} aria-label={label} />;
}