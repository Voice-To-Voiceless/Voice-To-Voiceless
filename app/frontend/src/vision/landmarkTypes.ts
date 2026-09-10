export type LandmarkPoint = {
  x: number;
  y: number;
};

export type EyeObservation = {
  innerCorner: LandmarkPoint;
  outerCorner: LandmarkPoint;
  upperLid: LandmarkPoint;
  lowerLid: LandmarkPoint;
  irisCenter: LandmarkPoint;
  confidence: number;
};

export type FaceLandmarkObservation = {
  leftEye: EyeObservation;
  rightEye: EyeObservation;
  timestamp: number;
};

export type VisionFrame = {
  timestamp: number;
  data: unknown;
};