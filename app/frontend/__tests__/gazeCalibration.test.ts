import { GazeCalibrationMapper, CalibrationSample } from '../src/vision/gazeCalibration';

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