import { findGazeTarget } from '../src/vision/gazeTarget';
import { estimateGaze, getGazeDiagnostics } from '../src/vision/gazeEstimator';
import { GazeSmoother } from '../src/vision/gazeSmoother';
import { getEyeAperture, getEyePositionDiagnostics } from '../src/vision/eyePosition';
import { compensateGazeForPose, estimateRelativeFacePose } from '../src/vision/facePoseEstimator';
import { mapMediaPipeLandmarks } from '../src/vision/mediaPipeLandmarkMapper';

function createDirectionalLandmarks(screenX: number, screenY: number, roll = 0): Array<{ x: number; y: number }> {
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  const leftInner = { x: 0.4, y: 0.4 };
  const leftOuter = { x: 0.2, y: 0.4 };
  const rightInner = { x: 0.6, y: 0.4 };
  const rightOuter = { x: 0.8, y: 0.4 };
  const leftIrisX = leftInner.x + (leftOuter.x - leftInner.x) * (1 - screenX);
  const rightIrisX = rightInner.x + (rightOuter.x - rightInner.x) * screenX;
  const irisY = 0.3 + screenY * 0.2;

  landmarks[33] = leftOuter;
  landmarks[133] = leftInner;
  landmarks[159] = { x: 0.3, y: 0.3 };
  landmarks[145] = { x: 0.3, y: 0.5 };
  landmarks[468] = { x: leftIrisX, y: irisY };
  landmarks[469] = { x: leftIrisX - 0.01, y: irisY - 0.01 };
  landmarks[470] = { x: leftIrisX + 0.01, y: irisY - 0.01 };
  landmarks[471] = { x: leftIrisX + 0.01, y: irisY + 0.01 };
  landmarks[472] = { x: leftIrisX - 0.01, y: irisY + 0.01 };
  landmarks[362] = rightInner;
  landmarks[263] = rightOuter;
  landmarks[386] = { x: 0.7, y: 0.3 };
  landmarks[374] = { x: 0.7, y: 0.5 };
  landmarks[473] = { x: rightIrisX, y: irisY };
  landmarks[474] = { x: rightIrisX - 0.01, y: irisY - 0.01 };
  landmarks[475] = { x: rightIrisX + 0.01, y: irisY - 0.01 };
  landmarks[476] = { x: rightIrisX + 0.01, y: irisY + 0.01 };
  landmarks[477] = { x: rightIrisX - 0.01, y: irisY + 0.01 };

  if (roll === 0) {
    return landmarks;
  }

  const cos = Math.cos(roll);
  const sin = Math.sin(roll);
  return landmarks.map(point => ({
    x: 0.5 + (point.x - 0.5) * cos - (point.y - 0.4) * sin,
    y: 0.4 + (point.x - 0.5) * sin + (point.y - 0.4) * cos,
  }));
}

function estimateDirectionalGaze(screenX: number, screenY: number, roll = 0) {
  const observation = mapMediaPipeLandmarks(createDirectionalLandmarks(screenX, screenY, roll), 100, 0.9);
  expect(observation).not.toBeNull();
  return estimateGaze(observation!);
}

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

test('rejects the raw pipeline when one mapped eye is closed', () => {
  const landmarks = createDirectionalLandmarks(0.5, 0.5);
  landmarks[159] = { x: 0.3, y: 0.4 };
  landmarks[145] = { x: 0.3, y: 0.41 };

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
    timestamp: 400,
  };

  expect(estimateGaze(observation)).toBeNull();
  expect(estimateGaze({ ...observation, leftEye: { ...observation.leftEye, confidence: 0.2 } })).toBeNull();
});

test('estimates vertical gaze from iris position relative to the eye-corner midpoint', () => {
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

  expect(gaze?.y).toBe(0);
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

test('compares projected and direct midpoint iris horizontal positions', () => {
  const diagnostics = getEyePositionDiagnostics({
    innerCorner: { x: 0.2, y: 0.4 },
    outerCorner: { x: 0.4, y: 0.4 },
    upperLid: { x: 0.3, y: 0.3 },
    lowerLid: { x: 0.3, y: 0.5 },
    irisCenter: { x: 0.34, y: 0.4 },
    confidence: 0.9,
  });

  expect(diagnostics.eyeMidpoint).toEqual({ x: 0.30000000000000004, y: 0.4 });
  expect(diagnostics.eyeWidth).toBeCloseTo(0.2);
  expect(diagnostics.position?.x).toBeCloseTo(0.7);
  expect(diagnostics.position?.y).toBeCloseTo(0.5);
  expect(diagnostics.directHorizontalPosition).toBeCloseTo(0.7);
});

test('normalizes vertical iris position from the eye-corner midpoint and eye width', () => {
  const diagnostics = getEyePositionDiagnostics({
    innerCorner: { x: 0.2, y: 0.4 },
    outerCorner: { x: 0.4, y: 0.4 },
    upperLid: { x: 0.3, y: 0.3 },
    lowerLid: { x: 0.3, y: 0.5 },
    irisCenter: { x: 0.3, y: 0.5 },
    confidence: 0.9,
  });

  expect(diagnostics.position?.y).toBeCloseTo(1);
});

test('normalizes mapped eyes into the same screen-horizontal direction', () => {
  const baseEye = {
    innerCorner: { x: 0.4, y: 0.4 },
    outerCorner: { x: 0.2, y: 0.4 },
    upperLid: { x: 0.3, y: 0.3 },
    lowerLid: { x: 0.3, y: 0.5 },
    irisCenter: { x: 0.35, y: 0.4 },
    confidence: 0.9,
  };
  const screenLeft = getEyePositionDiagnostics({ ...baseEye, screenSide: 'left' });
  const screenRight = getEyePositionDiagnostics({
    ...baseEye,
    innerCorner: { x: 0.6, y: 0.4 },
    outerCorner: { x: 0.8, y: 0.4 },
    irisCenter: { x: 0.75, y: 0.4 },
    screenSide: 'right',
  });

  expect(screenLeft.position?.x).toBeCloseTo(0.75);
  expect(screenRight.position?.x).toBeCloseTo(0.75);
  expect(screenLeft.directHorizontalPosition).toBeCloseTo(0.75);
  expect(screenRight.directHorizontalPosition).toBeCloseTo(0.75);
});