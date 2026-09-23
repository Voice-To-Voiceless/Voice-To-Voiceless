import { CalibrationFitDiagnostics } from '../vision/calibration/gazeCalibration';
import { addOuterProduct, addVector, aggregatePoseGroup, createMatrix, dot, getFeatureRange, getFeatures, getResidual, groupSamples, mean, solve } from './poseCalibrationMath';
import type { Coefficients, PitchBinDiagnostics, PoseCoefficientDiagnostics, PoseFeatureRanges, PoseLeaveOneTargetOutDiagnostics, PoseSample, PoseValidationDiagnostics } from './poseCalibrationTypes';

export type { PitchBinDiagnostics, PoseCoefficientDiagnostics, PoseFeatureRange, PoseFeatureRanges, PoseLeaveOneTargetOutDiagnostics, PoseSample, PoseValidationDiagnostics } from './poseCalibrationTypes';
const MAX_RMS_RESIDUAL = 0.14;

export function getPoseConditionedCalibrationFitDiagnostics(samples: PoseSample[]): CalibrationFitDiagnostics {
  const groups = [...groupSamples(samples).values()];
  const coefficients = fitCoefficients(samples);
  if (groups.length < 5) return { accepted: false, rmsResidual: null, targetResiduals: [], rejectionReason: 'fewer than five target groups' };
  if (coefficients === null) return { accepted: false, rmsResidual: null, targetResiduals: [], rejectionReason: 'singular calibration matrix' };
  const { xCoefficients, yCoefficients } = coefficients;
  const targetResiduals = groups.map(group => {
    const sample = aggregatePoseGroup(group);
    const features = getFeatures(sample);
    return {
      target: sample.target,
      residual: Math.hypot(dot(xCoefficients, features) - sample.target.x, dot(yCoefficients, features) - sample.target.y),
    };
  });
  const rmsResidual = Math.sqrt(targetResiduals.reduce((sum, item) => sum + item.residual ** 2, 0) / targetResiduals.length);
  return {
    accepted: rmsResidual <= MAX_RMS_RESIDUAL,
    rmsResidual,
    targetResiduals,
    rejectionReason: rmsResidual > MAX_RMS_RESIDUAL ? 'residual exceeds threshold' : null,
  };
}

export function getPoseCoefficientDiagnostics(samples: PoseSample[]): PoseCoefficientDiagnostics | null {
  const coefficients = fitCoefficients(samples);
  if (coefficients === null) return null;
  const { xCoefficients, yCoefficients } = coefficients;
  return {
    featureNames: ['intercept', 'gazeX', 'gazeY', 'yaw', 'pitch'],
    xCoefficients,
    yCoefficients,
    xAbsoluteMagnitudes: xCoefficients.map(Math.abs),
    yAbsoluteMagnitudes: yCoefficients.map(Math.abs),
    xMaxAbsoluteMagnitude: Math.max(...xCoefficients.map(Math.abs)),
    yMaxAbsoluteMagnitude: Math.max(...yCoefficients.map(Math.abs)),
  };
}

export function getPoseLeaveOneTargetOutDiagnostics(samples: PoseSample[]): PoseLeaveOneTargetOutDiagnostics {
  const groups = [...groupSamples(samples).values()];
  const targetResults = groups.map((heldOutGroup, heldOutIndex) => {
    const trainingSamples = groups.filter((_, index) => index !== heldOutIndex).flat();
    const coefficients = fitCoefficients(trainingSamples);
    if (coefficients === null) {
      return {
        target: heldOutGroup[0].target,
        sampleCount: heldOutGroup.length,
        rmsResidual: null,
        maxResidual: null,
        rejectionReason: 'singular calibration matrix',
      };
    }
    const residuals = heldOutGroup.map(sample => {
      const features = getFeatures(sample);
      return Math.hypot(
        dot(coefficients.xCoefficients, features) - sample.target.x,
        dot(coefficients.yCoefficients, features) - sample.target.y,
      );
    });
    const rmsResidual = Math.sqrt(residuals.reduce((sum, residual) => sum + residual ** 2, 0) / residuals.length);
    return {
      target: heldOutGroup[0].target,
      sampleCount: heldOutGroup.length,
      rmsResidual,
      maxResidual: Math.max(...residuals),
      rejectionReason: null,
    };
  });
  const validResults = targetResults.filter(result => result.rmsResidual !== null);
  const rmsValues = validResults.map(result => result.rmsResidual as number);
  const rmsResidual = rmsValues.length > 0
    ? Math.sqrt(rmsValues.reduce((sum, residual) => sum + residual ** 2, 0) / rmsValues.length)
    : null;
  const maxResidual = validResults.length > 0 ? Math.max(...validResults.map(result => result.maxResidual as number)) : null;
  return {
    accepted: rmsResidual !== null && rmsResidual <= MAX_RMS_RESIDUAL && targetResults.every(result => result.rejectionReason === null),
    rmsResidual,
    maxResidual,
    targetResults,
  };
}

