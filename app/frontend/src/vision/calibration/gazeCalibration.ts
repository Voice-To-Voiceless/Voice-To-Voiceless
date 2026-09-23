export type { RidgeCalibrationFeatures } from './ridgeCalibration';
import { NormalizedGazePoint } from '../types/gazeTypes';
import { aggregateSamples, clamp, evaluate, fitRobustMapping, getCalibrationFitDiagnostics, MAX_RMS_RESIDUAL, MIN_CALIBRATION_AXIS_SPAN } from './calibrationMath';
import { fitRidgeCalibration, mapRidgeCalibration } from './ridgeCalibration';
import type { RidgeCalibrationFeatures } from './ridgeCalibration';

export type CalibrationTarget = { x: number; y: number };
export type CalibrationSample = { gaze: CalibrationTarget; target: CalibrationTarget; features?: RidgeCalibrationFeatures };
export type CalibrationFitDiagnostics = {
  accepted: boolean;
  rmsResidual: number | null;
  targetResiduals: Array<{ target: CalibrationTarget; residual: number }>;
  rejectionReason: 'fewer than three target groups' | 'fewer than five target groups' | 'too many unstable target groups' | 'singular calibration matrix' | 'residual exceeds threshold' | 'insufficient gaze range' | null;
};
export type ValidationFitDiagnostics = {
  rmsResidual: number | null;
  p95Residual: number | null;
  maxResidual: number | null;
  targetResiduals: Array<{ target: CalibrationTarget; residual: number }>;
  rejectionReason: 'no validation samples' | 'mapper unavailable' | 'validation residual exceeds threshold' | null;
};
export const MAX_VALIDATION_RMS = 0.15;

export class GazeCalibrationMapper {
  private constructor(
    private readonly xCoefficients: [number, number, number] | null,
    private readonly yCoefficients: [number, number, number] | null,
    private readonly grid: GridNode[][] | null,
    private readonly ridgeModel: ReturnType<typeof fitRidgeCalibration>,
  ) {}

  public static fit(samples: CalibrationSample[]): GazeCalibrationMapper | null {
    const ridgeModel = hasCompleteFeatures(samples) ? fitRidgeCalibration(samples as Required<CalibrationSample>[]) : null;
    if (ridgeModel) return new GazeCalibrationMapper(null, null, null, ridgeModel);
    return GazeCalibrationMapper.fitFallback(samples);
  }

  private static fitFallback(samples: CalibrationSample[]): GazeCalibrationMapper | null {
    const aggregatedSamples = aggregateSamples(samples);
    const diagnostics = getCalibrationFitDiagnostics(samples);
    if (!hasValidTargets(samples) || diagnostics.rejectionReason !== null || diagnostics.rmsResidual === null || diagnostics.rmsResidual > MAX_RMS_RESIDUAL) {
      console.warn('[gaze-calibration] fit rejected', {
        reason: diagnostics.rejectionReason ?? 'residual exceeds threshold',
        sampleCount: samples.length,
        targetGroupCount: aggregatedSamples.length,
        targetResiduals: diagnostics.targetResiduals,
      });
      return null;
    }
    const grid = createGrid(aggregatedSamples);
    if (grid) return new GazeCalibrationMapper(null, null, grid, null);
    const fit = fitRobustMapping(aggregatedSamples);
    return fit === null ? null : new GazeCalibrationMapper(fit.xCoefficients, fit.yCoefficients, null, null);
  }

  public static fitWithValidation(training: CalibrationSample[], validation: CalibrationSample[]): { mapper: GazeCalibrationMapper; diagnostics: ValidationFitDiagnostics } | null {
    const candidates = [GazeCalibrationMapper.fit(training), GazeCalibrationMapper.fitFallback(training)]
      .filter((mapper, index, mappers): mapper is GazeCalibrationMapper => mapper !== null && mappers.indexOf(mapper) === index);
    const evaluated = candidates
      .map(mapper => ({ mapper, trainingDiagnostics: evaluateValidation(mapper, training), diagnostics: evaluateValidation(mapper, validation) }))
      .filter(result => result.trainingDiagnostics.rejectionReason === null && result.diagnostics.rejectionReason === null)
      .sort((left, right) => (left.diagnostics.rmsResidual ?? Infinity) - (right.diagnostics.rmsResidual ?? Infinity));
    return evaluated[0] ?? null;
  }

