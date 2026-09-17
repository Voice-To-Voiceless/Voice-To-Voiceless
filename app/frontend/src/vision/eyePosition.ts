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
  verticalFeatureCandidates: {
    eyelidRelative: number | null;
    cornerMidpoint: number | null;
    irisRing: number | null;
    irisDepth: number | null;
  };
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
  const verticalFeatureCandidates = {
    eyelidRelative: null as number | null,
    cornerMidpoint: null as number | null,
    irisRing: null as number | null,
    irisDepth: getNormalizedIrisDepth(eye, eyeMidpoint),
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
      verticalFeatureCandidates: { ...verticalFeatureCandidates, cornerMidpoint: 0.5 },
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
  const anatomicalHorizontalPosition = Math.min(1, Math.max(0, dot(irisFromInner, horizontalAxis) / horizontalLength));
  const directHorizontalPosition = getDirectHorizontalPosition(eye, eyeMidpoint, horizontalAxis, horizontalLength);
  const eyelidRelativePosition = projectedEyeHeight > 0
    ? dot(irisFromUpper, verticalAxis) / projectedEyeHeight
    : 0.5;
  const cornerMidpointPosition = 0.5 + dot({ x: eye.irisCenter.x - eyeMidpoint.x, y: eye.irisCenter.y - eyeMidpoint.y }, verticalAxis) / horizontalLength;
  const irisRingPosition = getIrisRingVerticalPosition(eye, eyeMidpoint, verticalAxis, horizontalLength);
  verticalFeatureCandidates.eyelidRelative = eyelidRelativePosition;
  verticalFeatureCandidates.cornerMidpoint = cornerMidpointPosition;
  verticalFeatureCandidates.irisRing = irisRingPosition;

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
    verticalFeatureCandidates,
    position: {
      x: toScreenHorizontalPosition(anatomicalHorizontalPosition, eye.screenSide),
      y: Math.min(1, Math.max(0, cornerMidpointPosition)),
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

function getIrisRingVerticalPosition(
  eye: EyeObservation,
  eyeMidpoint: { x: number; y: number },
  verticalAxis: { x: number; y: number },
  horizontalLength: number,
): number | null {
  if (!eye.irisRing || eye.irisRing.length === 0) return null;
  const meanVerticalOffset = eye.irisRing.reduce(
    (sum, point) => sum + dot({ x: point.x - eyeMidpoint.x, y: point.y - eyeMidpoint.y }, verticalAxis),
    0,
  ) / eye.irisRing.length;
  return 0.5 + meanVerticalOffset / horizontalLength;
}

function getNormalizedIrisDepth(eye: EyeObservation, _eyeMidpoint: { x: number; y: number }): number | null {
  if (eye.irisCenter.z === undefined || eye.innerCorner.z === undefined || eye.outerCorner.z === undefined) return null;
  const cornerDepth = ((eye.innerCorner.z ?? 0) + (eye.outerCorner.z ?? 0)) / 2;
  return eye.irisCenter.z - cornerDepth;
}