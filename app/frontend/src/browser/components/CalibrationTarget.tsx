import React from 'react';
import { GazePoint } from '../browserTypes';

type Props = { gazePoint: GazePoint | null; target: GazePoint | null; progress: number; passKind: 'training' | 'validation' | null };

export function CalibrationTarget({ gazePoint, target, progress, passKind }: Props) {
  return <>
    {gazePoint && <span aria-hidden="true" className="gaze-cursor" style={{ left: `${gazePoint.x * 100}%`, top: `${gazePoint.y * 100}%` }} />}
    {target && <span aria-hidden="true" className={`calibration-target calibration-target--${passKind ?? 'training'}`} style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%`, '--calibration-progress': `${progress}turn` } as React.CSSProperties} />}
  </>;
}
