import { EyeObservation } from './landmarkTypes';

export function estimateEyePosition(eye: EyeObservation): { x: number; y: number } | null {
  const horizontalLength = Math.hypot(eye.outerCorner.x - eye.innerCorner.x, eye.outerCorner.y - eye.innerCorner.y);
  if (horizontalLength <= 0 || eye.outerCorner.x <= eye.innerCorner.x) {
    return null;
  }

  const horizontalAxis = {
    x: (eye.outerCorner.x - eye.innerCorner.x) / horizontalLength,
    y: (eye.outerCorner.y - eye.innerCorner.y) / horizontalLength,
  };
  const verticalAxis = {
    x: -horizontalAxis.y,
    y: horizontalAxis.x,
  };
  if (verticalAxis.y < 0) {
    verticalAxis.x *= -1;
    verticalAxis.y *= -1;
  }

  const irisFromInner = {
    x: eye.irisCenter.x - eye.innerCorner.x,
    y: eye.irisCenter.y - eye.innerCorner.y,
  };
  const irisFromUpper = {
    x: eye.irisCenter.x - eye.upperLid.x,
    y: eye.irisCenter.y - eye.upperLid.y,
  };
  const projectedEyeHeight = Math.abs(dot(
    { x: eye.lowerLid.x - eye.upperLid.x, y: eye.lowerLid.y - eye.upperLid.y },
    verticalAxis,
  ));
  if (projectedEyeHeight <= 0) {
    return null;
  }

  return {
    x: Math.min(1, Math.max(0, dot(irisFromInner, horizontalAxis) / horizontalLength)),
    y: Math.min(1, Math.max(0, dot(irisFromUpper, verticalAxis) / projectedEyeHeight)),
  };
}

export function getEyeAperture(eye: EyeObservation): number {
  const eyeWidth = Math.hypot(eye.outerCorner.x - eye.innerCorner.x, eye.outerCorner.y - eye.innerCorner.y);
  if (eyeWidth <= 0) {
    return 0;
  }

  return Math.max(0, Math.hypot(eye.lowerLid.x - eye.upperLid.x, eye.lowerLid.y - eye.upperLid.y) / eyeWidth);
}

function dot(left: { x: number; y: number }, right: { x: number; y: number }): number {
  return left.x * right.x + left.y * right.y;
}