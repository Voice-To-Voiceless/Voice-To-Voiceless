import { analyzeFaceExpression, noFaceAnalysis } from '../src/browser/services/faceExpressionAnalysis';

test('recognizes a confident smile without risk indicators', () => {
  const result = analyzeFaceExpression({ mouthSmileLeft: 0.8, mouthSmileRight: 0.7 });

  expect(result.expression).toBe('possible_smile');
  expect(result.state).toBe('normal');
  expect(result.risk).toBe(0);
});

test('detects an open mouth while smiling', () => {
  const result = analyzeFaceExpression({
    mouthSmileLeft: 0.8,
    mouthSmileRight: 0.7,
    jawOpen: 0.2,
    eyeSquintLeft: 0.5,
    eyeSquintRight: 0.5,
  });

  expect(result.expression).toBe('possible_smile');
  expect(result.indicators).toContain('mouth_open');
  expect(result.state).toBe('possible_discomfort');
});

test('reports visible facial tension as possible discomfort', () => {
  const result = analyzeFaceExpression({ browDownLeft: 0.7, browDownRight: 0.7 });

  expect(result.expression).toBe('neutral');
  expect(result.state).toBe('possible_discomfort');
  expect(result.indicators).toContain('brow_tension');
});

test('ignores low one-sided eye squint noise', () => {
  const result = analyzeFaceExpression({ eyeSquintLeft: 0.3, eyeSquintRight: 0.1 });

  expect(result.indicators).not.toContain('eye_tension');
});

test('does not flag normal bilateral eye scores', () => {
  const result = analyzeFaceExpression({ eyeSquintLeft: 0.45, eyeSquintRight: 0.45 });

  expect(result.indicators).not.toContain('eye_tension');
});

test('returns a stable no-face snapshot', () => {
  expect(noFaceAnalysis()).toEqual({
    state: 'no_face',
    risk: 0,
    indicators: [],
    expression: 'no_face',
    confidence: 0,
  });
});
