import { EyeObservation } from './landmarkTypes';

export function estimateEyePosition(eye: EyeObservation): { x: number; y: number } | null {
  const eyeWidth = eye.outerCorner.x - eye.innerCorner.x;
  const eyeHeight = eye.lowerLid.y - eye.upperLid.y;
  if (eyeWidth <= 0 || eyeHeight <= 0) {
    return null;
  }

  return {
    x: Math.min(1, Math.max(0, (eye.irisCenter.x - eye.innerCorner.x) / eyeWidth)),
    y: Math.min(1, Math.max(0, (eye.irisCenter.y - eye.upperLid.y) / eyeHeight)),
  };
}