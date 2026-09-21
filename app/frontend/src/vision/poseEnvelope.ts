import type { RelativeFacePose } from './facePoseEstimator';

export type PoseEnvelope = {
  yaw: PoseRange;
  pitch: PoseRange;
  eyeScale: PoseRange;
  interEyeDistance: PoseRange;
  faceCenterX: PoseRange;
  faceCenterY: PoseRange;
};

type PoseRange = { min: number; max: number };

export function createPoseEnvelope(): PoseEnvelope | null {
  return null;
}

export function extendPoseEnvelope(envelope: PoseEnvelope | null, pose: RelativeFacePose): PoseEnvelope | null {
  const values = getPoseValues(pose);
  if (Object.values(values).some(value => !Number.isFinite(value))) return envelope;
  if (envelope === null) {
    return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { min: value, max: value }])) as PoseEnvelope;
  }
  for (const [key, value] of Object.entries(values) as Array<[keyof PoseEnvelope, number]>) {
    envelope[key].min = Math.min(envelope[key].min, value);
    envelope[key].max = Math.max(envelope[key].max, value);
  }
  return envelope;
}

export function isPoseWithinEnvelope(envelope: PoseEnvelope | null, pose: RelativeFacePose | null): boolean {
  if (envelope === null || pose === null || pose.yaw === null || pose.pitch === null) return false;
  const values = getPoseValues(pose);
  if (Object.values(values).some(value => !Number.isFinite(value))) return false;
  return (Object.keys(envelope) as Array<keyof PoseEnvelope>).every(key => {
    const range = envelope[key];
    return values[key] >= range.min && values[key] <= range.max;
  });
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