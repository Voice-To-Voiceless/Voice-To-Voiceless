import { NormalizedGazePoint } from './gazeTypes';

export type CalibrationTarget = {
  x: number;
  y: number;
};

export type CalibrationSample = {
  gaze: CalibrationTarget;
  target: CalibrationTarget;
};

export type CalibrationFitDiagnostics = {
  accepted: boolean;
  rmsResidual: number | null;
  targetResiduals: Array<{ target: CalibrationTarget; residual: number }>;
  rejectionReason: 'fewer than three target groups' | 'too many unstable target groups' | 'singular calibration matrix' | 'residual exceeds threshold' | null;
};

type AffineCoefficients = [number, number, number];

const MAX_TARGET_SPREAD = 0.18;
const MAX_RMS_RESIDUAL = 0.14;
const ROBUST_FIT_ITERATIONS = 4;
const MIN_SAMPLE_WEIGHT = 0.05;
const MAX_UNSTABLE_TARGETS = 1;

export class GazeCalibrationMapper {
  private readonly xCoefficients: AffineCoefficients;
  private readonly yCoefficients: AffineCoefficients;

  private constructor(xCoefficients: AffineCoefficients, yCoefficients: AffineCoefficients) {
    this.xCoefficients = xCoefficients;
    this.yCoefficients = yCoefficients;
  }

  public static fit(samples: CalibrationSample[]): GazeCalibrationMapper | null {
    const aggregatedSamples = aggregateSamples(samples);
    const diagnostics = getCalibrationFitDiagnostics(samples);
    downloadCalibrationDiagnostics({
      sampleCount: samples.length,
      targetGroupCount: aggregatedSamples.length,
      targets: aggregatedSamples.map(sample => ({
        target: sample.target,
        gaze: sample.gaze,
        spread: sample.targetSpread,
        weight: sample.weight,
      })),
    });
    if (diagnostics.rejectionReason === 'fewer than three target groups') {
      console.warn('[gaze-calibration] fit rejected', {
        reason: 'fewer than three target groups',
        sampleCount: samples.length,
        targetGroupCount: aggregatedSamples.length,
      });
      return null;
    }
    const unstableSamples = aggregatedSamples.filter(sample => sample.weight < 1);
    if (diagnostics.rejectionReason === 'too many unstable target groups') {
      console.warn('[gaze-calibration] fit rejected', {
        reason: 'too many unstable target groups',
        sampleCount: samples.length,
        targetGroupCount: aggregatedSamples.length,
        unstableTargetCount: unstableSamples.length,
        targetSpreads: aggregatedSamples.map(sample => ({ target: sample.target, spread: sample.targetSpread })),
      });
      return null;
    }

    const fit = fitRobustMapping(aggregatedSamples);
    const xCoefficients = fit?.xCoefficients ?? null;
    const yCoefficients = fit?.yCoefficients ?? null;

    if (xCoefficients === null || yCoefficients === null || diagnostics.rejectionReason === 'singular calibration matrix') {
      console.warn('[gaze-calibration] fit rejected', {
        reason: 'singular calibration matrix',
        sampleCount: samples.length,
        targetGroupCount: aggregatedSamples.length,
      });
      return null;
    }

    const rmsResidual = diagnostics.rmsResidual ?? 0;
    if (diagnostics.rejectionReason === 'residual exceeds threshold') {
      console.warn('[gaze-calibration] fit rejected', {
        reason: 'residual exceeds threshold',
        sampleCount: samples.length,
        targetGroupCount: aggregatedSamples.length,
        unstableTargetCount: unstableSamples.length,
        rmsResidual,
        maxRmsResidual: MAX_RMS_RESIDUAL,
        targetResiduals: diagnostics.targetResiduals,
      });
      return null;
    }

    return rmsResidual <= MAX_RMS_RESIDUAL
      ? new GazeCalibrationMapper(xCoefficients, yCoefficients)
      : null;
  }

  public map(gaze: NormalizedGazePoint): NormalizedGazePoint {
    return {
      ...gaze,
      x: clamp(evaluate(this.xCoefficients, gaze.x, gaze.y)),
      y: clamp(evaluate(this.yCoefficients, gaze.x, gaze.y)),
    };
  }
}