export function getPitchBinnedResidualDiagnostics(samples: PoseSample[]): PitchBinDiagnostics[] {
  const coefficients = fitCoefficients(samples);
  if (coefficients === null || samples.length === 0) return [];
  const sorted = [...samples].sort((left, right) => left.pose.pitch - right.pose.pitch);
  const binCount = Math.min(3, sorted.length);
  const bins: PitchBinDiagnostics[] = [];
  for (let index = 0; index < binCount; index += 1) {
    const start = Math.floor(index * sorted.length / binCount);
    const end = Math.floor((index + 1) * sorted.length / binCount);
    const group = sorted.slice(start, Math.max(start + 1, end));
    const residuals = group.map(sample => getResidual(sample, coefficients));
    bins.push({
      lowerPitch: group[0].pose.pitch,
      upperPitch: group[group.length - 1].pose.pitch,
      sampleCount: group.length,
      meanPitch: mean(group.map(sample => sample.pose.pitch)),
      meanEyeScale: mean(group.map(sample => sample.pose.eyeScale)),
      meanInterEyeDistance: mean(group.map(sample => sample.pose.interEyeDistance)),
      rmsResidual: Math.sqrt(mean(residuals.map(residual => residual ** 2))),
      maxResidual: Math.max(...residuals),
    });
  }
  return bins;
}

export function getPoseValidationDiagnostics(training: PoseSample[], validation: PoseSample[]): PoseValidationDiagnostics {
  const coefficients = fitCoefficients(training);
  if (coefficients === null || validation.length === 0) return { rmsResidual: null, maxResidual: null, targetResiduals: [] };
  const residuals = validation.map(sample => getResidual(sample, coefficients));
  return {
    rmsResidual: Math.sqrt(residuals.reduce((sum, residual) => sum + residual ** 2, 0) / residuals.length),
    maxResidual: Math.max(...residuals),
    targetResiduals: [...groupSamples(validation).values()].map(group => ({
      target: group[0].target,
      residual: Math.sqrt(group.map(sample => getResidual(sample, coefficients) ** 2).reduce((sum, value) => sum + value, 0) / group.length),
    })),
  };
}

export function getPoseFeatureRanges(samples: PoseSample[]): PoseFeatureRanges | null {
  if (samples.length === 0) return null;
  return {
    yaw: getFeatureRange(samples.map(sample => sample.pose.yaw)),
    pitch: getFeatureRange(samples.map(sample => sample.pose.pitch)),
    eyeScale: getFeatureRange(samples.map(sample => sample.pose.eyeScale)),
    interEyeDistance: getFeatureRange(samples.map(sample => sample.pose.interEyeDistance)),
  };
}

function fitCoefficients(samples: PoseSample[]): { xCoefficients: Coefficients; yCoefficients: Coefficients } | null {
  const groups = [...groupSamples(samples).values()];
  if (groups.length < 5) return null;
  const matrix = createMatrix(5);
  const xVector = Array(5).fill(0) as number[];
  const yVector = Array(5).fill(0) as number[];
  for (const group of groups) {
    const representative = aggregatePoseGroup(group);
    const features = getFeatures(representative);
    addOuterProduct(matrix, features);
    addVector(xVector, features, representative.target.x);
    addVector(yVector, features, representative.target.y);
  }
  const xCoefficients = solve(matrix, xVector);
  const yCoefficients = solve(matrix, yVector);
  return xCoefficients === null || yCoefficients === null ? null : { xCoefficients, yCoefficients };
}

