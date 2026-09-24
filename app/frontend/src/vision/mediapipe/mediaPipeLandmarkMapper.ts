import { FaceLandmarkObservation, LandmarkPoint } from '../types/landmarkTypes';

type MediaPipeLandmark = LandmarkPoint;

export function mapMediaPipeLandmarks(
  landmarks: MediaPipeLandmark[],
  timestamp: number,
  confidence: number,
): FaceLandmarkObservation | null {
  const requiredLandmarkIndices = [
    1, 6, 10, 33, 133, 144, 145, 152, 153, 154, 155, 157, 158, 159, 160, 234, 263, 362, 373, 374, 380, 381, 382, 384, 385, 386, 387, 454,
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
      upperLidContour: [landmarks[160], landmarks[159], landmarks[158], landmarks[157]],
      lowerLidContour: [landmarks[144], landmarks[145], landmarks[153], landmarks[154], landmarks[155]],
      irisCenter: landmarks[468],
        irisRing: landmarks.slice(469, 473),
      screenSide: 'left',
      confidence,
    },
    rightEye: {
      innerCorner: landmarks[362],
      outerCorner: landmarks[263],
      upperLid: landmarks[386],
      lowerLid: landmarks[374],
      upperLidContour: [landmarks[387], landmarks[386], landmarks[385], landmarks[384]],
      lowerLidContour: [landmarks[373], landmarks[374], landmarks[380], landmarks[381], landmarks[382]],
      irisCenter: landmarks[473],
        irisRing: landmarks.slice(474, 478),
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