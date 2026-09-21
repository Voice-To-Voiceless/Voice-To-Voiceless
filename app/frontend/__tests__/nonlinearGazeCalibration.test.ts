import { GazeCalibrationMapper, CalibrationSample } from '../src/vision/gazeCalibration';

const gridSamples: CalibrationSample[] = [
  { gaze: { x: 0.05, y: 0.08 }, target: { x: 0.1, y: 0.1 } },
  { gaze: { x: 0.44, y: 0.07 }, target: { x: 0.5, y: 0.1 } },
  { gaze: { x: 0.78, y: 0.09 }, target: { x: 0.9, y: 0.1 } },
  { gaze: { x: 0.08, y: 0.46 }, target: { x: 0.1, y: 0.5 } },
  { gaze: { x: 0.48, y: 0.51 }, target: { x: 0.5, y: 0.5 } },
  { gaze: { x: 0.83, y: 0.47 }, target: { x: 0.9, y: 0.5 } },
  { gaze: { x: 0.06, y: 0.88 }, target: { x: 0.1, y: 0.9 } },
  { gaze: { x: 0.52, y: 0.86 }, target: { x: 0.5, y: 0.9 } },
  { gaze: { x: 0.76, y: 0.91 }, target: { x: 0.9, y: 0.9 } },
];

const descendingGridSamples = gridSamples.map(sample => ({
  gaze: { x: 0.83 - sample.target.x * 0.8, y: sample.gaze.y },
  target: sample.target,
}));

test('fits a nonlinear grid and interpolates local cells', () => {
  const mapper = GazeCalibrationMapper.fit(gridSamples);
  expect(mapper).not.toBeNull();
  const mapped = mapper!.map({ x: 0.245, y: 0.075, confidence: 0.9, timestamp: 100 });
  expect(mapped.x).toBeCloseTo(0.3);
  expect(mapped.y).toBeCloseTo(0.1);
});

test('interpolates a horizontally descending gaze axis', () => {
  const mapper = GazeCalibrationMapper.fit(descendingGridSamples);
  expect(mapper).not.toBeNull();
  const mapped = mapper!.map({ x: 0.43, y: 0.51, confidence: 0.9, timestamp: 100 });
  expect(mapped.x).toBeCloseTo(0.5);
});

test('rejects a calibration with insufficient gaze range', () => {
  const centeredSamples = gridSamples.map(sample => ({
    gaze: { x: 0.45 + sample.target.x * 0.03, y: 0.45 + sample.target.y * 0.03 },
    target: sample.target,
  }));
  expect(GazeCalibrationMapper.fit(centeredSamples)).toBeNull();
});

test('falls back to affine mapping when the grid is incomplete', () => {
  const mapper = GazeCalibrationMapper.fit(gridSamples.slice(0, 8));
  expect(mapper).not.toBeNull();
  const mapped = mapper!.map({ x: 0.48, y: 0.51, confidence: 0.9, timestamp: 100 });
  expect(mapped.x).toEqual(expect.any(Number));
  expect(mapped.y).toEqual(expect.any(Number));
});
