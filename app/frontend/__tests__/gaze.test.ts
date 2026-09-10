import { findGazeTarget } from '../src/vision/gazeTarget';
import { estimateGaze } from '../src/vision/gazeEstimator';
import { GazeSmoother } from '../src/vision/gazeSmoother';

test('smooths gaze movement while preserving the latest confidence and timestamp', () => {
  const smoother = new GazeSmoother(0.25);

  expect(
    smoother.update({ x: 0.2, y: 0.4, confidence: 0.9, timestamp: 100 }),
  ).toEqual({
    x: 0.2,
    y: 0.4,
    confidence: 0.9,
    timestamp: 100,
  });
  expect(
    smoother.update({ x: 1, y: 0.8, confidence: 0.8, timestamp: 200 }),
  ).toEqual({
    x: 0.4,
    y: 0.5,
    confidence: 0.8,
    timestamp: 200,
  });
});

test('maps confident gaze to a target and rejects low confidence', () => {
  const targets = [{ id: 'help', left: 0.25, top: 0.25, right: 0.5, bottom: 0.5 }];

  expect(
    findGazeTarget(
      { x: 0.4, y: 0.3, confidence: 0.8, timestamp: 100 },
      targets,
    ),
  ).toBe('help');
  expect(
    findGazeTarget(
      { x: 0.4, y: 0.3, confidence: 0.3, timestamp: 200 },
      targets,
    ),
  ).toBeNull();
});

test('estimates normalized horizontal gaze from both iris positions', () => {
  const gaze = estimateGaze({
      leftEye: {
        innerCorner: { x: 0.2, y: 0.4 },
        outerCorner: { x: 0.4, y: 0.4 },
        upperLid: { x: 0.3, y: 0.3 },
        lowerLid: { x: 0.3, y: 0.5 },
        irisCenter: { x: 0.3, y: 0.4 },
        confidence: 0.9,
      },
      rightEye: {
        innerCorner: { x: 0.6, y: 0.4 },
        outerCorner: { x: 0.8, y: 0.4 },
        upperLid: { x: 0.7, y: 0.3 },
        lowerLid: { x: 0.7, y: 0.5 },
        irisCenter: { x: 0.7, y: 0.4 },
        confidence: 0.8,
      },
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
    leftEye: {
      innerCorner: { x: 0.4, y: 0.4 },
      outerCorner: { x: 0.2, y: 0.4 },
      upperLid: { x: 0.3, y: 0.3 },
      lowerLid: { x: 0.3, y: 0.5 },
      irisCenter: { x: 0.3, y: 0.4 },
      confidence: 0.9,
    },
    rightEye: {
      innerCorner: { x: 0.6, y: 0.4 },
      outerCorner: { x: 0.8, y: 0.4 },
      upperLid: { x: 0.7, y: 0.3 },
      lowerLid: { x: 0.7, y: 0.5 },
      irisCenter: { x: 0.7, y: 0.4 },
      confidence: 0.9,
    },
    timestamp: 400,
  };

  expect(estimateGaze(observation)).toBeNull();
  expect(estimateGaze({ ...observation, leftEye: { ...observation.leftEye, confidence: 0.2 } })).toBeNull();
});

test('estimates vertical gaze from iris position between the eyelids', () => {
  const gaze = estimateGaze({
    leftEye: {
      innerCorner: { x: 0.2, y: 0.4 },
      outerCorner: { x: 0.4, y: 0.4 },
      upperLid: { x: 0.3, y: 0.2 },
      lowerLid: { x: 0.3, y: 0.6 },
      irisCenter: { x: 0.3, y: 0.3 },
      confidence: 0.9,
    },
    rightEye: {
      innerCorner: { x: 0.6, y: 0.4 },
      outerCorner: { x: 0.8, y: 0.4 },
      upperLid: { x: 0.7, y: 0.2 },
      lowerLid: { x: 0.7, y: 0.6 },
      irisCenter: { x: 0.7, y: 0.3 },
      confidence: 0.9,
    },
    timestamp: 500,
  });

  expect(gaze?.y).toBeCloseTo(0.25);
});