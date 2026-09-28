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
  l2csYaw?: number;
  l2csPitch?: number;
};

type RidgeSample = { features: RidgeCalibrationFeatures; target: { x: number; y: number } };
type Axis = 'x' | 'y';
type RidgeModel = { x: LinearModel; y: LinearModel };
type LinearModel = { names: Array<keyof RidgeCalibrationFeatures>; mean: number[]; scale: number[]; coefficients: number[] };

// Keep the mapper anchored to gaze geometry. Pose and scale remain available for diagnostics,
// but their frame-to-frame drift should not move the calibrated point directly.
export const RIDGE_X_FEATURES: Array<keyof RidgeCalibrationFeatures> = ['l2csYaw', 'yaw', 'pitch', 'roll', 'eyeScale', 'faceCenterX', 'faceCenterY'];
export const RIDGE_Y_FEATURES: Array<keyof RidgeCalibrationFeatures> = ['l2csPitch', 'yaw', 'pitch', 'roll', 'eyeScale', 'faceCenterX', 'faceCenterY'];
const LEGACY_X_FEATURES: Array<keyof RidgeCalibrationFeatures> = ['leftIrisX', 'rightIrisX', 'faceCenterX'];
const LEGACY_Y_FEATURES: Array<keyof RidgeCalibrationFeatures> = ['leftIrisY', 'rightIrisY', 'faceCenterY'];
const RIDGE_LAMBDAS = [0.001, 0.01, 0.1, 1, 10];

export function fitRidgeCalibration(samples: RidgeSample[]): RidgeModel | null {
  if (samples.length < 20 || samples.some(sample => !isFiniteSample(sample))) return null;
  const aggregated = aggregateSamples(samples);
  const hasL2CSFeatures = samples.every(sample => sample.features.l2csYaw !== undefined && sample.features.l2csPitch !== undefined);
  const xFeatures = hasL2CSFeatures ? RIDGE_X_FEATURES : LEGACY_X_FEATURES;
  const yFeatures = hasL2CSFeatures ? RIDGE_Y_FEATURES : LEGACY_Y_FEATURES;
  const lambda = chooseLambdaLeaveOneTargetOut(aggregated);
  const x = fitAxis(aggregated, xFeatures, 'x', lambda);
  const y = fitAxis(aggregated, yFeatures, 'y', lambda);
  return x && y ? { x, y } : null;
}

export function mapRidgeCalibration(model: RidgeModel, features: RidgeCalibrationFeatures): { x: number; y: number } {
  return { x: predict(model.x, features), y: predict(model.y, features) };
}

function fitAxis(samples: RidgeSample[], names: Array<keyof RidgeCalibrationFeatures>, axis: Axis, lambda: number): LinearModel | null {
  const rows = samples.map(sample => names.map(name => featureValue(sample.features, name)));
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
  for (let index = 1; index < matrix.length; index += 1) matrix[index][index] += lambda;
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
    target: group[0]!.target,
    features: Object.fromEntries((Object.keys(group[0]!.features) as Array<keyof RidgeCalibrationFeatures>).map(name => [name, median(group.map(sample => featureValue(sample.features, name)))])) as RidgeCalibrationFeatures,
  }));
}

function predict(model: LinearModel, features: RidgeCalibrationFeatures): number {
  const values = [1, ...model.names.map((name, index) => (featureValue(features, name) - model.mean[index]!) / model.scale[index]!)];
  return dot(model.coefficients, values);
}
function isFiniteSample(sample: RidgeSample): boolean { return [...Object.values(sample.features).filter((value): value is number => typeof value === 'number'), featureValue(sample.features, 'l2csYaw'), featureValue(sample.features, 'l2csPitch')].every(Number.isFinite) && Number.isFinite(sample.target.x) && Number.isFinite(sample.target.y); }
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

function featureValue(features: RidgeCalibrationFeatures, name: keyof RidgeCalibrationFeatures): number {
  if (name === 'l2csYaw') return features.l2csYaw ?? features.yaw;
  if (name === 'l2csPitch') return features.l2csPitch ?? features.pitch;
  return features[name] as number;
}

function chooseLambdaLeaveOneTargetOut(samples: RidgeSample[]): number {
  const targets = [...new Set(samples.map(sample => `${sample.target.x}:${sample.target.y}`))];
  if (targets.length < 3) return 0.1;
  return RIDGE_LAMBDAS.map(lambda => ({ lambda, error: leaveOneTargetOutError(samples, targets, lambda) }))
    .sort((left, right) => left.error - right.error)[0].lambda;
}

function leaveOneTargetOutError(samples: RidgeSample[], targets: string[], lambda: number): number {
  const errors: number[] = [];
  targets.forEach(heldOut => {
    const training = samples.filter(sample => `${sample.target.x}:${sample.target.y}` !== heldOut);
    const validation = samples.filter(sample => `${sample.target.x}:${sample.target.y}` === heldOut);
    const x = fitAxis(training, RIDGE_X_FEATURES, 'x', lambda);
    const y = fitAxis(training, RIDGE_Y_FEATURES, 'y', lambda);
    if (!x || !y) return;
    validation.forEach(sample => errors.push(Math.hypot(predict(x, sample.features) - sample.target.x, predict(y, sample.features) - sample.target.y)));
  });
  return errors.length === 0 ? Infinity : Math.sqrt(errors.reduce((sum, error) => sum + error ** 2, 0) / errors.length);
}
