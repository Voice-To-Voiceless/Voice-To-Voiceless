import type { CalibrationFitDiagnostics, CalibrationSample, CalibrationTarget } from './gazeCalibration';

type AffineCoefficients = [number, number, number];
type Matrix = number[][];
type Vector = [number, number, number];
export type AggregatedCalibrationSample = CalibrationSample & { weight: number; targetSpread: number };
export type MedianGazeByTarget = {
  target: CalibrationTarget;
  gaze: CalibrationTarget;
  sampleCount: number;
  targetSpread: number;
};

export const MAX_RMS_RESIDUAL = 0.14;
const MAX_TARGET_SPREAD = 0.18;
const ROBUST_FIT_ITERATIONS = 4;
const MIN_SAMPLE_WEIGHT = 0.05;
const MAX_UNSTABLE_TARGETS = 1;

export function aggregateSamples(samples: CalibrationSample[]): AggregatedCalibrationSample[] {
  const groups = new Map<string, CalibrationSample[]>();
  for (const sample of samples) {
    const key = `${sample.target.x}:${sample.target.y}`;
    groups.set(key, [...(groups.get(key) ?? []), sample]);
  }
  return [...groups.values()].map(group => {
    const gazeX = group.map(sample => sample.gaze.x);
    const gazeY = group.map(sample => sample.gaze.y);
    const targetSpread = Math.max(spread(gazeX), spread(gazeY));
    return {
      gaze: { x: median(gazeX), y: median(gazeY) },
      target: group[0].target,
      weight: Math.max(MIN_SAMPLE_WEIGHT, Math.min(1, MAX_TARGET_SPREAD / Math.max(targetSpread, 1e-6))),
      targetSpread,
    };
  });
}

export function getMedianGazeByTarget(samples: CalibrationSample[]): MedianGazeByTarget[] {
  const groups = new Map<string, CalibrationSample[]>();
  for (const sample of samples) {
    const key = `${sample.target.x}:${sample.target.y}`;
    groups.set(key, [...(groups.get(key) ?? []), sample]);
  }
  return [...groups.values()].map(group => {
    const aggregated = aggregateSamples(group)[0];
    return {
      target: group[0].target,
      gaze: aggregated.gaze,
      sampleCount: group.length,
      targetSpread: aggregated.targetSpread,
    };
  });
}

export function fitRobustMapping(samples: AggregatedCalibrationSample[]): { xCoefficients: AffineCoefficients; yCoefficients: AffineCoefficients } | null {
  let weights = samples.map(sample => sample.weight);
  let xCoefficients: AffineCoefficients | null = null;
  let yCoefficients: AffineCoefficients | null = null;
  for (let iteration = 0; iteration < ROBUST_FIT_ITERATIONS; iteration += 1) {
    const matrix = samples.reduce((result, sample, index) => addWeightedOuterProduct(result, [1, sample.gaze.x, sample.gaze.y], weights[index]), createMatrix());
    const xVector = samples.reduce<Vector>((result, sample, index) => addVector(result, [1, sample.gaze.x, sample.gaze.y], sample.target.x, weights[index]), [0, 0, 0]);
    const yVector = samples.reduce<Vector>((result, sample, index) => addVector(result, [1, sample.gaze.x, sample.gaze.y], sample.target.y, weights[index]), [0, 0, 0]);
    xCoefficients = solve(matrix, xVector);
    yCoefficients = solve(matrix, yVector);
    if (xCoefficients === null || yCoefficients === null) return null;
    weights = samples.map(sample => {
      const residual = Math.hypot(evaluate(xCoefficients!, sample.gaze.x, sample.gaze.y) - sample.target.x, evaluate(yCoefficients!, sample.gaze.x, sample.gaze.y) - sample.target.y);
      return sample.weight * Math.min(1, MAX_RMS_RESIDUAL / Math.max(residual, 1e-6));
    });
  }
  return xCoefficients && yCoefficients ? { xCoefficients, yCoefficients } : null;
}

export type AffineFitCoefficients = { xCoefficients: AffineCoefficients; yCoefficients: AffineCoefficients };

