export type LandmarkPoint = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  presence?: number;
};

export type EyeObservation = {
  innerCorner: LandmarkPoint;
  outerCorner: LandmarkPoint;
  upperLid: LandmarkPoint;
  lowerLid: LandmarkPoint;
  irisCenter: LandmarkPoint;
  confidence: number;
};

export type FaceAnchors = {
  noseBridge: LandmarkPoint;
  noseTip: LandmarkPoint;
  forehead: LandmarkPoint;
  chin: LandmarkPoint;
  leftCheek: LandmarkPoint;
  rightCheek: LandmarkPoint;
};

export type FaceLandmarkObservation = {
  leftEye: EyeObservation;
  rightEye: EyeObservation;
  faceAnchors?: FaceAnchors;
  timestamp: number;
};

export type VisionFrame = {
  timestamp: number;
  data: unknown;
};