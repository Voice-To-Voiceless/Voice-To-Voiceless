import { FaceTrackingLossTracker } from '../../src/vision/tracking/trackingReliability';

test('only reports sustained face loss after the configured frame threshold', () => {
  const tracker = new FaceTrackingLossTracker(3);

  expect(tracker.markLost()).toBe(false);
  expect(tracker.markLost()).toBe(false);
  expect(tracker.markLost()).toBe(true);
});

test('face reacquisition clears the loss streak', () => {
  const tracker = new FaceTrackingLossTracker(2);

  tracker.markLost();
  tracker.markDetected();

  expect(tracker.markLost()).toBe(false);
});