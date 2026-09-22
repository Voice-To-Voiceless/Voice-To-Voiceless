export type RidgeCalibrationFeatures = {
  leftIrisX: number;
  leftIrisY: number;
  rightIrisX: number;
  rightIrisY: number;
  yaw: number;
  pitch: number;
  roll: number;
  eyeScale: number;
  faceCenterX: number;
  faceCenterY: number;
};

type RidgeSample = { features: RidgeCalibrationFeatures; target: { x: number; y: number } };
type RidgeModel = { mean: number[]; scale: number[]; x: number[]; y: number[] };
const FEATURE_NAMES: Array<keyof RidgeCalibrationFeatures> = [
  'leftIrisX', 'leftIrisY', 'rightIrisX', 'rightIrisY', 'yaw', 'pitch', 'roll', 'eyeScale', 'faceCenterX', 'faceCenterY',
];
const RIDGE_LAMBDA = 0.1;

export function fitRidgeCalibration(samples: RidgeSample[]): RidgeModel | null {
  if (samples.length < 20) return null;
  const raw = samples.map(sample => FEATURE_NAMES.map(name => sample.features[name]));
  const mean = FEATURE_NAMES.map((_, index) => raw.reduce((sum, row) => sum + row[index], 0) / raw.length);
  const scale = FEATURE_NAMES.map((_, index) => {
    const variance = raw.reduce((sum, row) => sum + (row[index] - mean[index]) ** 2, 0) / raw.length;
    return Math.sqrt(variance) || 1;
  });
  const design = raw.map(row => expand(row.map((value, index) => (value - mean[index]) / scale[index])));
  const matrix = createMatrix(design[0].length);
  const xVector = Array(design[0].length).fill(0);
  const yVector = Array(design[0].length).fill(0);
  design.forEach((row, index) => {
    row.forEach((value, column) => {
      xVector[column] += value * samples[index].target.x;
      yVector[column] += value * samples[index].target.y;
      row.forEach((other, otherColumn) => { matrix[column][otherColumn] += value * other; });
    });
  });
  for (let index = 1; index < matrix.length; index += 1) matrix[index][index] += RIDGE_LAMBDA;
  const x = solve(matrix, xVector);
  const y = solve(matrix, yVector);
  return x && y ? { mean, scale, x, y } : null;
}

export function mapRidgeCalibration(model: RidgeModel, features: RidgeCalibrationFeatures): { x: number; y: number } {
  const normalized = FEATURE_NAMES.map(name => features[name]);
  const values = expand(normalized.map((value, index) => (value - model.mean[index]) / model.scale[index]));
  return { x: dot(model.x, values), y: dot(model.y, values) };
}

function expand(values: number[]): number[] {
  const result = [1, ...values];
  for (let first = 0; first < values.length; first += 1) for (let second = first; second < values.length; second += 1) result.push(values[first] * values[second]);
  return result;
}
function createMatrix(size: number): number[][] { return Array.from({ length: size }, () => Array(size).fill(0)); }
function solve(matrix: number[][], vector: number[]): number[] | null {
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let pivot = 0; pivot < augmented.length; pivot += 1) {
    let pivotRow = pivot;
    for (let row = pivot + 1; row < augmented.length; row += 1) if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[pivotRow][pivot])) pivotRow = row;
    if (Math.abs(augmented[pivotRow][pivot]) < 1e-10) return null;
    [augmented[pivot], augmented[pivotRow]] = [augmented[pivotRow], augmented[pivot]];
    const divisor = augmented[pivot][pivot];
    for (let column = pivot; column <= augmented.length; column += 1) augmented[pivot][column] /= divisor;
    for (let row = 0; row < augmented.length; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      for (let column = pivot; column <= augmented.length; column += 1) augmented[row][column] -= factor * augmented[pivot][column];
    }
  }
  return augmented.map(row => row[row.length - 1]);
}
function dot(left: number[], right: number[]): number { return left.reduce((sum, value, index) => sum + value * right[index], 0); }
