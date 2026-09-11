import { FaceLandmarkObservation } from './landmarkTypes';
import { NormalizedGazePoint } from './gazeTypes';

export type RelativeFacePose = {
  rollRadians: number;
  interEyeDistance: number;
  eyeScale: number;
  yaw: number | null;
  pitch: number | null;
};

export type FacePoseReference = Pick<RelativeFacePose, 'yaw' | 'pitch'>;

export type GazePoseCompensationOptions = {
  yawGain?: number;
  pitchGain?: number;
};

export function estimateRelativeFacePose(observation: FaceLandmarkObservation): RelativeFacePose | null {
  const leftCenter = midpoint(observation.leftEye.innerCorner, observation.leftEye.outerCorner);
  const rightCenter = midpoint(observation.rightEye.innerCorner, observation.rightEye.outerCorner);
  const deltaX = rightCenter.x - leftCenter.x;
  const deltaY = rightCenter.y - leftCenter.y;
  const interEyeDistance = Math.hypot(deltaX, deltaY);
  const leftEyeWidth = distance(observation.leftEye.innerCorner, observation.leftEye.outerCorner);
  const rightEyeWidth = distance(observation.rightEye.innerCorner, observation.rightEye.outerCorner);
  if (interEyeDistance <= 0 || leftEyeWidth <= 0 || rightEyeWidth <= 0) {
    return null;
  }

  const anchors = observation.faceAnchors;
  const faceWidth = anchors === undefined ? 0 : distance(anchors.leftCheek, anchors.rightCheek);
  const faceHeight = anchors === undefined ? 0 : distance(anchors.forehead, anchors.chin);
  const faceCenterX = anchors === undefined ? 0 : (anchors.leftCheek.x + anchors.rightCheek.x) / 2;
  const noseVerticalPosition = anchors === undefined || faceHeight <= 0
    ? null
    : (anchors.noseTip.y - anchors.forehead.y) / faceHeight;

  return {
    rollRadians: Math.atan2(deltaY, deltaX),
    interEyeDistance,
    eyeScale: (leftEyeWidth + rightEyeWidth) / 2,
    yaw: anchors === undefined || faceWidth <= 0
      ? null
      : clamp((anchors.noseTip.x - faceCenterX) / faceWidth, -0.5, 0.5),
    pitch: noseVerticalPosition === null ? null : clamp(noseVerticalPosition - 0.5, -0.5, 0.5),
  };
}

function midpoint(left: { x: number; y: number }, right: { x: number; y: number }) {
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
}

function distance(left: { x: number; y: number }, right: { x: number; y: number }): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function compensateGazeForPose(
  gaze: NormalizedGazePoint,
  pose: RelativeFacePose | null,
  reference: FacePoseReference | null,
  options: GazePoseCompensationOptions = {},
): NormalizedGazePoint {
  if (pose === null || reference === null || pose.yaw === null || pose.pitch === null || reference.yaw === null || reference.pitch === null) {
    return gaze;
  }

  const yawGain = options.yawGain ?? 0.45;
  const pitchGain = options.pitchGain ?? 0.35;
  return {
    ...gaze,
    x: clamp(gaze.x - (pose.yaw - reference.yaw) * yawGain, 0, 1),
    y: clamp(gaze.y - (pose.pitch - reference.pitch) * pitchGain, 0, 1),
  };
}