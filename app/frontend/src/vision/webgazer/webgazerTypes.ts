export type WebGazerScreenPoint = { x: number; y: number };

export type WebGazerPrediction = WebGazerScreenPoint & {
  timestamp: number;
};

export type WebGazerValidationSample = {
  target: WebGazerScreenPoint;
  prediction: WebGazerPrediction;
};
