import { FaceLandmarkObservation, LandmarkPoint } from './landmarkTypes';

type MediaPipeLandmark = LandmarkPoint;

export function mapMediaPipeLandmarks(
  landmarks: MediaPipeLandmark[],
  timestamp: number,
  confidence: number,
): FaceLandmarkObservation | null {
  const requiredLandmarkIndices = [1, 6, 10, 33, 133, 145, 152, 159, 234, 263, 362, 374, 386, 454, 468, 473];
  if (requiredLandmarkIndices.some(index => landmarks[index] === undefined)) {
    return null;
  }

  const leftCornerA = landmarks[33];
  const leftCornerB = landmarks[133];
  const rightCornerA = landmarks[362];
  const rightCornerB = landmarks[263];

  return {
    leftEye: {
      innerCorner: leftCornerA.x <= leftCornerB.x ? leftCornerA : leftCornerB,
      outerCorner: leftCornerA.x <= leftCornerB.x ? leftCornerB : leftCornerA,
      upperLid: landmarks[159],
      lowerLid: landmarks[145],
      irisCenter: landmarks[468],
      confidence,
    },
    rightEye: {
      innerCorner: rightCornerA.x <= rightCornerB.x ? rightCornerA : rightCornerB,
      outerCorner: rightCornerA.x <= rightCornerB.x ? rightCornerB : rightCornerA,
      upperLid: landmarks[386],
      lowerLid: landmarks[374],
      irisCenter: landmarks[473],
      confidence,
    },
    faceAnchors: {
      noseBridge: landmarks[6],
      noseTip: landmarks[1],
      forehead: landmarks[10],
      chin: landmarks[152],
      leftCheek: landmarks[234],
      rightCheek: landmarks[454],
    },
    timestamp,
  };
}