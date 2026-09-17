import { ModelTestingSession } from '../src/modelTesting/modelTestingSession';

test('rejects pose calibration when leave-one-target-out validation fails', () => {
  const session = new ModelTestingSession();
  const targets = [
    { x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.9, y: 0.1 },
    { x: 0.1, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.5 },
    { x: 0.1, y: 0.9 }, { x: 0.5, y: 0.9 }, { x: 0.9, y: 0.9 },
  ];
  session.startPass(targets);

  targets.forEach(target => {
    session.recordCalibrationSample(target, {
      raw: { ...target, confidence: 0.9, timestamp: 1 },
      compensated: { ...target, confidence: 0.9, timestamp: 1 },
      pose: { yaw: 0, pitch: 0, eyeScale: 0.05, interEyeDistance: 0.12 },
      quality: { accepted: true, rejectionReasons: [] },
    });
    session.recordPrimarySample({ gaze: target, target });
  });

  const snapshot = session.getDiagnosticsSnapshot();
  const training = snapshot.calibrationFitComparison.training;

  expect(training.poseConditioned.accepted).toBe(false);
  expect(training.poseLeaveOneTargetOut.accepted).toBe(false);
  expect(training.poseConditioned.rejectionReason).toBe('singular calibration matrix');
});

test('exports validation pose feature ranges', () => {
  const session = new ModelTestingSession();
  const target = { x: 0.5, y: 0.5 };
  session.startPass([target]);
  session.recordCalibrationSample(target, {
    raw: { ...target, confidence: 0.9, timestamp: 1 },
    compensated: { ...target, confidence: 0.9, timestamp: 1 },
    pose: { yaw: 0.1, pitch: 0.2, eyeScale: 0.05, interEyeDistance: 0.12 },
    quality: { accepted: true, rejectionReasons: [] },
  });
  session.recordPrimarySample({ gaze: target, target });
  session.startPass([target]);
  session.recordCalibrationSample(target, {
    raw: { ...target, confidence: 0.9, timestamp: 2 },
    compensated: { ...target, confidence: 0.9, timestamp: 2 },
    pose: { yaw: 0.3, pitch: 0.4, eyeScale: 0.07, interEyeDistance: 0.14 },
    quality: { accepted: true, rejectionReasons: [] },
  });
  session.recordPrimarySample({ gaze: target, target });

  expect(session.getDiagnosticsSnapshot().calibrationFitComparison.validation?.poseFeatureRanges).toEqual({
    yaw: { min: 0.3, max: 0.3, range: 0, mean: 0.3 },
    pitch: { min: 0.4, max: 0.4, range: 0, mean: 0.4 },
    eyeScale: { min: 0.07, max: 0.07, range: 0, mean: 0.07 },
    interEyeDistance: { min: 0.14, max: 0.14, range: 0, mean: 0.14 },
  });
});