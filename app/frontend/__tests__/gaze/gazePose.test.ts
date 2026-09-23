import { estimateGaze } from '../../src/vision/estimation/gazeEstimator';
import { compensateGazeForPose, estimateRelativeFacePose } from '../../src/vision/estimation/facePoseEstimator';

test('compensates eye-relative gaze for head roll', () => {
  const gaze = estimateGaze({
    leftEye: { innerCorner: { x: 0.2, y: 0.2 }, outerCorner: { x: 0.4, y: 0.3 }, upperLid: { x: 0.3447, y: 0.1606 }, lowerLid: { x: 0.2553, y: 0.3394 }, irisCenter: { x: 0.3, y: 0.25 }, confidence: 0.9 },
    rightEye: { innerCorner: { x: 0.6, y: 0.4 }, outerCorner: { x: 0.8, y: 0.5 }, upperLid: { x: 0.7447, y: 0.3606 }, lowerLid: { x: 0.6553, y: 0.5394 }, irisCenter: { x: 0.7, y: 0.45 }, confidence: 0.9 },
    timestamp: 700,
  });
  expect(gaze?.x).toBeCloseTo(0.5);
  expect(gaze?.y).toBeCloseTo(0.5);
});

test('estimates relative roll and scale from both eyes', () => {
  const pose = estimateRelativeFacePose({
    leftEye: { innerCorner: { x: 0.2, y: 0.2 }, outerCorner: { x: 0.4, y: 0.3 }, upperLid: { x: 0.3, y: 0.2 }, lowerLid: { x: 0.35, y: 0.4 }, irisCenter: { x: 0.3, y: 0.3 }, confidence: 0.9 },
    rightEye: { innerCorner: { x: 0.6, y: 0.4 }, outerCorner: { x: 0.8, y: 0.5 }, upperLid: { x: 0.7, y: 0.4 }, lowerLid: { x: 0.75, y: 0.6 }, irisCenter: { x: 0.7, y: 0.5 }, confidence: 0.9 },
    timestamp: 701,
  });
  expect(pose?.rollRadians).toBeCloseTo(Math.atan2(0.2, 0.4));
  expect(pose?.interEyeDistance).toBeCloseTo(Math.sqrt(0.4 ** 2 + 0.2 ** 2));
  expect(pose?.eyeScale).toBeCloseTo(Math.sqrt(0.2 ** 2 + 0.1 ** 2));
});

test('estimates bounded yaw and pitch when face anchors are available', () => {
  const pose = estimateRelativeFacePose({
    leftEye: { innerCorner: { x: 0.2, y: 0.4 }, outerCorner: { x: 0.4, y: 0.4 }, upperLid: { x: 0.3, y: 0.3 }, lowerLid: { x: 0.3, y: 0.5 }, irisCenter: { x: 0.3, y: 0.4 }, confidence: 0.9 },
    rightEye: { innerCorner: { x: 0.6, y: 0.4 }, outerCorner: { x: 0.8, y: 0.4 }, upperLid: { x: 0.7, y: 0.3 }, lowerLid: { x: 0.7, y: 0.5 }, irisCenter: { x: 0.7, y: 0.4 }, confidence: 0.9 },
    faceAnchors: { noseBridge: { x: 0.5, y: 0.45 }, noseTip: { x: 0.62, y: 0.65 }, forehead: { x: 0.5, y: 0.2 }, chin: { x: 0.5, y: 0.9 }, leftCheek: { x: 0.1, y: 0.5 }, rightCheek: { x: 0.9, y: 0.5 } },
    timestamp: 702,
  });
  expect(pose?.yaw).toBeCloseTo(0.15);
  expect(pose?.pitch).toBeCloseTo(0.1429, 3);
});

test('compensates only pose changes relative to the session reference', () => {
  const compensated = compensateGazeForPose({ x: 0.5, y: 0.5, confidence: 0.9, timestamp: 703 }, { rollRadians: 0, interEyeDistance: 0.4, eyeScale: 0.2, yaw: 0.2, pitch: 0.2 }, { yaw: 0.1, pitch: 0.1 }, { yawGain: 0.5, pitchGain: 0.5 });
  expect(compensated.x).toBeCloseTo(0.45);
  expect(compensated.y).toBeCloseTo(0.45);
});