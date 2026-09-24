import { findGazeTarget } from '../../src/vision/estimation/gazeTarget';
import { BinocularVerticalOffsetEstimator, estimateGaze, getGazeDiagnostics } from '../../src/vision/estimation/gazeEstimator';
import { GazeSmoother } from '../../src/vision/temporal/gazeSmoother';
import { getEyeAperture } from '../../src/vision/estimation/eyePosition';
import { mapMediaPipeLandmarks } from '../../src/vision/mediapipe/mediaPipeLandmarkMapper';
import { createDirectionalLandmarks, estimateDirectionalGaze } from '../../test-utils/gazeTestHelpers';

test('preserves horizontal and vertical direction through the raw landmark pipeline', () => {
  const left = estimateDirectionalGaze(0.2, 0.5);
  const center = estimateDirectionalGaze(0.5, 0.5);
  const right = estimateDirectionalGaze(0.8, 0.5);
  const up = estimateDirectionalGaze(0.5, 0.25);
  const down = estimateDirectionalGaze(0.5, 0.75);

  expect(left).not.toBeNull();
  expect(center).not.toBeNull();
  expect(right).not.toBeNull();
  expect(up).not.toBeNull();
  expect(down).not.toBeNull();
  expect(left!.x).toBeLessThan(center!.x);
  expect(center!.x).toBeLessThan(right!.x);
  expect(up!.y).toBeLessThan(center!.y);
  expect(center!.y).toBeLessThan(down!.y);
  expect(estimateDirectionalGaze(0.5, 0.5, Math.PI / 18)?.x).toBeCloseTo(0.5, 2);
  expect(estimateDirectionalGaze(0.5, 0.5, Math.PI / 18)?.y).toBeCloseTo(0.5, 2);
});

test('estimates and applies the median left-right vertical eye offset', () => {
  const estimator = new BinocularVerticalOffsetEstimator();
  estimator.update({ leftPosition: { x: 0.4, y: 0.58 }, rightPosition: { x: 0.6, y: 0.5 }, leftAperture: 0.4, rightAperture: 0.4, eyeDisagreement: 0.2 });
  estimator.update({ leftPosition: { x: 0.4, y: 0.56 }, rightPosition: { x: 0.6, y: 0.5 }, leftAperture: 0.4, rightAperture: 0.4, eyeDisagreement: 0.2 });
  estimator.update({ leftPosition: { x: 0.4, y: 0.59 }, rightPosition: { x: 0.6, y: 0.5 }, leftAperture: 0.4, rightAperture: 0.4, eyeDisagreement: 0.2 });

  expect(estimator.current).toBeCloseTo(0.08);
  expect(getGazeDiagnostics({
    leftEye: { innerCorner: { x: 0.2, y: 0.4 }, outerCorner: { x: 0.4, y: 0.4 }, upperLid: { x: 0.3, y: 0.3 }, lowerLid: { x: 0.3, y: 0.5 }, irisCenter: { x: 0.3, y: 0.4 }, confidence: 0.9 },
    rightEye: { innerCorner: { x: 0.6, y: 0.4 }, outerCorner: { x: 0.8, y: 0.4 }, upperLid: { x: 0.7, y: 0.3 }, lowerLid: { x: 0.7, y: 0.5 }, irisCenter: { x: 0.7, y: 0.4 }, confidence: 0.9 },
    timestamp: 0,
  }, estimator.current).leftPosition?.y).toBeCloseTo(0.42);
});

test('rejects the raw pipeline when one mapped eye is closed', () => {
  const landmarks = createDirectionalLandmarks(0.5, 0.5);
  landmarks[159] = { x: 0.3, y: 0.4 };
  landmarks[145] = { x: 0.3, y: 0.41 };
  [160, 158, 157].forEach(index => { landmarks[index] = { x: 0.3, y: 0.4 }; });
  [144, 153, 154, 155].forEach(index => { landmarks[index] = { x: 0.3, y: 0.41 }; });

  const observation = mapMediaPipeLandmarks(landmarks, 101, 0.9);

  expect(observation).not.toBeNull();
  expect(estimateGaze(observation!)).toBeNull();
});

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

