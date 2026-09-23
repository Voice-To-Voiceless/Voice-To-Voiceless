import { estimateGaze } from '../../src/vision/estimation/gazeEstimator';

test('estimates normalized horizontal gaze from both iris positions', () => {
  const gaze = estimateGaze({
    leftEye: { innerCorner: { x: 0.2, y: 0.4 }, outerCorner: { x: 0.4, y: 0.4 }, upperLid: { x: 0.3, y: 0.3 }, lowerLid: { x: 0.3, y: 0.5 }, irisCenter: { x: 0.3, y: 0.4 }, confidence: 0.9 },
    rightEye: { innerCorner: { x: 0.6, y: 0.4 }, outerCorner: { x: 0.8, y: 0.4 }, upperLid: { x: 0.7, y: 0.3 }, lowerLid: { x: 0.7, y: 0.5 }, irisCenter: { x: 0.7, y: 0.4 }, confidence: 0.8 },
    timestamp: 300,
  });
  expect(gaze).not.toBeNull();
  expect(gaze?.x).toBeCloseTo(0.5);
  expect(gaze?.y).toBeCloseTo(0.5);
  expect(gaze?.confidence).toBe(0.8);
  expect(gaze?.timestamp).toBe(300);
});

test('rejects gaze when an eye has invalid geometry or low confidence', () => {
  const observation = {
    leftEye: { innerCorner: { x: 0.4, y: 0.4 }, outerCorner: { x: 0.4, y: 0.4 }, upperLid: { x: 0.3, y: 0.3 }, lowerLid: { x: 0.3, y: 0.5 }, irisCenter: { x: 0.3, y: 0.4 }, confidence: 0.9 },
    rightEye: { innerCorner: { x: 0.6, y: 0.4 }, outerCorner: { x: 0.8, y: 0.4 }, upperLid: { x: 0.7, y: 0.3 }, lowerLid: { x: 0.7, y: 0.5 }, irisCenter: { x: 0.7, y: 0.4 }, confidence: 0.9 },
    timestamp: 400,
  };
  expect(estimateGaze(observation)).toBeNull();
  expect(estimateGaze({ ...observation, leftEye: { ...observation.leftEye, confidence: 0.2 } })).toBeNull();
});