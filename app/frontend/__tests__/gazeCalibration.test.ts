import { GazeCalibrationMapper, CalibrationSample } from '../src/vision/gazeCalibration';
import { getMedianGazeByTarget } from '../src/vision/calibrationMath';
import { getPitchBinnedResidualDiagnostics, getPoseCoefficientDiagnostics, PoseSample } from '../src/modelTesting/poseCalibrationDiagnostics';

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

  const mapped = mapper!.map({ x: 0.3, y: 0.7, confidence: 0.9, timestamp: 100 });
  expect(mapped.x).toBeCloseTo(0.275);
  expect(mapped.y).toBeCloseTo(0.7);
});

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
  expect(mapper!.map({ x: 0.3, y: 0.7, confidence: 0.9, timestamp: 100 }).x).toBeCloseTo(0.275);
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
      ? [sample, { ...sample, gaze: { x: sample.gaze.x + 0.2, y: sample.gaze.y } }]
      : [sample],
  );

  expect(GazeCalibrationMapper.fit(samplesWithOneUnstableTarget)).not.toBeNull();
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

test('reports residuals and pose scale summaries by pitch bin', () => {
  const poseSamples: PoseSample[] = samples.map((sample, index) => ({
    ...sample,
    pose: {
      yaw: [0.03, -0.02, 0.01, 0.01, -0.03, 0.02, -0.02, 0.03, -0.01][index],
      pitch: [0.02, -0.01, 0.03, -0.02, 0.01, -0.03, 0.015, -0.025, 0.005][index],
      eyeScale: 0.04 + index * 0.001,
      interEyeDistance: 0.1 + index * 0.002,
    },
  }));

  const diagnostics = getPitchBinnedResidualDiagnostics(poseSamples);

  expect(diagnostics).toHaveLength(3);
  expect(diagnostics.every(bin => bin.sampleCount > 0)).toBe(true);
  expect(diagnostics[0].lowerPitch).toBeLessThanOrEqual(diagnostics[1].lowerPitch);
  expect(diagnostics[1].lowerPitch).toBeLessThanOrEqual(diagnostics[2].lowerPitch);
  expect(diagnostics[0]).toEqual(expect.objectContaining({
    meanEyeScale: expect.any(Number),
    meanInterEyeDistance: expect.any(Number),
    rmsResidual: expect.any(Number),
    maxResidual: expect.any(Number),
  }));
});

test('reports pose calibration coefficient magnitudes by feature', () => {
  const poseSamples: PoseSample[] = samples.map((sample, index) => ({
    ...sample,
    pose: {
      yaw: [0.03, -0.02, 0.01, 0.01, -0.03, 0.02, -0.02, 0.03, -0.01][index],
      pitch: [0.02, -0.01, 0.03, -0.02, 0.01, -0.03, 0.015, -0.025, 0.005][index],
      eyeScale: 0.04,
      interEyeDistance: 0.1,
    },
  }));

  const diagnostics = getPoseCoefficientDiagnostics(poseSamples);

  expect(diagnostics).not.toBeNull();
  expect(diagnostics!.featureNames).toEqual(['intercept', 'gazeX', 'gazeY', 'yaw', 'pitch']);
  expect(diagnostics!.xCoefficients).toHaveLength(5);
  expect(diagnostics!.yCoefficients).toHaveLength(5);
  expect(diagnostics!.xAbsoluteMagnitudes).toEqual(diagnostics!.xCoefficients.map(Math.abs));
  expect(diagnostics!.yAbsoluteMagnitudes).toEqual(diagnostics!.yCoefficients.map(Math.abs));
  expect(diagnostics!.xMaxAbsoluteMagnitude).toBe(Math.max(...diagnostics!.xAbsoluteMagnitudes));
  expect(diagnostics!.yMaxAbsoluteMagnitude).toBe(Math.max(...diagnostics!.yAbsoluteMagnitudes));
});