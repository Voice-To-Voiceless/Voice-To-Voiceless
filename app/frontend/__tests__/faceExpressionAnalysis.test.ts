import { analyzeFaceExpression, noFaceAnalysis } from '../src/browser/services/faceExpressionAnalysis';

test('recognizes a confident smile without risk indicators', () => {
  const result = analyzeFaceExpression({ mouthSmileLeft: 0.8, mouthSmileRight: 0.7 });

  expect(result.expression).toBe('possible_smile');
  expect(result.state).toBe('normal');
  expect(result.risk).toBe(0);
});

test('reports visible facial tension as possible discomfort', () => {
  const result = analyzeFaceExpression({ browDownLeft: 0.7, browDownRight: 0.7 });

  expect(result.expression).toBe('neutral');
  expect(result.state).toBe('possible_discomfort');
  expect(result.indicators).toContain('brow_tension');
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
