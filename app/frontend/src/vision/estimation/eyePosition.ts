import { EyeObservation } from '../types/landmarkTypes';

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
  const irisCenter = getIrisRingCenter(eye, horizontalLength);
  const irisFromInner = {
    x: (irisCenter?.x ?? eye.irisCenter.x) - eye.innerCorner.x,
    y: (irisCenter?.y ?? eye.irisCenter.y) - eye.innerCorner.y,
  };
  const irisFromUpper = {
    x: (irisCenter?.x ?? eye.irisCenter.x) - eye.upperLid.x,
    y: (irisCenter?.y ?? eye.irisCenter.y) - eye.upperLid.y,
  };
  const upperLidCenter = getContourCenter(eye.upperLidContour) ?? eye.upperLid;
  const lowerLidCenter = getContourCenter(eye.lowerLidContour) ?? eye.lowerLid;
  const eyelidContourCenter = midpoint(upperLidCenter, lowerLidCenter);
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

  if (eye.irisRing && !irisCenter) {
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
      verticalFeatureCandidates,
      position: null,
      failureReason: 'iris ring is too dispersed',
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
    { x: lowerLidCenter.x - upperLidCenter.x, y: lowerLidCenter.y - upperLidCenter.y },
    verticalAxis,
  ));
  const anatomicalHorizontalPosition = Math.min(1, Math.max(0, dot(irisFromInner, horizontalAxis) / horizontalLength));
  const directHorizontalPosition = getDirectHorizontalPosition(irisCenter ?? eye.irisCenter, eyeMidpoint, horizontalAxis, horizontalLength);
  const eyelidRelativePosition = dot(irisFromUpper, verticalAxis) / horizontalLength;
  const effectiveIrisCenter = irisCenter ?? eye.irisCenter;
  const cornerMidpointPosition = 0.5 + dot({ x: effectiveIrisCenter.x - eyelidContourCenter.x, y: effectiveIrisCenter.y - eyelidContourCenter.y }, verticalAxis) / horizontalLength;
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

  const upperLidCenter = getContourCenter(eye.upperLidContour) ?? eye.upperLid;
  const lowerLidCenter = getContourCenter(eye.lowerLidContour) ?? eye.lowerLid;
  return Math.max(0, Math.abs(dot(
    { x: lowerLidCenter.x - upperLidCenter.x, y: lowerLidCenter.y - upperLidCenter.y },
    { x: -(eye.outerCorner.y - eye.innerCorner.y) / eyeWidth, y: (eye.outerCorner.x - eye.innerCorner.x) / eyeWidth },
  )) / eyeWidth);
}

function midpoint(first: { x: number; y: number }, second: { x: number; y: number }): { x: number; y: number } {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function getContourCenter(points: { x: number; y: number }[] | undefined): { x: number; y: number } | null {
  if (!points || points.length === 0) return null;
  return points.reduce((center, point) => ({ x: center.x + point.x / points.length, y: center.y + point.y / points.length }), { x: 0, y: 0 });
}

function dot(left: { x: number; y: number }, right: { x: number; y: number }): number {
  return left.x * right.x + left.y * right.y;
}

function getDirectHorizontalPosition(
  irisCenter: { x: number; y: number },
  eyeMidpoint: { x: number; y: number },
  horizontalAxis: { x: number; y: number },
  horizontalLength: number,
): number {
  const irisFromMidpoint = {
    x: irisCenter.x - eyeMidpoint.x,
    y: irisCenter.y - eyeMidpoint.y,
  }
  return Math.min(1, Math.max(0, 0.5 + dot(irisFromMidpoint, horizontalAxis) / horizontalLength));
}

function getIrisRingCenter(eye: EyeObservation, eyeWidth: number): { x: number; y: number; z?: number } | null {
  const maximumRingRadius = eyeWidth * 0.5;
  if (!eye.irisRing || eye.irisRing.length === 0) return null;
  if (eye.irisRing.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return null;

  const center = getContourCenter(eye.irisRing);
  if (!center || eyeWidth <= 0) return null;

  const meanSquaredRadius = eye.irisRing.reduce((sum, point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return sum + dx * dx + dy * dy;
  }, 0) / eye.irisRing.length;
  if (Math.sqrt(meanSquaredRadius) > maximumRingRadius) return null;

  const depths = eye.irisRing.map(point => point.z).filter((z): z is number => z !== undefined && Number.isFinite(z));
  return depths.length === eye.irisRing.length
    ? { ...center, z: depths.reduce((sum, depth) => sum + depth, 0) / depths.length }
    : center;
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
  const irisCenter = getIrisRingCenter(eye, Math.hypot(eye.outerCorner.x - eye.innerCorner.x, eye.outerCorner.y - eye.innerCorner.y)) ?? eye.irisCenter;
  if (irisCenter.z === undefined || eye.innerCorner.z === undefined || eye.outerCorner.z === undefined) return null;
  const cornerDepth = ((eye.innerCorner.z ?? 0) + (eye.outerCorner.z ?? 0)) / 2;
  return irisCenter.z - cornerDepth;
}