export function getCalibrationFitDiagnostics(samples: CalibrationSample[]): CalibrationFitDiagnostics {
  const aggregatedSamples = aggregateSamples(samples);
  if (aggregatedSamples.length < 3) return rejected('fewer than three target groups');
  if (aggregatedSamples.filter(sample => sample.weight < 1).length > MAX_UNSTABLE_TARGETS) return rejected('too many unstable target groups');
  const fit = fitRobustMapping(aggregatedSamples);
  if (fit === null) return rejected('singular calibration matrix');
  const targetResiduals = calculateTargetResiduals(aggregatedSamples, fit.xCoefficients, fit.yCoefficients);
  const rmsResidual = calculateRmsResidual(aggregatedSamples, fit.xCoefficients, fit.yCoefficients);
  return { accepted: rmsResidual <= MAX_RMS_RESIDUAL, rmsResidual, targetResiduals, rejectionReason: rmsResidual > MAX_RMS_RESIDUAL ? 'residual exceeds threshold' : null };
}

function rejected(reason: CalibrationFitDiagnostics['rejectionReason']): CalibrationFitDiagnostics {
  return { accepted: false, rmsResidual: null, targetResiduals: [], rejectionReason: reason };
}

function createMatrix(): Matrix { return [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; }
function addWeightedOuterProduct(matrix: Matrix, vector: Vector, weight: number): Matrix {
  for (let row = 0; row < 3; row += 1) for (let column = 0; column < 3; column += 1) matrix[row][column] += weight * vector[row] * vector[column];
  return matrix;
}
function addVector(result: Vector, vector: Vector, value: number, weight: number): Vector { return result.map((entry, index) => entry + weight * vector[index] * value) as Vector; }
function solve(matrix: Matrix, vector: Vector): AffineCoefficients | null {
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let pivot = 0; pivot < 3; pivot += 1) {
    const pivotRow = findPivotRow(augmented, pivot);
    if (pivotRow === -1) return null;
    [augmented[pivot], augmented[pivotRow]] = [augmented[pivotRow], augmented[pivot]];
    const pivotValue = augmented[pivot][pivot];
    for (let column = pivot; column < 4; column += 1) augmented[pivot][column] /= pivotValue;
    for (let row = 0; row < 3; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      for (let column = pivot; column < 4; column += 1) augmented[row][column] -= factor * augmented[pivot][column];
    }
  }
  return [augmented[0][3], augmented[1][3], augmented[2][3]];
}
function findPivotRow(matrix: Matrix, column: number): number {
  let bestRow = -1; let bestValue = 1e-8;
  for (let row = column; row < 3; row += 1) if (Math.abs(matrix[row][column]) > bestValue) { bestValue = Math.abs(matrix[row][column]); bestRow = row; }
  return bestRow;
}
export function evaluate(coefficients: AffineCoefficients, x: number, y: number): number { return coefficients[0] + coefficients[1] * x + coefficients[2] * y; }
export function clamp(value: number): number { return Math.min(1, Math.max(0, value)); }
function calculateRmsResidual(samples: CalibrationSample[], x: AffineCoefficients, y: AffineCoefficients): number { return Math.sqrt(samples.reduce((total, sample) => total + (evaluate(x, sample.gaze.x, sample.gaze.y) - sample.target.x) ** 2 + (evaluate(y, sample.gaze.x, sample.gaze.y) - sample.target.y) ** 2, 0) / samples.length); }
function calculateTargetResiduals(samples: AggregatedCalibrationSample[], x: AffineCoefficients, y: AffineCoefficients): Array<{ target: CalibrationTarget; residual: number }> { return samples.map(sample => ({ target: sample.target, residual: Math.hypot(evaluate(x, sample.gaze.x, sample.gaze.y) - sample.target.x, evaluate(y, sample.gaze.x, sample.gaze.y) - sample.target.y) })); }
function median(values: number[]): number { const sorted = [...values].sort((left, right) => left - right); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]; }
function spread(values: number[]): number { if (values.length < 3) return Math.max(...values) - Math.min(...values); const center = median(values); return median(values.map(value => Math.abs(value - center))) * 2; }
