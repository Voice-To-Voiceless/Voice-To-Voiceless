import { mapMediaPipeLandmarks } from '../src/vision/mediaPipeLandmarkMapper';

const requiredIndices = [
  1, 6, 10, 33, 133, 145, 152, 159, 234, 263, 362, 374, 386, 454,
  468, 469, 470, 471, 472, 473, 474, 475, 476, 477,
];

function createLandmarks(): Array<{ x: number; y: number }> {
  const landmarks = Array.from({ length: 474 }, () => ({ x: 0.5, y: 0.5 }));
  requiredIndices.forEach(index => {
    landmarks[index] = { x: 0.5, y: 0.5 };
  });
  landmarks[33] = { x: 0.2, y: 0.4 };
  landmarks[133] = { x: 0.4, y: 0.4 };
  landmarks[159] = { x: 0.3, y: 0.3 };
  landmarks[145] = { x: 0.3, y: 0.5 };
  landmarks[468] = { x: 0.35, y: 0.4 };
  landmarks[469] = { x: 0.34, y: 0.39 };
  landmarks[470] = { x: 0.36, y: 0.39 };
  landmarks[471] = { x: 0.36, y: 0.41 };
  landmarks[472] = { x: 0.34, y: 0.41 };
  landmarks[362] = { x: 0.6, y: 0.4 };
  landmarks[263] = { x: 0.8, y: 0.4 };
  landmarks[386] = { x: 0.7, y: 0.3 };
  landmarks[374] = { x: 0.7, y: 0.5 };
  landmarks[473] = { x: 0.75, y: 0.4 };
  landmarks[474] = { x: 0.74, y: 0.39 };
  landmarks[475] = { x: 0.76, y: 0.39 };
  landmarks[476] = { x: 0.76, y: 0.41 };
  landmarks[477] = { x: 0.74, y: 0.41 };
  return landmarks;
}

test('maps canonical MediaPipe eye landmarks into left-to-right eye coordinates', () => {
  const observation = mapMediaPipeLandmarks(createLandmarks(), 123, 0.9);

  expect(observation).not.toBeNull();
  expect(observation?.leftEye).toEqual({
    innerCorner: { x: 0.4, y: 0.4 },
    outerCorner: { x: 0.2, y: 0.4 },
    upperLid: { x: 0.3, y: 0.3 },
    lowerLid: { x: 0.3, y: 0.5 },
    irisCenter: { x: 0.35, y: 0.4 },
    irisRing: [
      { x: 0.35, y: 0.4 }, { x: 0.34, y: 0.39 }, { x: 0.36, y: 0.39 },
      { x: 0.36, y: 0.41 }, { x: 0.34, y: 0.41 },
    ],
    screenSide: 'right',
    confidence: 0.9,
  });
  expect(observation?.rightEye).toEqual({
    innerCorner: { x: 0.6, y: 0.4 },
    outerCorner: { x: 0.8, y: 0.4 },
    upperLid: { x: 0.7, y: 0.3 },
    lowerLid: { x: 0.7, y: 0.5 },
    irisCenter: { x: 0.75, y: 0.4 },
    irisRing: [
      { x: 0.75, y: 0.4 }, { x: 0.74, y: 0.39 }, { x: 0.76, y: 0.39 },
      { x: 0.76, y: 0.41 }, { x: 0.74, y: 0.41 },
    ],
    screenSide: 'left',
    confidence: 0.9,
  });
});

test('rejects observations with a missing required landmark', () => {
  const landmarks = createLandmarks();
  landmarks[468] = undefined as never;

  expect(mapMediaPipeLandmarks(landmarks, 123, 0.9)).toBeNull();
});

test('preserves anatomical eye ordering when corner landmarks have slight roll', () => {
  const landmarks = createLandmarks();
  landmarks[33] = { x: 0.2, y: 0.45 };
  landmarks[133] = { x: 0.4, y: 0.35 };
  landmarks[362] = { x: 0.6, y: 0.35 };
  landmarks[263] = { x: 0.8, y: 0.45 };

  const observation = mapMediaPipeLandmarks(landmarks, 123, 0.9);

  expect(observation?.leftEye.innerCorner.x).toBeGreaterThan(observation!.leftEye.outerCorner.x);
  expect(observation?.rightEye.innerCorner.x).toBeLessThan(observation!.rightEye.outerCorner.x);
});
