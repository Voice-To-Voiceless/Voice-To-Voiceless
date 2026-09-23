import {
  getPitchBinnedResidualDiagnostics,
  getPoseCoefficientDiagnostics,
  getPoseFeatureRanges,
  PoseSample,
} from '../../src/modelTesting/poseCalibrationDiagnostics';

const samples: PoseSample[] = [
  [0.1, 0.1], [0.5, 0.1], [0.9, 0.1], [0.1, 0.5], [0.5, 0.5],
  [0.9, 0.5], [0.1, 0.9], [0.5, 0.9], [0.9, 0.9],
].map(([x, y], index) => ({
  gaze: { x, y }, target: { x, y },
  pose: {
    yaw: [0.03, -0.02, 0.01, 0.01, -0.03, 0.02, -0.02, 0.03, -0.01][index],
    pitch: [0.02, -0.01, 0.03, -0.02, 0.01, -0.03, 0.015, -0.025, 0.005][index],
    eyeScale: 0.04 + index * 0.001, interEyeDistance: 0.1 + index * 0.002,
  },
}));

test('uses median pose and gaze values per target before fitting', () => {
  const outlier = { ...samples[0], gaze: { x: 1, y: 0 }, pose: { yaw: 1, pitch: -1, eyeScale: 1, interEyeDistance: 1 } };
  expect(getPoseCoefficientDiagnostics([...samples, samples[0], outlier])).toEqual(getPoseCoefficientDiagnostics(samples));
});

test('reports pitch bins and pose feature ranges', () => {
  const bins = getPitchBinnedResidualDiagnostics(samples);
  const ranges = getPoseFeatureRanges(samples)!;
  expect(bins).toHaveLength(3);
  expect(bins.every(bin => bin.sampleCount > 0)).toBe(true);
  expect(ranges.yaw.range).toBeCloseTo(0.06);
  expect(ranges.pitch.range).toBeCloseTo(0.06);
});

test('reports pose coefficient magnitudes by feature', () => {
  const diagnostics = getPoseCoefficientDiagnostics(samples)!;
  expect(diagnostics.featureNames).toEqual(['intercept', 'gazeX', 'gazeY', 'yaw', 'pitch']);
  expect(diagnostics.xAbsoluteMagnitudes).toEqual(diagnostics.xCoefficients.map(Math.abs));
  expect(diagnostics.yAbsoluteMagnitudes).toEqual(diagnostics.yCoefficients.map(Math.abs));
});
