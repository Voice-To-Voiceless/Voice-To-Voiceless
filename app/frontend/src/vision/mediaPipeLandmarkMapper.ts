import { FaceLandmarkObservation, LandmarkPoint } from './landmarkTypes';

type MediaPipeLandmark = LandmarkPoint;

export function mapMediaPipeLandmarks(
  landmarks: MediaPipeLandmark[],
  timestamp: number,
  confidence: number,
): FaceLandmarkObservation | null {
  const requiredLandmarkIndices = [
    1, 6, 10, 33, 133, 145, 152, 159, 234, 263, 362, 374, 386, 454,
    468, 469, 470, 471, 472, 473, 474, 475, 476, 477,
  ];
  if (requiredLandmarkIndices.some(index => landmarks[index] === undefined)) {
    return null;
  }

  return {
    leftEye: {
      innerCorner: landmarks[133],
      outerCorner: landmarks[33],
      upperLid: landmarks[159],
      lowerLid: landmarks[145],
      irisCenter: landmarks[468],
      irisRing: landmarks.slice(468, 473),
      screenSide: 'left',
      confidence,
    },
    rightEye: {
      innerCorner: landmarks[362],
      outerCorner: landmarks[263],
      upperLid: landmarks[386],
      lowerLid: landmarks[374],
      irisCenter: landmarks[473],
      irisRing: landmarks.slice(473, 478),
      screenSide: 'right',
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