import { CalibrationFitDiagnostics, CalibrationSample } from './gazeCalibration';

type PoseSample = CalibrationSample & { pose: { yaw: number; pitch: number } };
type Coefficients = number[];
const MAX_RMS_RESIDUAL = 0.14;

export function getPoseConditionedCalibrationFitDiagnostics(samples: PoseSample[]): CalibrationFitDiagnostics {
  const groups = [...groupSamples(samples).values()];
  if (groups.length < 5) {
    return { accepted: false, rmsResidual: null, targetResiduals: [], rejectionReason: 'fewer than three target groups' };
  }
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
  if (xCoefficients === null || yCoefficients === null) {
    return { accepted: false, rmsResidual: null, targetResiduals: [], rejectionReason: 'singular calibration matrix' };
  }
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
