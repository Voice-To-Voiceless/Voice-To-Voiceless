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
type Axis = 'x' | 'y';
type RidgeModel = { x: LinearModel; y: LinearModel };
type LinearModel = { names: Array<keyof RidgeCalibrationFeatures>; mean: number[]; scale: number[]; coefficients: number[] };

// Keep the mapper anchored to gaze geometry. Pose and scale remain available for diagnostics,
// but their frame-to-frame drift should not move the calibrated point directly.
export const RIDGE_X_FEATURES: Array<keyof RidgeCalibrationFeatures> = ['leftIrisX', 'rightIrisX', 'faceCenterX'];
export const RIDGE_Y_FEATURES: Array<keyof RidgeCalibrationFeatures> = ['leftIrisY', 'rightIrisY', 'faceCenterY'];
const RIDGE_LAMBDA = 0.1;

export function fitRidgeCalibration(samples: RidgeSample[]): RidgeModel | null {
  if (samples.length < 20 || samples.some(sample => !isFiniteSample(sample))) return null;
  const aggregated = aggregateSamples(samples);
  const x = fitAxis(aggregated, RIDGE_X_FEATURES, 'x');
  const y = fitAxis(aggregated, RIDGE_Y_FEATURES, 'y');
  return x && y ? { x, y } : null;
}

export function mapRidgeCalibration(model: RidgeModel, features: RidgeCalibrationFeatures): { x: number; y: number } {
  return { x: predict(model.x, features), y: predict(model.y, features) };
}

function fitAxis(samples: RidgeSample[], names: Array<keyof RidgeCalibrationFeatures>, axis: Axis): LinearModel | null {
  const rows = samples.map(sample => names.map(name => sample.features[name]));
  if (rows.length < 5 || names.every((_, index) => Math.max(...rows.map(row => row[index])) - Math.min(...rows.map(row => row[index])) < 1e-6)) return null;
  const mean = names.map((_, index) => median(rows.map(row => row[index])));
  const scale = names.map((_, index) => {
    const values = rows.map(row => row[index]);
    const spread = Math.sqrt(values.reduce((sum, value) => sum + (value - mean[index]) ** 2, 0) / values.length);
    return spread || 1;
  });
  const design = rows.map(row => [1, ...row.map((value, index) => (value - mean[index]) / scale[index])]);
  const matrix = createMatrix(design[0].length);
  const vector = Array(design[0].length).fill(0);
  design.forEach((row, rowIndex) => row.forEach((value, column) => {
    vector[column] += value * samples[rowIndex].target[axis];
    row.forEach((other, otherColumn) => { matrix[column][otherColumn] += value * other; });
  }));
  for (let index = 1; index < matrix.length; index += 1) matrix[index][index] += RIDGE_LAMBDA;
  const coefficients = solve(matrix, vector);
  return coefficients ? { names, mean, scale, coefficients } : null;
}

function aggregateSamples(samples: RidgeSample[]): RidgeSample[] {
  const groups = new Map<string, RidgeSample[]>();
  samples.forEach(sample => {
    const key = `${sample.target.x}:${sample.target.y}`;
    groups.set(key, [...(groups.get(key) ?? []), sample]);
  });
  return [...groups.values()].map(group => ({
    target: group[0].target,
    features: Object.fromEntries(Object.keys(group[0].features).map(name => [name, median(group.map(sample => sample.features[name as keyof RidgeCalibrationFeatures]))])) as RidgeCalibrationFeatures,
  }));
}

function predict(model: LinearModel, features: RidgeCalibrationFeatures): number {
  const values = [1, ...model.names.map((name, index) => (features[name] - model.mean[index]) / model.scale[index])];
  return dot(model.coefficients, values);
}
function isFiniteSample(sample: RidgeSample): boolean { return Object.values(sample.features).every(Number.isFinite) && Number.isFinite(sample.target.x) && Number.isFinite(sample.target.y); }
function median(values: number[]): number { const sorted = [...values].sort((left, right) => left - right); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; }
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
