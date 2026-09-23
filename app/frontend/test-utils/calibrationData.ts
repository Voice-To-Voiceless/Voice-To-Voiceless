import type { CalibrationSample } from '../src/vision/calibration/gazeCalibration';

export const samples: CalibrationSample[] = [
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
