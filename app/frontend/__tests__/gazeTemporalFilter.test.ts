import { GazeTemporalFilter, TemporalFilterInput } from '../src/vision/gazeTemporalFilter';

function input(timestamp: number, x: number, y = x, overrides: Partial<Omit<TemporalFilterInput, 'diagnostics'>> & { diagnostics?: Partial<TemporalFilterInput['diagnostics']> } = {}): TemporalFilterInput {
  return {
    gaze: { x, y, confidence: 0.9, timestamp },
    leftConfidence: 0.9,
    rightConfidence: 0.9,
    ...overrides,
    diagnostics: {
      leftPosition: { x, y },
      rightPosition: { x, y },
      leftAperture: 0.3,
      rightAperture: 0.3,
      eyeDisagreement: 0,
      ...overrides.diagnostics,
    },
  };
}

test('median-filters a short iris-position spike', () => {
  const filter = new GazeTemporalFilter({ maximumVelocity: 10 });

  filter.update(input(0, 0.2));
  filter.update(input(40, 0.4));
  const result = filter.update(input(80, 0.2));

  expect(result.accepted).toBe(true);
  expect(result.gaze?.x).toBeCloseTo(0.2);
});

test.each([
  ['closed-eye', { diagnostics: { leftAperture: 0.1 } }],
  ['binocular-disagreement', { diagnostics: { eyeDisagreement: 0.3 } }],
] as const)('rejects %s observations', (reason, overrides) => {
  const result = new GazeTemporalFilter().update(input(0, 0.5, 0.5, overrides));

  expect(result).toMatchObject({ accepted: false, rejectionReason: reason, gaze: null });
});

test('rejects a non-finite value and implausible velocity spike', () => {
  const filter = new GazeTemporalFilter({ maximumVelocity: 1 });

  expect(filter.update(input(0, Number.NaN)).rejectionReason).toBe('non-finite');
  expect(filter.update(input(0, 0.2)).accepted).toBe(true);
  expect(filter.update(input(16, 0.8)).rejectionReason).toBe('velocity-spike');
});

test('reset clears stale samples', () => {
  const filter = new GazeTemporalFilter({ maximumVelocity: 1 });

  filter.update(input(0, 0.2));
  filter.reset();

  expect(filter.update(input(1000, 0.8)).gaze?.x).toBeCloseTo(0.8);
});