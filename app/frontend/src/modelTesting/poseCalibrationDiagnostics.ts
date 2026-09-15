import { CalibrationFitDiagnostics, CalibrationSample } from '../vision/gazeCalibration';

export type PoseSample = CalibrationSample & { pose: { yaw: number; pitch: number } };
type Coefficients = number[];
const MAX_RMS_RESIDUAL = 0.14;

export type PoseLeaveOneTargetOutDiagnostics = {
  accepted: boolean;
  rmsResidual: number | null;
  maxResidual: number | null;
  targetResults: Array<{
    target: CalibrationSample['target'];
    sampleCount: number;
    rmsResidual: number | null;
    maxResidual: number | null;
    rejectionReason: string | null;
  }>;
};

export function getPoseConditionedCalibrationFitDiagnostics(samples: PoseSample[]): CalibrationFitDiagnostics {
  const groups = [...groupSamples(samples).values()];
  const coefficients = fitCoefficients(samples);
  if (groups.length < 5) return { accepted: false, rmsResidual: null, targetResiduals: [], rejectionReason: 'fewer than three target groups' };
  if (coefficients === null) return { accepted: false, rmsResidual: null, targetResiduals: [], rejectionReason: 'singular calibration matrix' };
  const { xCoefficients, yCoefficients } = coefficients;
  const targetResiduals = groups.map(group => {
    const sample = group[0];
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

function fitCoefficients(samples: PoseSample[]): { xCoefficients: Coefficients; yCoefficients: Coefficients } | null {
  const groups = [...groupSamples(samples).values()];
  if (groups.length < 5) return null;
  const matrix = createMatrix(5);
  const xVector = Array(5).fill(0) as number[];
  const yVector = Array(5).fill(0) as number[];
  for (const group of groups) {
    const features = getFeatures(group[0]);
    addOuterProduct(matrix, features);
    addVector(xVector, features, group[0].target.x);
    addVector(yVector, features, group[0].target.y);
  }
  const xCoefficients = solve(matrix, xVector);
  const yCoefficients = solve(matrix, yVector);
  return xCoefficients === null || yCoefficients === null ? null : { xCoefficients, yCoefficients };
}

function groupSamples(samples: PoseSample[]): Map<string, PoseSample[]> {
  const groups = new Map<string, PoseSample[]>();
  for (const sample of samples) {
    const key = `${sample.target.x}:${sample.target.y}`;
    groups.set(key, [...(groups.get(key) ?? []), sample]);
  }
  return groups;
}

function getFeatures(sample: PoseSample): number[] {
  return [1, sample.gaze.x, sample.gaze.y, sample.pose.yaw, sample.pose.pitch];
}

function createMatrix(size: number): number[][] {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

function addOuterProduct(matrix: number[][], vector: number[]): void {
  for (let row = 0; row < vector.length; row += 1) {
    for (let column = 0; column < vector.length; column += 1) matrix[row][column] += vector[row] * vector[column];
  }
}

function addVector(result: number[], vector: number[], value: number): void {
  for (let index = 0; index < vector.length; index += 1) result[index] += vector[index] * value;
}

function solve(matrix: number[][], vector: number[]): Coefficients | null {
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let pivot = 0; pivot < augmented.length; pivot += 1) {
    let pivotRow = pivot;
    for (let row = pivot + 1; row < augmented.length; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[pivotRow][pivot])) pivotRow = row;
    }
    if (Math.abs(augmented[pivotRow][pivot]) <= 1e-8) return null;
    [augmented[pivot], augmented[pivotRow]] = [augmented[pivotRow], augmented[pivot]];
    const pivotValue = augmented[pivot][pivot];
    for (let column = pivot; column <= augmented.length; column += 1) augmented[pivot][column] /= pivotValue;
    for (let row = 0; row < augmented.length; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      for (let column = pivot; column <= augmented.length; column += 1) augmented[row][column] -= factor * augmented[pivot][column];
    }
  }
  return augmented.map(row => row[row.length - 1]);
}

function dot(left: number[], right: number[]): number {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}
