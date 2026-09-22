export type FaceState =
  | 'normal'
  | 'no_face'
  | 'possible_discomfort'
  | 'attention_required';

export type FaceExpression =
  | 'neutral'
  | 'no_face'
  | 'possible_sadness'
  | 'possible_smile';

export type FaceAnalysis = {
  state: FaceState;
  risk: number;
  indicators: string[];
  expression: FaceExpression;
  confidence: number;
};

type BlendshapeScores = Record<string, number | undefined>;

export function analyzeFaceExpression(scores: BlendshapeScores): FaceAnalysis {
  const smile = average(scores.mouthSmileLeft, scores.mouthSmileRight);
  const frown = average(scores.mouthFrownLeft, scores.mouthFrownRight);
  const sadness = Math.min(0.75 * frown + 0.25 * value(scores.browInnerUp), 1);
  const expression: FaceExpression = smile >= 0.4 && smile >= sadness
    ? 'possible_smile'
    : sadness >= 0.25
      ? 'possible_sadness'
      : 'neutral';
  const confidence = Math.max(smile, sadness);

  const indicators: string[] = [];
  let risk = 0;
  risk = addIndicator(indicators, risk, 'brow_tension', max(scores.browDownLeft, scores.browDownRight), 0.4);
  risk = addIndicator(indicators, risk, 'eye_tension', average(scores.eyeSquintLeft, scores.eyeSquintRight), 0.4, 0.5);
  const mouthOpen = Math.max(
    value(scores.jawOpen),
    value(scores.mouthLowerDownLeft),
    value(scores.mouthLowerDownRight),
  );
  risk = addIndicator(indicators, risk, 'mouth_open', mouthOpen, 0.4, 0.08);
  const discomfort = Math.max(
    value(scores.mouthFrownLeft), value(scores.mouthFrownRight), value(scores.mouthPressLeft),
    value(scores.mouthPressRight), value(scores.mouthStretchLeft), value(scores.mouthStretchRight),
    value(scores.noseSneerLeft), value(scores.noseSneerRight),
  );
  risk = addIndicator(indicators, risk, 'mouth_discomfort', discomfort, 0.4);
  const boundedRisk = Math.min(risk, 1);
  return {
    state: boundedRisk >= 0.45 ? 'attention_required' : boundedRisk >= 0.25 ? 'possible_discomfort' : 'normal',
    risk: boundedRisk,
    indicators,
    expression,
    confidence,
  };
}

export function noFaceAnalysis(): FaceAnalysis {
  return { state: 'no_face', risk: 0, indicators: [], expression: 'no_face', confidence: 0 };
}

function addIndicator(
  indicators: string[],
  risk: number,
  name: string,
  score: number,
  multiplier: number,
  threshold = 0.25,
): number {
  if (score <= threshold) return risk;
  indicators.push(name);
  return risk + Math.min(score * multiplier, multiplier);
}

function value(score: number | undefined): number { return score ?? 0; }
function max(first: number | undefined, second: number | undefined): number { return Math.max(value(first), value(second)); }
function average(first: number | undefined, second: number | undefined): number { return (value(first) + value(second)) / 2; }
