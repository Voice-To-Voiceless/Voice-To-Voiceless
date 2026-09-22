import { extendPoseEnvelope, isPoseWithinEnvelope } from '../src/vision/poseEnvelope';
import { RelativeFacePose } from '../src/vision/facePoseEstimator';

function pose(overrides: Partial<RelativeFacePose> = {}): RelativeFacePose {
  return {
    rollRadians: 0,
    interEyeDistance: 0.1,
    eyeScale: 0.05,
    faceCenterX: 0.5,
    faceCenterY: 0.5,
    yaw: 0,
    pitch: 0,
    ...overrides,
  };
}

test('stores the observed training pose envelope', () => {
  let envelope = extendPoseEnvelope(null, pose({ yaw: -0.1, faceCenterX: 0.45 }));
  envelope = extendPoseEnvelope(envelope, pose({ yaw: 0.1, faceCenterX: 0.55, pitch: 0.05 }));
  expect(envelope).not.toBeNull();
  if (envelope === null) return;

  expect(envelope.yaw).toEqual({ min: -0.1, max: 0.1 });
  expect(envelope.faceCenterX).toEqual({ min: 0.45, max: 0.55 });
  expect(envelope.pitch).toEqual({ min: 0, max: 0.05 });
});

test('accepts pose inside the learned envelope', () => {
  let envelope = extendPoseEnvelope(null, pose({ yaw: -0.1, pitch: -0.05, faceCenterX: 0.45, faceCenterY: 0.45 }));
  envelope = extendPoseEnvelope(envelope, pose({ yaw: 0.1, pitch: 0.05, faceCenterX: 0.55, faceCenterY: 0.55 }));

  expect(isPoseWithinEnvelope(envelope, pose())).toBe(true);
});

test('rejects pose outside the learned envelope or without pose', () => {
  const envelope = extendPoseEnvelope(null, pose());

  expect(isPoseWithinEnvelope(envelope, pose({ yaw: 0.01 }))).toBe(false);
  expect(isPoseWithinEnvelope(envelope, null)).toBe(false);
});

test('ignores poses missing face-center measurements', () => {
  expect(extendPoseEnvelope(null, pose({ faceCenterX: undefined }))).toBeNull();
});
