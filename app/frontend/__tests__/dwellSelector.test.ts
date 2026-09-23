import { DwellSelector } from '../src/interaction/dwellSelector';

test('completes a dwell only after the configured duration', () => {
  const selector = new DwellSelector(1500);

  selector.begin('help', 1000);

  expect(selector.update('help', 2499)).toBeNull();
  expect(selector.update('help', 2500)).toEqual({
    targetId: 'help',
    completedAt: 2500,
  });
});

test('restarts the dwell when the target changes', () => {
  const selector = new DwellSelector(1000);

  selector.begin('help', 1000);

  expect(selector.update('water', 1900)).toBeNull();
  expect(selector.update('water', 2899)).toBeNull();
  expect(selector.update('water', 2900)).toEqual({
    targetId: 'water',
    completedAt: 2900,
  });
});

test('preserves progress during a brief target loss', () => {
  const selector = new DwellSelector(1000, 250);

  selector.begin('help', 1000);
  selector.update('help', 1700);

  expect(selector.update(null, 1800)).toBeNull();
  expect(selector.getActiveTargetId()).toBe('help');
  expect(selector.progress('help', 1800)).toBeCloseTo(0.8);
  expect(selector.update('help', 1900)).toBeNull();
  expect(selector.update('help', 2000)).toEqual({ targetId: 'help', completedAt: 2000 });
});

test('resets after the grace period expires', () => {
  const selector = new DwellSelector(1000, 250);

  selector.begin('help', 1000);
  selector.update(null, 1250);
  expect(selector.update(null, 1251)).toBeNull();
  expect(selector.getActiveTargetId()).toBeNull();
});

test('face-loss cancellation cannot be restored by a stale candidate', () => {
  const selector = new DwellSelector(1000, 250);

  selector.begin('help', 1000);
  selector.cancel();

  expect(selector.update('help', 1100)).toBeNull();
  expect(selector.progress('help', 1100)).toBe(0);
});

test('requires two stable candidate updates before dwell progress begins', () => {
  const selector = new DwellSelector(1000);

  expect(selector.update('help', 1000)).toBeNull();
  expect(selector.progress('help', 1500)).toBe(0);
  expect(selector.update('help', 1600)).toBeNull();
  expect(selector.progress('help', 1600)).toBeCloseTo(0.6);
});