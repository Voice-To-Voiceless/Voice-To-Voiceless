import {
  DEFAULT_CALIBRATION_QUALITY_POLICY,
  evaluateCalibrationSampleQuality,
} from '../src/vision/calibrationQuality';
import { CalibrationQualityInput } from '../src/vision/calibrationQuality';

const validInput: CalibrationQualityInput = {
  gaze: { x: 0.5, y: 0.5, confidence: 0.9, timestamp: 1 },
  leftConfidence: 0.9,
  rightConfidence: 0.9,
  diagnostics: {
    leftPosition: { x: 0.45, y: 0.5 },
    rightPosition: { x: 0.55, y: 0.5 },
    leftAperture: 0.2,
    rightAperture: 0.2,
    eyeDisagreement: 0.1,
  },
  pose: { yaw: 0, pitch: 0 },
};

test('accepts a valid calibration frame', () => {
  expect(evaluateCalibrationSampleQuality(validInput)).toEqual({ accepted: true, rejectionReasons: [] });
});

test.each([
  ['pose unavailable', { pose: null }],
  ['low confidence', { leftConfidence: 0.4 }],
  ['invalid eye geometry', { diagnostics: { ...validInput.diagnostics, leftPosition: null } }],
  ['insufficient aperture', { diagnostics: { ...validInput.diagnostics, rightAperture: 0.14 } }],
  ['binocular disagreement', { diagnostics: { ...validInput.diagnostics, eyeDisagreement: 0.21 } }],
  ['non-finite value', { gaze: { ...validInput.gaze, x: Number.NaN } }],
] as const)('rejects a frame for %s', (reason, change) => {
  const diagnostics = 'diagnostics' in change ? change.diagnostics : {};
  const input = { ...validInput, ...change, diagnostics: { ...validInput.diagnostics, ...diagnostics } } as CalibrationQualityInput;

  expect(evaluateCalibrationSampleQuality(input)).toEqual({
    accepted: false,
    rejectionReasons: [reason],
  });
});

test('uses the named minimum accepted sample policy', () => {
  expect(DEFAULT_CALIBRATION_QUALITY_POLICY.minimumAcceptedSamplesPerTarget).toBe(20);
  expect(DEFAULT_CALIBRATION_QUALITY_POLICY.minimumAperture).toBe(0.15);
});
