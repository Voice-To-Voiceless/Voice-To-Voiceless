import { CalibrationSample, GazeCalibrationMapper, getCalibrationFitDiagnostics } from '../vision/gazeCalibration';
import { getMedianGazeByTarget, MAX_RMS_RESIDUAL } from '../vision/calibrationMath';
import {
  getPoseConditionedCalibrationFitDiagnostics,
  getPoseCoefficientDiagnostics,
  getPitchBinnedResidualDiagnostics,
  getPoseLeaveOneTargetOutDiagnostics,
  getPoseFeatureRanges,
  getPoseValidationDiagnostics,
  PoseSample,
} from './poseCalibrationDiagnostics';
import type { PassData } from './modelTestingSession';

export function hasCompleteTargetCoverage(pass: PassData): boolean {
  const targets = new Set(pass.targetOrder.map(target => `${target.x}:${target.y}`));
  const captured = new Set(pass.all.map(sample => `${sample.target.x}:${sample.target.y}`));
  return targets.size > 0 && [...targets].every(target => captured.has(target));
}

export function getOrdinaryValidationDiagnostics(training: CalibrationSample[], validation: CalibrationSample[]) {
  const mapper = GazeCalibrationMapper.fit(training);
  if (mapper === null || validation.length === 0) return { rmsResidual: null, maxResidual: null, targetResiduals: [] };
  const residuals = validation.map(sample => getMapperResidual(mapper, sample));
  return {
    rmsResidual: Math.sqrt(residuals.reduce((sum, residual) => sum + residual ** 2, 0) / residuals.length),
    maxResidual: Math.max(...residuals),
    targetResiduals: [...new Set(validation.map(sample => `${sample.target.x}:${sample.target.y}`))].map(key => {
      const group = validation.filter(sample => `${sample.target.x}:${sample.target.y}` === key);
      const groupResiduals = group.map(sample => getMapperResidual(mapper, sample));
      return { target: group[0].target, residual: Math.sqrt(groupResiduals.reduce((sum, residual) => sum + residual ** 2, 0) / groupResiduals.length) };
    }),
  };
}

function getMapperResidual(mapper: GazeCalibrationMapper, sample: CalibrationSample): number {
  const mapped = mapper.map({ ...sample.gaze, confidence: 1, timestamp: 0 }, sample.features);
  return Math.hypot(mapped.x - sample.target.x, mapped.y - sample.target.y);
}

export function getPassDiagnostics(pass: PassData) {
  const poseConditioned = getPoseConditionedCalibrationFitDiagnostics(pass.poseConditioned);
  const poseLeaveOneTargetOut = getPoseLeaveOneTargetOutDiagnostics(pass.poseConditioned);
  return {
    rawMedianGazeByTarget: getMedianGazeByTarget(pass.raw),
    smoothed: getCalibrationFitDiagnostics(pass.all),
    raw: getCalibrationFitDiagnostics(pass.raw),
    compensated: getCalibrationFitDiagnostics(pass.compensated),
    poseConditioned: {
      ...poseConditioned,
      accepted: poseConditioned.accepted && poseLeaveOneTargetOut.accepted,
      rejectionReason: poseConditioned.accepted && !poseLeaveOneTargetOut.accepted
        ? 'leave-one-target-out residual exceeds threshold'
        : poseConditioned.rejectionReason,
    },
    poseCoefficientDiagnostics: getPoseCoefficientDiagnostics(pass.poseConditioned),
    pitchBinnedResiduals: getPitchBinnedResidualDiagnostics(pass.poseConditioned),
    poseLeaveOneTargetOut,
    poseFeatureRanges: getPoseFeatureRanges(pass.poseConditioned),
    qualityByTarget: pass.qualityByTarget,
  };
}

export function getPoseDistributionShift(
  training: ReturnType<typeof getPoseFeatureRanges>,
  validation: ReturnType<typeof getPoseFeatureRanges>,
) {
  if (training === null || validation === null) return null;
  return {
    yaw: validation.yaw.range > training.yaw.range * 1.5,
    pitch: validation.pitch.range > training.pitch.range * 1.5,
    eyeScale: validation.eyeScale.range > training.eyeScale.range * 1.5,
    interEyeDistance: validation.interEyeDistance.range > training.interEyeDistance.range * 1.5,
  };
}

export function getAcceptedPoseValidationDiagnostics(training: PoseSample[], validation: PoseSample[]) {
  const diagnostics = getPoseValidationDiagnostics(training, validation);
  const shift = getPoseDistributionShift(getPoseFeatureRanges(training), getPoseFeatureRanges(validation));
  const shifted = shift !== null && Object.values(shift).some(Boolean);
  return {
    ...diagnostics,
    accepted: diagnostics.rmsResidual !== null && diagnostics.rmsResidual <= MAX_RMS_RESIDUAL && !shifted,
    rejectionReason: diagnostics.rmsResidual !== null && diagnostics.rmsResidual > MAX_RMS_RESIDUAL
      ? 'validation residual exceeds threshold'
      : shifted
        ? 'validation pose distribution shift exceeds threshold'
        : null,
  };
}

export function getPassCaptureSummary(pass: PassData) {
  return {
    sampleCount: pass.all.length,
    rawSampleCount: pass.raw.length,
    poseSampleCount: pass.poseConditioned.length,
    poseFeatureRanges: getPoseFeatureRanges(pass.poseConditioned),
    qualityByTarget: pass.qualityByTarget,
  };
}

export function downloadJson(name: string, value: unknown): void {
  if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}
