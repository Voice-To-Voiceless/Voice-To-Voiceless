import {
  GazeCalibrationMapper,
  CalibrationSample,
  RidgeCalibrationFeatures,
} from '../../src/vision/calibration/gazeCalibration';
import { samples } from '../../test-utils/calibrationData';

test('fits frame-level quadratic ridge features', () => {
  const featureSamples: CalibrationSample[] = Array.from({ length: 36 }, (_, index) => {
    const leftIrisX = 0.2 + (index % 9) * 0.07;
    const rightIrisY = 0.2 + Math.floor(index / 9) * 0.2;
    const features: RidgeCalibrationFeatures = {
      leftIrisX, leftIrisY: rightIrisY, rightIrisX: leftIrisX + 0.03, rightIrisY,
      yaw: leftIrisX - 0.5, pitch: rightIrisY - 0.5, roll: 0.01 * index,
      eyeScale: 0.04, faceCenterX: 0.5, faceCenterY: 0.5,
    };
    return { features, gaze: { x: 0.5, y: 0.5 }, target: { x: leftIrisX ** 2 + 0.1, y: rightIrisY } };
  });
  const mapper = GazeCalibrationMapper.fit(featureSamples);
  expect(mapper).not.toBeNull();
  const features = featureSamples[17].features!;
  const mapped = mapper!.map({ x: 0.5, y: 0.5, confidence: 1, timestamp: 1 }, features);
  expect(mapped.x).toBeCloseTo(featureSamples[17].target.x, 1);
  expect(mapped.y).toBeCloseTo(featureSamples[17].target.y, 1);
});

test('does not crash when ridge features are unavailable at runtime', () => {
  const featureSamples = samples.flatMap(sample => Array.from({ length: 4 }, () => ({
    ...sample,
    features: {
      leftIrisX: sample.gaze.x, leftIrisY: sample.gaze.y, rightIrisX: sample.gaze.x,
      rightIrisY: sample.gaze.y, yaw: 0, pitch: 0, roll: 0, eyeScale: 0.04,
      faceCenterX: 0.5, faceCenterY: 0.5,
    },
  })));
  const mapper = GazeCalibrationMapper.fit(featureSamples);
  expect(mapper).not.toBeNull();
  expect(mapper!.map({ x: 0.4, y: 0.6, confidence: 1, timestamp: 1 })).toMatchObject({ x: 0.4, y: 0.6 });
});

test('fits compact linear per-axis ridge features and rejects non-finite data', () => {
  const featureSamples: CalibrationSample[] = Array.from({ length: 36 }, (_, index) => {
    const leftIrisX = 0.2 + (index % 9) * 0.07;
    const rightIrisY = 0.2 + Math.floor(index / 9) * 0.2;
    const features: RidgeCalibrationFeatures = {
      leftIrisX, leftIrisY: rightIrisY, rightIrisX: leftIrisX + 0.03, rightIrisY,
      yaw: leftIrisX - 0.5, pitch: rightIrisY - 0.5, roll: 0, eyeScale: 0.04,
      faceCenterX: leftIrisX, faceCenterY: rightIrisY,
    };
    return { features, gaze: { x: 0.5, y: 0.5 }, target: { x: leftIrisX, y: rightIrisY } };
  });
  expect(GazeCalibrationMapper.fit(featureSamples)).not.toBeNull();
  expect(GazeCalibrationMapper.fit(featureSamples.map(sample => ({ ...sample, features: { ...(sample.features as RidgeCalibrationFeatures), yaw: Number.NaN } })))).toBeNull();
});

test('keeps a small pose shift from changing the calibrated mapping materially', () => {
  const training = samples.flatMap(sample => Array.from({ length: 4 }, () => ({
    ...sample,
    features: {
      leftIrisX: sample.gaze.x, leftIrisY: sample.gaze.y, rightIrisX: sample.gaze.x,
      rightIrisY: sample.gaze.y, yaw: 0.03, pitch: 0.08, roll: 0, eyeScale: 0.041,
      faceCenterX: sample.gaze.x, faceCenterY: sample.gaze.y,
    },
  })));
  const validation = training.map(sample => ({ ...sample, features: { ...sample.features!, yaw: 0.01, pitch: 0.10, eyeScale: 0.043 } }));
  expect(GazeCalibrationMapper.fitWithValidation(training, validation)).not.toBeNull();
});

test('rejects a mapper when held-pass RMS exceeds the Phase 1 threshold', () => {
  const training = samples.flatMap(sample => Array.from({ length: 4 }, () => ({
    ...sample,
    features: {
      leftIrisX: sample.gaze.x, leftIrisY: sample.gaze.y, rightIrisX: sample.gaze.x,
      rightIrisY: sample.gaze.y, yaw: sample.gaze.x - 0.5, pitch: sample.gaze.y - 0.5,
      roll: 0, eyeScale: 0.04, faceCenterX: sample.gaze.x, faceCenterY: sample.gaze.y,
    },
  })));
  const validation = training.map(sample => ({ ...sample, target: { x: 0.9, y: 0.9 } }));
  expect(GazeCalibrationMapper.fitWithValidation(training, validation)).toBeNull();
});

test('rejects candidates whose training RMS exceeds the release threshold', () => {
  const training = samples.flatMap(sample => Array.from({ length: 4 }, () => ({
    ...sample,
    target: { x: sample.target.y === 0.5 ? 0.9 : 0.1, y: sample.target.y },
    features: {
      leftIrisX: sample.gaze.x, leftIrisY: sample.gaze.y, rightIrisX: sample.gaze.x,
      rightIrisY: sample.gaze.y, yaw: 0, pitch: 0, roll: 0, eyeScale: 0.04,
      faceCenterX: sample.gaze.x, faceCenterY: sample.gaze.y,
    },
  })));
  expect(GazeCalibrationMapper.fitWithValidation(training, training)).toBeNull();
});
