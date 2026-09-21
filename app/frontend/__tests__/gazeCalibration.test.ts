import {
  GazeCalibrationMapper,
  CalibrationSample,
  RidgeCalibrationFeatures,
} from '../src/vision/gazeCalibration';
import { getMedianGazeByTarget } from '../src/vision/calibrationMath';
const samples: CalibrationSample[] = [
  { gaze: { x: 0.1, y: 0.1 }, target: { x: 0.05, y: 0.1 } },
  { gaze: { x: 0.5, y: 0.1 }, target: { x: 0.5, y: 0.1 } },
  { gaze: { x: 0.9, y: 0.1 }, target: { x: 0.95, y: 0.1 } },
  { gaze: { x: 0.1, y: 0.5 }, target: { x: 0.05, y: 0.5 } },
  { gaze: { x: 0.5, y: 0.5 }, target: { x: 0.5, y: 0.5 } },
  { gaze: { x: 0.9, y: 0.5 }, target: { x: 0.95, y: 0.5 } },
  { gaze: { x: 0.1, y: 0.9 }, target: { x: 0.05, y: 0.9 } },
  { gaze: { x: 0.5, y: 0.9 }, target: { x: 0.5, y: 0.9 } },
  { gaze: { x: 0.9, y: 0.9 }, target: { x: 0.95, y: 0.9 } },
];

test('fits an affine gaze-to-screen mapping', () => {
  const mapper = GazeCalibrationMapper.fit(samples);
  expect(mapper).not.toBeNull();

  const mapped = mapper!.map({
    x: 0.3,
    y: 0.7,
    confidence: 0.9,
    timestamp: 100,
  });
  expect(mapped.x).toBeCloseTo(0.275);
  expect(mapped.y).toBeCloseTo(0.7);
});
export {};
// Keep this file as an explicit module.
test('rejects insufficient or singular calibration data', () => {
  expect(GazeCalibrationMapper.fit(samples.slice(0, 2))).toBeNull();
  expect(
    GazeCalibrationMapper.fit([
      { gaze: { x: 0.5, y: 0.5 }, target: { x: 0.1, y: 0.1 } },
      { gaze: { x: 0.5, y: 0.5 }, target: { x: 0.5, y: 0.5 } },
      { gaze: { x: 0.5, y: 0.5 }, target: { x: 0.9, y: 0.9 } },
    ]),
  ).toBeNull();
});

test('clamps mapped coordinates to the screen', () => {
  const mapper = GazeCalibrationMapper.fit(samples);
  const mapped = mapper!.map({ x: -1, y: 2, confidence: 1, timestamp: 200 });

  expect(mapped.x).toBe(0);
  expect(mapped.y).toBe(1);
});

test('uses the median of repeated target samples', () => {
  const repeatedSamples = samples.flatMap(sample => [
    sample,
    { ...sample, gaze: { x: sample.gaze.x + 0.01, y: sample.gaze.y - 0.01 } },
    { ...sample, gaze: { x: sample.gaze.x - 0.01, y: sample.gaze.y + 0.01 } },
  ]);
  repeatedSamples.push({ gaze: { x: 1, y: 0 }, target: samples[0].target });

  const mapper = GazeCalibrationMapper.fit(repeatedSamples);

  expect(mapper).not.toBeNull();
  expect(
    mapper!.map({ x: 0.3, y: 0.7, confidence: 0.9, timestamp: 100 }).x,
  ).toBeCloseTo(0.275);
});

test('rejects unstable target samples and high residual error', () => {
  const unstableSamples = samples.flatMap(sample => [
    sample,
    { ...sample, gaze: { x: sample.gaze.x + 0.2, y: sample.gaze.y } },
  ]);
  expect(GazeCalibrationMapper.fit(unstableSamples)).toBeNull();

  const noisySamples = samples.map((sample, index) => ({
    ...sample,
    target: index === 4 ? { x: 2, y: 0 } : sample.target,
  }));
  expect(GazeCalibrationMapper.fit(noisySamples)).toBeNull();
});

test('accepts a usable mapping with normal webcam noise', () => {
  const noisySamples = samples.map((sample, index) => ({
    ...sample,
    target: {
      x: sample.target.x + (index % 2 === 0 ? 0.04 : -0.04),
      y: sample.target.y + (index % 3 === 0 ? 0.03 : -0.03),
    },
  }));

  expect(GazeCalibrationMapper.fit(noisySamples)).not.toBeNull();
});

test('keeps calibration usable when one target is unstable', () => {
  const samplesWithOneUnstableTarget = samples.flatMap((sample, index) =>
    index === 4
      ? [
          sample,
          { ...sample, gaze: { x: sample.gaze.x + 0.2, y: sample.gaze.y } },
        ]
      : [sample],
  );

  expect(
    GazeCalibrationMapper.fit(samplesWithOneUnstableTarget),
  ).not.toBeNull();
});

test('reports the median raw gaze position for each target', () => {
  const diagnostics = getMedianGazeByTarget([
    { target: { x: 0.1, y: 0.1 }, gaze: { x: 0.3, y: 0.4 } },
    { target: { x: 0.1, y: 0.1 }, gaze: { x: 0.2, y: 0.5 } },
    { target: { x: 0.1, y: 0.1 }, gaze: { x: 0.4, y: 0.6 } },
    { target: { x: 0.9, y: 0.9 }, gaze: { x: 0.8, y: 0.7 } },
  ]);

  expect(diagnostics).toHaveLength(2);
  expect(diagnostics[0]).toMatchObject({
    target: { x: 0.1, y: 0.1 },
    gaze: { x: 0.3, y: 0.5 },
    sampleCount: 3,
  });
  expect(diagnostics[1]).toMatchObject({
    target: { x: 0.9, y: 0.9 },
    gaze: { x: 0.8, y: 0.7 },
    sampleCount: 1,
  });
});

test('fits frame-level quadratic ridge features', () => {
  const featureSamples: CalibrationSample[] = Array.from({ length: 36 }, (_, index) => {
    const leftIrisX = 0.2 + (index % 9) * 0.07;
    const rightIrisY = 0.2 + Math.floor(index / 9) * 0.2;
    const features: RidgeCalibrationFeatures = {
      leftIrisX, leftIrisY: rightIrisY, rightIrisX: leftIrisX + 0.03, rightIrisY,
      yaw: leftIrisX - 0.5, pitch: rightIrisY - 0.5, roll: 0.01 * index,
      eyeScale: 0.04, faceCenterX: 0.5, faceCenterY: 0.5,
    };
    return {
      features,
      gaze: { x: 0.5, y: 0.5 },
      target: { x: leftIrisX ** 2 + 0.1, y: rightIrisY },
    };
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
