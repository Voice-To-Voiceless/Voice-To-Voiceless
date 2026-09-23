import { extendPoseEnvelope, getPoseDrift, isPoseWithinEnvelope } from '../../src/vision/tracking/poseEnvelope';
import { RelativeFacePose } from '../../src/vision/estimation/facePoseEstimator';

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

  expect(envelope.yaw).toMatchObject({ min: -0.1, max: 0.1, median: 0 });
  expect(envelope.yaw.mad).toBeCloseTo(0.1);
  expect(envelope.faceCenterX).toMatchObject({ min: 0.45, max: 0.55, median: 0.5 });
  expect(envelope.faceCenterX.mad).toBeCloseTo(0.05);
  expect(envelope.pitch).toMatchObject({ min: 0, max: 0.05, median: 0.025 });
  expect(envelope.pitch.mad).toBeCloseTo(0.025);
});

test('accepts pose inside the learned envelope', () => {
  let envelope = extendPoseEnvelope(null, pose({ yaw: -0.1, pitch: -0.05, faceCenterX: 0.45, faceCenterY: 0.45 }));
  envelope = extendPoseEnvelope(envelope, pose({ yaw: 0.1, pitch: 0.05, faceCenterX: 0.55, faceCenterY: 0.55 }));

  expect(isPoseWithinEnvelope(envelope, pose())).toBe(true);
});

test('reports robust drift reasons and tolerates small movement', () => {
  let envelope = extendPoseEnvelope(null, pose({ yaw: -0.02, pitch: -0.02, faceCenterX: 0.49 }));
  envelope = extendPoseEnvelope(envelope, pose({ yaw: 0.02, pitch: 0.02, faceCenterX: 0.51 }));

  expect(isPoseWithinEnvelope(envelope, pose({ yaw: 0.04, pitch: 0.03, faceCenterX: 0.53 }))).toBe(true);
  expect(getPoseDrift(envelope, pose({ yaw: 0.2 }))).toMatchObject({ reasons: expect.arrayContaining(['yaw']) });
  expect(getPoseDrift(envelope, pose({ yaw: 0.2 })).score).toBeGreaterThan(1);
});

test('rejects pose outside the learned envelope or without pose', () => {
  const envelope = extendPoseEnvelope(null, pose());

  expect(isPoseWithinEnvelope(envelope, pose({ yaw: 0.1 }))).toBe(false);
  expect(isPoseWithinEnvelope(envelope, null)).toBe(false);
});

test('ignores poses missing face-center measurements', () => {
  expect(extendPoseEnvelope(null, pose({ faceCenterX: undefined }))).toBeNull();
});