  public map(gaze: NormalizedGazePoint, features?: RidgeCalibrationFeatures): NormalizedGazePoint {
    const point = this.ridgeModel
      ? features ? mapRidgeCalibration(this.ridgeModel, features) : { x: gaze.x, y: gaze.y }
      : this.grid ? interpolate(this.grid, gaze.x, gaze.y) : { x: evaluate(this.xCoefficients!, gaze.x, gaze.y), y: evaluate(this.yCoefficients!, gaze.x, gaze.y) };
    return { ...gaze, x: clamp(point.x), y: clamp(point.y) };
  }
}

type GridNode = { gazeX: number; gazeY: number; targetX: number; targetY: number };
const GRID_VALUES = [0.1, 0.5, 0.9];

function hasValidTargets(samples: CalibrationSample[]): boolean {
  return samples.every(sample => sample.target.x >= 0 && sample.target.x <= 1 && sample.target.y >= 0 && sample.target.y <= 1);
}

function hasCompleteFeatures(samples: CalibrationSample[]): samples is Required<CalibrationSample>[] {
  return samples.length > 0 && samples.every(sample => sample.features !== undefined && Object.values(sample.features).every(Number.isFinite));
}

function evaluateValidation(mapper: GazeCalibrationMapper, samples: CalibrationSample[]): ValidationFitDiagnostics {
  if (samples.length === 0) return { rmsResidual: null, p95Residual: null, maxResidual: null, targetResiduals: [], rejectionReason: 'no validation samples' };
  const residuals = samples.map(sample => Math.hypot(mapper.map({ ...sample.gaze, confidence: 1, timestamp: 0 }, sample.features).x - sample.target.x, mapper.map({ ...sample.gaze, confidence: 1, timestamp: 0 }, sample.features).y - sample.target.y));
  const sorted = [...residuals].sort((left, right) => left - right);
  const targetResiduals = [...new Set(samples.map(sample => `${sample.target.x}:${sample.target.y}`))].map(key => {
    const group = samples.filter(sample => `${sample.target.x}:${sample.target.y}` === key);
    const groupResiduals = group.map(sample => Math.hypot(mapper.map({ ...sample.gaze, confidence: 1, timestamp: 0 }, sample.features).x - sample.target.x, mapper.map({ ...sample.gaze, confidence: 1, timestamp: 0 }, sample.features).y - sample.target.y));
    return { target: group[0].target, residual: Math.sqrt(groupResiduals.reduce((sum, residual) => sum + residual ** 2, 0) / groupResiduals.length) };
  });
  const rmsResidual = Math.sqrt(residuals.reduce((sum, residual) => sum + residual ** 2, 0) / residuals.length);
  return { rmsResidual, p95Residual: sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)], maxResidual: sorted[sorted.length - 1], targetResiduals, rejectionReason: rmsResidual > MAX_VALIDATION_RMS ? 'validation residual exceeds threshold' : null };
}

function createGrid(samples: ReturnType<typeof aggregateSamples>): GridNode[][] | null {
  const nodes = GRID_VALUES.map(y => GRID_VALUES.map(x => samples.find(sample => sample.target.x === x && sample.target.y === y)));
  if (nodes.some(row => row.some(node => !node))) return null;
  const grid = nodes.map(row => row.map(node => ({ gazeX: node!.gaze.x, gazeY: node!.gaze.y, targetX: node!.target.x, targetY: node!.target.y })));
  if (grid.some(row => !isMonotonic(row.map(node => node.gazeX)))) return null;
  if (grid[0].some((_, column) => !isMonotonic(grid.map(row => row[column].gazeY)))) return null;
  return grid;
}

