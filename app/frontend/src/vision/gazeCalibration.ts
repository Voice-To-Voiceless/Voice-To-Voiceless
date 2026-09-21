import { NormalizedGazePoint } from './gazeTypes';
import { aggregateSamples, clamp, evaluate, fitRobustMapping, getCalibrationFitDiagnostics, MAX_RMS_RESIDUAL, MIN_CALIBRATION_AXIS_SPAN } from './calibrationMath';

export type CalibrationTarget = { x: number; y: number };
export type CalibrationSample = { gaze: CalibrationTarget; target: CalibrationTarget };
export type CalibrationFitDiagnostics = {
  accepted: boolean;
  rmsResidual: number | null;
  targetResiduals: Array<{ target: CalibrationTarget; residual: number }>;
  rejectionReason: 'fewer than three target groups' | 'fewer than five target groups' | 'too many unstable target groups' | 'singular calibration matrix' | 'residual exceeds threshold' | 'insufficient gaze range' | null;
};

export class GazeCalibrationMapper {
  private constructor(
    private readonly xCoefficients: [number, number, number] | null,
    private readonly yCoefficients: [number, number, number] | null,
    private readonly grid: GridNode[][] | null,
  ) {}

  public static fit(samples: CalibrationSample[]): GazeCalibrationMapper | null {
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
    if (grid) return new GazeCalibrationMapper(null, null, grid);
    const fit = fitRobustMapping(aggregatedSamples);
    return fit === null ? null : new GazeCalibrationMapper(fit.xCoefficients, fit.yCoefficients, null);
  }

  public map(gaze: NormalizedGazePoint): NormalizedGazePoint {
    const point = this.grid ? interpolate(this.grid, gaze.x, gaze.y) : { x: evaluate(this.xCoefficients!, gaze.x, gaze.y), y: evaluate(this.yCoefficients!, gaze.x, gaze.y) };
    return { ...gaze, x: clamp(point.x), y: clamp(point.y) };
  }
}

type GridNode = { gazeX: number; gazeY: number; targetX: number; targetY: number };
const GRID_VALUES = [0.1, 0.5, 0.9];

function hasValidTargets(samples: CalibrationSample[]): boolean {
  return samples.every(sample => sample.target.x >= 0 && sample.target.x <= 1 && sample.target.y >= 0 && sample.target.y <= 1);
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
  const column = findCell(grid[0].map(node => node.gazeX), gazeX);
  const row = findCell(grid.map(nodes => nodes[0].gazeY), gazeY);
  const xWeight = fraction(grid[0][column].gazeX, grid[0][column + 1].gazeX, gazeX);
  const yWeight = fraction(grid[row][0].gazeY, grid[row + 1][0].gazeY, gazeY);
  const top = blend(grid[row][column], grid[row][column + 1], xWeight);
  const bottom = blend(grid[row + 1][column], grid[row + 1][column + 1], xWeight);
  const result = blend(top, bottom, yWeight);
  return { x: result.targetX, y: result.targetY };
}

function findCell(values: number[], value: number): number {
  const ascending = values[values.length - 1] > values[0];
  if (ascending ? value <= values[0] : value >= values[0]) return 0;
  if (ascending ? value >= values[values.length - 1] : value <= values[values.length - 1]) return values.length - 2;
  return values.findIndex((entry, index) => (ascending ? value <= entry : value >= entry) && index > 0) - 1;
}

function fraction(start: number, end: number, value: number): number { return Math.max(0, Math.min(1, (value - start) / (end - start))); }
function blend(first: GridNode, second: GridNode, weight: number): GridNode { return { gazeX: 0, gazeY: 0, targetX: first.targetX + (second.targetX - first.targetX) * weight, targetY: first.targetY + (second.targetY - first.targetY) * weight }; }
function isMonotonic(values: number[]): boolean {
  const direction = values[values.length - 1] > values[0] ? 1 : -1;
  return Math.max(...values) - Math.min(...values) >= MIN_CALIBRATION_AXIS_SPAN && values.every((value, index) => index === 0 || (value - values[index - 1]) * direction > 0);
}

export { getCalibrationFitDiagnostics } from './calibrationMath';
