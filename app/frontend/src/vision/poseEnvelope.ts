import type { RelativeFacePose } from './facePoseEstimator';

export type PoseEnvelope = {
  yaw: PoseRange;
  pitch: PoseRange;
  eyeScale: PoseRange;
  interEyeDistance: PoseRange;
  faceCenterX: PoseRange;
  faceCenterY: PoseRange;
};

export type PoseDrift = {
  score: number;
  reasons: Array<keyof PoseEnvelope>;
};

type PoseRange = { min: number; max: number; median: number; mad: number; values: number[] };

const POSE_ENVELOPE_MARGIN: Record<keyof PoseEnvelope, number> = {
  yaw: 0.05,
  pitch: 0.05,
  eyeScale: 0.01,
  interEyeDistance: 0.015,
  faceCenterX: 0.04,
  faceCenterY: 0.04,
};

export function createPoseEnvelope(): PoseEnvelope | null {
  return null;
}

export function extendPoseEnvelope(envelope: PoseEnvelope | null, pose: RelativeFacePose): PoseEnvelope | null {
  const values = getPoseValues(pose);
  if (Object.values(values).some(value => !Number.isFinite(value))) return envelope;
  if (envelope === null) {
    return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, createPoseRange(value)])) as PoseEnvelope;
  }
  for (const [key, value] of Object.entries(values) as Array<[keyof PoseEnvelope, number]>) {
    const range = envelope[key];
    range.values.push(value);
    range.min = Math.min(range.min, value);
    range.max = Math.max(range.max, value);
    range.median = median(range.values);
    range.mad = median(range.values.map(sample => Math.abs(sample - range.median)));
  }
  return envelope;
}

export function isPoseWithinEnvelope(envelope: PoseEnvelope | null, pose: RelativeFacePose | null): boolean {
  return getPoseDrift(envelope, pose).reasons.length === 0;
}

export function getPoseDrift(envelope: PoseEnvelope | null, pose: RelativeFacePose | null): PoseDrift {
  if (envelope === null || pose === null || pose.yaw === null || pose.pitch === null) {
    return { score: Number.POSITIVE_INFINITY, reasons: ['yaw', 'pitch'] };
  }
  const values = getPoseValues(pose);
  if (Object.values(values).some(value => !Number.isFinite(value))) {
    return { score: Number.POSITIVE_INFINITY, reasons: ['faceCenterX', 'faceCenterY'] };
  }
  const reasons = (Object.keys(envelope) as Array<keyof PoseEnvelope>).filter(key => {
    const range = envelope[key];
    const tolerance = Math.max(POSE_ENVELOPE_MARGIN[key], range.mad * 3);
    return Math.abs(values[key] - range.median) > tolerance;
  });
  const score = Math.max(...(Object.keys(envelope) as Array<keyof PoseEnvelope>).map(key => {
    const range = envelope[key];
    const tolerance = Math.max(POSE_ENVELOPE_MARGIN[key], range.mad * 3);
    return Math.abs(values[key] - range.median) / tolerance;
  }));
  return { score, reasons };
}

function createPoseRange(value: number): PoseRange {
  return { min: value, max: value, median: value, mad: 0, values: [value] };
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function getPoseValues(pose: RelativeFacePose): Record<keyof PoseEnvelope, number> {
  return {
    yaw: pose.yaw!,
    pitch: pose.pitch!,
    eyeScale: pose.eyeScale,
    interEyeDistance: pose.interEyeDistance,
    faceCenterX: pose.faceCenterX ?? Number.NaN,
    faceCenterY: pose.faceCenterY ?? Number.NaN,
  };
}