function interpolate(grid: GridNode[][], gazeX: number, gazeY: number): CalibrationTarget {
  let nearest: { distance: number; result: CalibrationTarget } | null = null;
  for (let row = 0; row < grid.length - 1; row += 1) {
    for (let column = 0; column < grid[row].length - 1; column += 1) {
      const cell = [grid[row][column], grid[row][column + 1], grid[row + 1][column], grid[row + 1][column + 1]];
      const result = interpolateCell(cell, gazeX, gazeY);
      if (result) return result;
      const centerX = cell.reduce((sum, node) => sum + node.gazeX, 0) / cell.length;
      const centerY = cell.reduce((sum, node) => sum + node.gazeY, 0) / cell.length;
      const distance = Math.hypot(gazeX - centerX, gazeY - centerY);
      if (nearest === null || distance < nearest.distance) nearest = { distance, result: interpolateNearestTriangle(cell, gazeX, gazeY) };
    }
  }
  return nearest?.result ?? { x: 0.5, y: 0.5 };
}

function interpolateCell(cell: GridNode[], gazeX: number, gazeY: number): CalibrationTarget | null {
  return interpolateTriangle(cell[0], cell[1], cell[2], gazeX, gazeY) ?? interpolateTriangle(cell[3], cell[2], cell[1], gazeX, gazeY);
}

function interpolateNearestTriangle(cell: GridNode[], gazeX: number, gazeY: number): CalibrationTarget {
  const first = interpolateTriangle(cell[0], cell[1], cell[2], gazeX, gazeY, true);
  const second = interpolateTriangle(cell[3], cell[2], cell[1], gazeX, gazeY, true);
  return first ?? second ?? { x: 0.5, y: 0.5 };
}

function interpolateTriangle(first: GridNode, second: GridNode, third: GridNode, gazeX: number, gazeY: number, clampWeights = false): CalibrationTarget | null {
  const denominator = (second.gazeY - third.gazeY) * (first.gazeX - third.gazeX) + (third.gazeX - second.gazeX) * (first.gazeY - third.gazeY);
  if (Math.abs(denominator) < 1e-8) return null;
  const firstWeight = ((second.gazeY - third.gazeY) * (gazeX - third.gazeX) + (third.gazeX - second.gazeX) * (gazeY - third.gazeY)) / denominator;
  const secondWeight = ((third.gazeY - first.gazeY) * (gazeX - third.gazeX) + (first.gazeX - third.gazeX) * (gazeY - third.gazeY)) / denominator;
  const thirdWeight = 1 - firstWeight - secondWeight;
  if (!clampWeights && (firstWeight < -1e-8 || secondWeight < -1e-8 || thirdWeight < -1e-8)) return null;
  const weights = clampWeights ? normalizeWeights([firstWeight, secondWeight, thirdWeight]) : [firstWeight, secondWeight, thirdWeight];
  return {
    x: first.targetX * weights[0] + second.targetX * weights[1] + third.targetX * weights[2],
    y: first.targetY * weights[0] + second.targetY * weights[1] + third.targetY * weights[2],
  };
}

function normalizeWeights(weights: number[]): number[] {
  const normalized = weights.map(weight => Math.max(0, weight));
  const total = normalized.reduce((sum, weight) => sum + weight, 0);
  return total > 0 ? normalized.map(weight => weight / total) : [1 / 3, 1 / 3, 1 / 3];
}

function isMonotonic(values: number[]): boolean {
  const direction = values[values.length - 1] > values[0] ? 1 : -1;
  return Math.max(...values) - Math.min(...values) >= MIN_CALIBRATION_AXIS_SPAN && values.every((value, index) => index === 0 || (value - values[index - 1]) * direction > 0);
}

export { getCalibrationFitDiagnostics } from './calibrationMath';
