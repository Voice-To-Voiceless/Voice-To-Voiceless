import { EyeObservation } from './landmarkTypes';

export type EyePositionDiagnostics = {
  eyeWidth: number;
  horizontalLength: number;
  horizontalAxis: { x: number; y: number } | null;
  verticalAxis: { x: number; y: number } | null;
  projectedEyeHeight: number;
  eyeMidpoint: { x: number; y: number };
  directHorizontalPosition: number | null;
  irisFromInner: { x: number; y: number };
  irisFromUpper: { x: number; y: number };
  position: { x: number; y: number } | null;
  failureReason: string | null;
};

export function estimateEyePosition(eye: EyeObservation): { x: number; y: number } | null {
  return getEyePositionDiagnostics(eye).position;
}

export function getEyePositionDiagnostics(eye: EyeObservation): EyePositionDiagnostics {
  const horizontalLength = Math.hypot(eye.outerCorner.x - eye.innerCorner.x, eye.outerCorner.y - eye.innerCorner.y);
  const eyeMidpoint = {
    x: (eye.innerCorner.x + eye.outerCorner.x) / 2,
    y: (eye.innerCorner.y + eye.outerCorner.y) / 2,
  };
  const irisFromInner = {
    x: eye.irisCenter.x - eye.innerCorner.x,
    y: eye.irisCenter.y - eye.innerCorner.y,
  };
  const irisFromUpper = {
    x: eye.irisCenter.x - eye.upperLid.x,
    y: eye.irisCenter.y - eye.upperLid.y,
  };
  if (horizontalLength <= 0) {
    return {
      eyeWidth: horizontalLength,
      horizontalLength,
      horizontalAxis: null,
      verticalAxis: null,
      projectedEyeHeight: 0,
      eyeMidpoint,
      directHorizontalPosition: null,
      irisFromInner,
      irisFromUpper,
      position: null,
      failureReason: 'invalid eye corner orientation',
    };
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

  const projectedEyeHeight = Math.abs(dot(
    { x: eye.lowerLid.x - eye.upperLid.x, y: eye.lowerLid.y - eye.upperLid.y },
    verticalAxis,
  ));
  if (projectedEyeHeight <= 0) {
    const directHorizontalPosition = getDirectHorizontalPosition(eye, eyeMidpoint, horizontalAxis, horizontalLength);
    return {
      eyeWidth: horizontalLength,
      horizontalLength,
      horizontalAxis,
      verticalAxis,
      projectedEyeHeight,
      eyeMidpoint,
      directHorizontalPosition,
      irisFromInner,
      irisFromUpper,
      position: null,
      failureReason: 'invalid projected eye height',
    };
  }

  const anatomicalHorizontalPosition = Math.min(1, Math.max(0, dot(irisFromInner, horizontalAxis) / horizontalLength));
  const directHorizontalPosition = getDirectHorizontalPosition(eye, eyeMidpoint, horizontalAxis, horizontalLength);

  return {
    eyeWidth: horizontalLength,
    horizontalLength,
    horizontalAxis,
    verticalAxis,
    projectedEyeHeight,
    eyeMidpoint,
    directHorizontalPosition: toScreenHorizontalPosition(directHorizontalPosition, eye.screenSide),
    irisFromInner,
    irisFromUpper,
    position: {
      x: toScreenHorizontalPosition(anatomicalHorizontalPosition, eye.screenSide),
      y: Math.min(1, Math.max(0, dot(irisFromUpper, verticalAxis) / projectedEyeHeight)),
    },
    failureReason: null,
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

function getDirectHorizontalPosition(
  eye: EyeObservation,
  eyeMidpoint: { x: number; y: number },
  horizontalAxis: { x: number; y: number },
  horizontalLength: number,
): number {
  const irisFromMidpoint = {
    x: eye.irisCenter.x - eyeMidpoint.x,
    y: eye.irisCenter.y - eyeMidpoint.y,
  };
  return Math.min(1, Math.max(0, 0.5 + dot(irisFromMidpoint, horizontalAxis) / horizontalLength));
}

function toScreenHorizontalPosition(position: number, screenSide: EyeObservation['screenSide']): number {
  return screenSide === 'left' ? 1 - position : position;
}