test('resets smoothing history after tracking is interrupted', () => {
  const smoother = new GazeSmoother(0.5);

  smoother.update({ x: 0.2, y: 0.2, confidence: 1, timestamp: 0 });
  smoother.update({ x: 0.8, y: 0.8, confidence: 1, timestamp: 100 });
  smoother.reset();

  expect(smoother.update({ x: 0.8, y: 0.8, confidence: 1, timestamp: 200 })).toEqual({
    x: 0.8,
    y: 0.8,
    confidence: 1,
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

test('estimates vertical gaze from iris position relative to eye width', () => {
  const gaze = estimateGaze({
    leftEye: {
      innerCorner: { x: 0.2, y: 0.4 },
      outerCorner: { x: 0.4, y: 0.4 },
      upperLid: { x: 0.3, y: 0.2 },
      lowerLid: { x: 0.3, y: 0.6 },
      irisCenter: { x: 0.3, y: 0.35 },
      confidence: 0.9,
    },
    rightEye: {
      innerCorner: { x: 0.6, y: 0.4 },
      outerCorner: { x: 0.8, y: 0.4 },
      upperLid: { x: 0.7, y: 0.2 },
      lowerLid: { x: 0.7, y: 0.6 },
      irisCenter: { x: 0.7, y: 0.35 },
      confidence: 0.9,
    },
    timestamp: 500,
  });

  expect(gaze?.y).toBeCloseTo(0.25);
});

test('weights gaze toward the eye with higher confidence', () => {
  const gaze = estimateGaze({
    leftEye: {
      innerCorner: { x: 0.2, y: 0.4 },
      outerCorner: { x: 0.4, y: 0.4 },
      upperLid: { x: 0.3, y: 0.3 },
      lowerLid: { x: 0.3, y: 0.5 },
      irisCenter: { x: 0.24, y: 0.4 },
      confidence: 0.9,
    },
    rightEye: {
      innerCorner: { x: 0.6, y: 0.4 },
      outerCorner: { x: 0.8, y: 0.4 },
      upperLid: { x: 0.7, y: 0.3 },
      lowerLid: { x: 0.7, y: 0.5 },
      irisCenter: { x: 0.78, y: 0.4 },
      confidence: 0.3,
    },
    timestamp: 550,
  }, 0.2);

  expect(gaze?.x).toBeCloseTo(0.375);
});

test('reports binocular disagreement without changing gaze acceptance', () => {
  const observation = {
    leftEye: {
      innerCorner: { x: 0.2, y: 0.4 },
      outerCorner: { x: 0.4, y: 0.4 },
      upperLid: { x: 0.3, y: 0.3 },
      lowerLid: { x: 0.3, y: 0.5 },
      irisCenter: { x: 0.24, y: 0.4 },
      confidence: 0.9,
    },
    rightEye: {
      innerCorner: { x: 0.6, y: 0.4 },
      outerCorner: { x: 0.8, y: 0.4 },
      upperLid: { x: 0.7, y: 0.3 },
      lowerLid: { x: 0.7, y: 0.5 },
      irisCenter: { x: 0.78, y: 0.4 },
      confidence: 0.9,
    },
    timestamp: 560,
  };

  const diagnostics = getGazeDiagnostics(observation);

  expect(diagnostics.leftPosition).not.toBeNull();
  expect(diagnostics.rightPosition).not.toBeNull();
  expect(diagnostics.eyeDisagreement).toBeCloseTo(0.7);
  expect(estimateGaze(observation)).not.toBeNull();
});

test('rejects an eye when its aperture indicates a closed eye', () => {
  const eye = {
    innerCorner: { x: 0.2, y: 0.4 },
    outerCorner: { x: 0.4, y: 0.4 },
    upperLid: { x: 0.3, y: 0.4 },
    lowerLid: { x: 0.3, y: 0.41 },
    irisCenter: { x: 0.3, y: 0.4 },
    confidence: 0.9,
  };

  expect(getEyeAperture(eye)).toBeCloseTo(0.05);
  expect(estimateGaze({ leftEye: eye, rightEye: { ...eye, irisCenter: { x: 0.7, y: 0.4 } }, timestamp: 600 })).toBeNull();
});