function downloadCalibrationDiagnostics(diagnostics: {
  sampleCount: number;
  targetGroupCount: number;
  targets: Array<{
    target: CalibrationTarget;
    gaze: CalibrationTarget;
    spread: number;
    weight: number;
  }>;
}): void {
  if (
    typeof document === 'undefined'
    || typeof Blob === 'undefined'
    || typeof URL === 'undefined'
    || typeof URL.createObjectURL !== 'function'
  ) {
    return;
  }

  const blob = new Blob([JSON.stringify(diagnostics, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `gaze-calibration-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

type Matrix = number[][];
type Vector = [number, number, number];

function createMatrix(): Matrix {
  return [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
}

function addWeightedOuterProduct(matrix: Matrix, vector: Vector, weight: number): Matrix {
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      matrix[row][column] += weight * vector[row] * vector[column];
    }
  }
  return matrix;
}

function addVector(result: Vector, vector: Vector, value: number, weight: number): Vector {
  return result.map((entry, index) => entry + weight * vector[index] * value) as Vector;
}

function fitRobustMapping(samples: AggregatedCalibrationSample[]): {
  xCoefficients: AffineCoefficients;
  yCoefficients: AffineCoefficients;
} | null {
  let weights = samples.map(sample => sample.weight);
  let xCoefficients: AffineCoefficients | null = null;
  let yCoefficients: AffineCoefficients | null = null;

  for (let iteration = 0; iteration < ROBUST_FIT_ITERATIONS; iteration += 1) {
    const matrix = samples.reduce(
      (result, sample, index) => addWeightedOuterProduct(result, [1, sample.gaze.x, sample.gaze.y], weights[index]),
      createMatrix(),
    );
    const xVector = samples.reduce<Vector>(
      (result, sample, index) => addVector(result, [1, sample.gaze.x, sample.gaze.y], sample.target.x, weights[index]),
      [0, 0, 0],
    );
    const yVector = samples.reduce<Vector>(
      (result, sample, index) => addVector(result, [1, sample.gaze.x, sample.gaze.y], sample.target.y, weights[index]),
      [0, 0, 0],
    );
    xCoefficients = solve(matrix, xVector);
    yCoefficients = solve(matrix, yVector);
    if (xCoefficients === null || yCoefficients === null) {
      return null;
    }

    weights = samples.map(sample => {
      const xError = evaluate(xCoefficients!, sample.gaze.x, sample.gaze.y) - sample.target.x;
      const yError = evaluate(yCoefficients!, sample.gaze.x, sample.gaze.y) - sample.target.y;
      const residual = Math.hypot(xError, yError);
      return sample.weight * Math.min(1, MAX_RMS_RESIDUAL / Math.max(residual, 1e-6));
    });
  }

  return xCoefficients !== null && yCoefficients !== null ? { xCoefficients, yCoefficients } : null;
}

function solve(matrix: Matrix, vector: Vector): AffineCoefficients | null {
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let pivot = 0; pivot < 3; pivot += 1) {
    const pivotRow = findPivotRow(augmented, pivot);
    if (pivotRow === -1) {
      return null;
    }
    [augmented[pivot], augmented[pivotRow]] = [augmented[pivotRow], augmented[pivot]];
    const pivotValue = augmented[pivot][pivot];
    for (let column = pivot; column < 4; column += 1) {
      augmented[pivot][column] /= pivotValue;
    }
    for (let row = 0; row < 3; row += 1) {
      if (row === pivot) {
        continue;
      }
      const factor = augmented[row][pivot];
      for (let column = pivot; column < 4; column += 1) {
        augmented[row][column] -= factor * augmented[pivot][column];
      }
    }
  }

  return [augmented[0][3], augmented[1][3], augmented[2][3]];
}

function findPivotRow(matrix: Matrix, column: number): number {
  let bestRow = -1;
  let bestValue = 1e-8;
  for (let row = column; row < 3; row += 1) {
    const value = Math.abs(matrix[row][column]);
    if (value > bestValue) {
      bestValue = value;
      bestRow = row;
    }
  }
  return bestRow;
}

function evaluate(coefficients: AffineCoefficients, x: number, y: number): number {
  return coefficients[0] + coefficients[1] * x + coefficients[2] * y;
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

type AggregatedCalibrationSample = CalibrationSample & { weight: number; targetSpread: number };

function aggregateSamples(samples: CalibrationSample[]): AggregatedCalibrationSample[] {
  const groups = new Map<string, CalibrationSample[]>();
  for (const sample of samples) {
    const key = `${sample.target.x}:${sample.target.y}`;
    const group = groups.get(key) ?? [];
    group.push(sample);
    groups.set(key, group);
  }

  const aggregated: AggregatedCalibrationSample[] = [];
  for (const group of groups.values()) {
    const gazeX = group.map(sample => sample.gaze.x);
    const gazeY = group.map(sample => sample.gaze.y);
    const targetSpread = Math.max(spread(gazeX), spread(gazeY));
    aggregated.push({
      gaze: { x: median(gazeX), y: median(gazeY) },
      target: group[0].target,
      weight: Math.max(MIN_SAMPLE_WEIGHT, Math.min(1, MAX_TARGET_SPREAD / Math.max(targetSpread, 1e-6))),
      targetSpread,
    });
  }
  return aggregated;
}

function calculateRmsResidual(
  samples: CalibrationSample[],
  xCoefficients: AffineCoefficients,
  yCoefficients: AffineCoefficients,
): number {
  const squaredError = samples.reduce((total, sample) => {
    const xError = evaluate(xCoefficients, sample.gaze.x, sample.gaze.y) - sample.target.x;
    const yError = evaluate(yCoefficients, sample.gaze.x, sample.gaze.y) - sample.target.y;
    return total + xError ** 2 + yError ** 2;
  }, 0);
  return Math.sqrt(squaredError / samples.length);
}

function calculateTargetResiduals(
  samples: AggregatedCalibrationSample[],
  xCoefficients: AffineCoefficients,
  yCoefficients: AffineCoefficients,
): Array<{ target: CalibrationTarget; residual: number }> {
  return samples.map(sample => {
    const xError = evaluate(xCoefficients, sample.gaze.x, sample.gaze.y) - sample.target.x;
    const yError = evaluate(yCoefficients, sample.gaze.x, sample.gaze.y) - sample.target.y;
    return { target: sample.target, residual: Math.hypot(xError, yError) };
  });
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function spread(values: number[]): number {
  if (values.length < 3) {
    return Math.max(...values) - Math.min(...values);
  }

  const center = median(values);
  const deviations = values.map(value => Math.abs(value - center));
  return median(deviations) * 2;
}

export function getCalibrationFitDiagnostics(samples: CalibrationSample[]): CalibrationFitDiagnostics {
  const aggregatedSamples = aggregateSamples(samples);
  if (aggregatedSamples.length < 3) {
    return { accepted: false, rmsResidual: null, targetResiduals: [], rejectionReason: 'fewer than three target groups' };
  }
  const unstableSamples = aggregatedSamples.filter(sample => sample.weight < 1);
  if (unstableSamples.length > MAX_UNSTABLE_TARGETS) {
    return { accepted: false, rmsResidual: null, targetResiduals: [], rejectionReason: 'too many unstable target groups' };
  }
  const fit = fitRobustMapping(aggregatedSamples);
  if (fit === null) {
    return { accepted: false, rmsResidual: null, targetResiduals: [], rejectionReason: 'singular calibration matrix' };
  }
  const targetResiduals = calculateTargetResiduals(aggregatedSamples, fit.xCoefficients, fit.yCoefficients);
  const rmsResidual = calculateRmsResidual(aggregatedSamples, fit.xCoefficients, fit.yCoefficients);
  return {
    accepted: rmsResidual <= MAX_RMS_RESIDUAL,
    rmsResidual,
    targetResiduals,
    rejectionReason: rmsResidual > MAX_RMS_RESIDUAL ? 'residual exceeds threshold' : null,
  };
}