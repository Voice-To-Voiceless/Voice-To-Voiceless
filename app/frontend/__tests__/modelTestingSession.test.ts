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
  expect(session.getDiagnosticsSnapshot().calibrationFitComparison.training.poseFeatureRanges).toEqual({
    yaw: { min: 0.1, max: 0.1, range: 0, mean: 0.1 },
    pitch: { min: 0.2, max: 0.2, range: 0, mean: 0.2 },
    eyeScale: { min: 0.05, max: 0.05, range: 0, mean: 0.05 },
    interEyeDistance: { min: 0.12, max: 0.12, range: 0, mean: 0.12 },
  });
  expect(session.getDiagnosticsSnapshot().calibrationFitComparison.poseDistributionShift).toEqual({
    yaw: false,
    pitch: false,
    eyeScale: false,
    interEyeDistance: false,
  });
});

test('flags validation pose ranges that exceed training by more than fifty percent', () => {
  const session = new ModelTestingSession();
  const target = { x: 0.5, y: 0.5 };
  session.startPass([target, target]);
  [0, 1].forEach(value => {
    session.recordCalibrationSample(target, {
      raw: { ...target, confidence: 0.9, timestamp: value },
      compensated: { ...target, confidence: 0.9, timestamp: value },
      pose: { yaw: value, pitch: value, eyeScale: value, interEyeDistance: value },
      quality: { accepted: true, rejectionReasons: [] },
    });
    session.recordPrimarySample({ gaze: target, target });
  });
  session.startPass([target, target]);
  session.recordCalibrationSample(target, {
    raw: { ...target, confidence: 0.9, timestamp: 2 },
    compensated: { ...target, confidence: 0.9, timestamp: 2 },
    pose: { yaw: 0, pitch: 0, eyeScale: 0, interEyeDistance: 0 },
    quality: { accepted: true, rejectionReasons: [] },
  });
  session.recordPrimarySample({ gaze: target, target });
  session.recordCalibrationSample(target, {
    raw: { ...target, confidence: 0.9, timestamp: 3 },
    compensated: { ...target, confidence: 0.9, timestamp: 3 },
    pose: { yaw: 1.6, pitch: 1.4, eyeScale: 1.5, interEyeDistance: 1.2 },
    quality: { accepted: true, rejectionReasons: [] },
  });
  session.recordPrimarySample({ gaze: target, target });

  expect(session.getDiagnosticsSnapshot().calibrationFitComparison.poseDistributionShift).toEqual({
    yaw: true,
    pitch: false,
    eyeScale: false,
    interEyeDistance: false,
  });
});

test('closes after the validation pass and does not silently accept a third pass', () => {
  const session = new ModelTestingSession();
  const target = { x: 0.5, y: 0.5 };

  expect(session.startPass([target])?.kind).toBe('training');
  session.completePass();
  expect(session.startPass([target])?.kind).toBe('validation');
  session.completePass();

  expect(session.nextPassKind).toBeNull();
  expect(session.startPass([target])).toBeNull();
  session.recordPrimarySample({ gaze: target, target });
  expect(session.getDiagnosticsSnapshot().calibrationFitComparison.passOrder).toHaveLength(2);
  expect(session.getDiagnosticsSnapshot().eyeDiagnostics.passCount).toBe(2);
});