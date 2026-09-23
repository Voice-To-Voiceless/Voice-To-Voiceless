export type NormalizedGazePoint = {
  x: number;
  y: number;
  confidence: number;
  timestamp: number;
};

export type GazeTargetBounds = {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
};