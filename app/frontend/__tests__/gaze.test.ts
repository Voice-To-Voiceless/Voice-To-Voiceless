import { findGazeTarget } from '../src/vision/gazeTarget';
import { estimateGaze } from '../src/vision/gazeEstimator';
import { GazeSmoother } from '../src/vision/gazeSmoother';
import { getEyeAperture } from '../src/vision/eyePosition';
import { compensateGazeForPose, estimateRelativeFacePose } from '../src/vision/facePoseEstimator';

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

test('compensates eye-relative gaze for head roll', () => {
  const gaze = estimateGaze({
    leftEye: {
      innerCorner: { x: 0.2, y: 0.2 },
      outerCorner: { x: 0.4, y: 0.3 },
      upperLid: { x: 0.3447, y: 0.1606 },
      lowerLid: { x: 0.2553, y: 0.3394 },
      irisCenter: { x: 0.3, y: 0.25 },
      confidence: 0.9,
    },
    rightEye: {
      innerCorner: { x: 0.6, y: 0.4 },
      outerCorner: { x: 0.8, y: 0.5 },
      upperLid: { x: 0.7447, y: 0.3606 },
      lowerLid: { x: 0.6553, y: 0.5394 },
      irisCenter: { x: 0.7, y: 0.45 },
      confidence: 0.9,
    },
    timestamp: 700,
  });

  expect(gaze?.x).toBeCloseTo(0.5);
  expect(gaze?.y).toBeCloseTo(0.5);
});

test('estimates relative roll and scale from both eyes', () => {
  const pose = estimateRelativeFacePose({
    leftEye: {
      innerCorner: { x: 0.2, y: 0.2 },
      outerCorner: { x: 0.4, y: 0.3 },
      upperLid: { x: 0.3, y: 0.2 },
      lowerLid: { x: 0.35, y: 0.4 },
      irisCenter: { x: 0.3, y: 0.3 },
      confidence: 0.9,
    },
    rightEye: {
      innerCorner: { x: 0.6, y: 0.4 },
      outerCorner: { x: 0.8, y: 0.5 },
      upperLid: { x: 0.7, y: 0.4 },
      lowerLid: { x: 0.75, y: 0.6 },
      irisCenter: { x: 0.7, y: 0.5 },
      confidence: 0.9,
    },
    timestamp: 701,
  });

  expect(pose?.rollRadians).toBeCloseTo(Math.atan2(0.2, 0.4));
  expect(pose?.interEyeDistance).toBeCloseTo(Math.sqrt(0.4 ** 2 + 0.2 ** 2));
  expect(pose?.eyeScale).toBeCloseTo(Math.sqrt(0.2 ** 2 + 0.1 ** 2));
});

test('estimates bounded yaw and pitch when face anchors are available', () => {
  const pose = estimateRelativeFacePose({
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
      confidence: 0.9,
    },
    faceAnchors: {
      noseBridge: { x: 0.5, y: 0.45 },
      noseTip: { x: 0.62, y: 0.65 },
      forehead: { x: 0.5, y: 0.2 },
      chin: { x: 0.5, y: 0.9 },
      leftCheek: { x: 0.1, y: 0.5 },
      rightCheek: { x: 0.9, y: 0.5 },
    },
    timestamp: 702,
  });

  expect(pose?.yaw).toBeCloseTo(0.15);
  expect(pose?.pitch).toBeCloseTo(0.1429, 3);
});

test('compensates only pose changes relative to the session reference', () => {
  const compensated = compensateGazeForPose(
    { x: 0.5, y: 0.5, confidence: 0.9, timestamp: 703 },
    {
      rollRadians: 0,
      interEyeDistance: 0.4,
      eyeScale: 0.2,
      yaw: 0.2,
      pitch: 0.2,
    },
    { yaw: 0.1, pitch: 0.1 },
    { yawGain: 0.5, pitchGain: 0.5 },
  );

  expect(compensated.x).toBeCloseTo(0.45);
  expect(compensated.y).toBeCloseTo(0.45);
});