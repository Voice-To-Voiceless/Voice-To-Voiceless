import { estimateGaze } from '../src/vision/estimation/gazeEstimator';
import { mapMediaPipeLandmarks } from '../src/vision/mediapipe/mediaPipeLandmarkMapper';

export function createDirectionalLandmarks(screenX: number, screenY: number, roll = 0): Array<{ x: number; y: number }> {
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

  if (roll === 0) return landmarks;
  const cos = Math.cos(roll);
  const sin = Math.sin(roll);
  return landmarks.map(point => ({
    x: 0.5 + (point.x - 0.5) * cos - (point.y - 0.4) * sin,
    y: 0.4 + (point.x - 0.5) * sin + (point.y - 0.4) * cos,
  }));
}

export function estimateDirectionalGaze(screenX: number, screenY: number, roll = 0) {
  const observation = mapMediaPipeLandmarks(createDirectionalLandmarks(screenX, screenY, roll), 100, 0.9);
  expect(observation).not.toBeNull();
  return estimateGaze(observation!);
}