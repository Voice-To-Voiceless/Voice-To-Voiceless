import type { PoseSample } from './poseCalibrationTypes';
import type { Coefficients } from './poseCalibrationTypes';

export function aggregatePoseGroup(group: PoseSample[]): PoseSample {
  return {
    gaze: { x: median(group.map(sample => sample.gaze.x)), y: median(group.map(sample => sample.gaze.y)) },
    target: group[0].target,
    pose: {
      yaw: median(group.map(sample => sample.pose.yaw)),
      pitch: median(group.map(sample => sample.pose.pitch)),
      eyeScale: median(group.map(sample => sample.pose.eyeScale)),
      interEyeDistance: median(group.map(sample => sample.pose.interEyeDistance)),
    },
  };
}

export function groupSamples(samples: PoseSample[]): Map<string, PoseSample[]> {
  const groups = new Map<string, PoseSample[]>();
  for (const sample of samples) {
    const key = `${sample.target.x}:${sample.target.y}`;
    groups.set(key, [...(groups.get(key) ?? []), sample]);
  }
  return groups;
}

export function getFeatures(sample: PoseSample): number[] {
  return [1, sample.gaze.x, sample.gaze.y, sample.pose.yaw, sample.pose.pitch];
}

export function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function getFeatureRange(values: number[]): { min: number; max: number; range: number; mean: number } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max, range: max - min, mean: mean(values) };
}

export function createMatrix(size: number): number[][] {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

export function addOuterProduct(matrix: number[][], vector: number[]): void {
  for (let row = 0; row < vector.length; row += 1) {
    for (let column = 0; column < vector.length; column += 1) matrix[row][column] += vector[row] * vector[column];
  }
}

export function addVector(result: number[], vector: number[], value: number): void {
  for (let index = 0; index < vector.length; index += 1) result[index] += vector[index] * value;
}

export function solve(matrix: number[][], vector: number[]): Coefficients | null {
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

export function dot(left: number[], right: number[]): number {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

export function getResidual(sample: PoseSample, coefficients: { xCoefficients: Coefficients; yCoefficients: Coefficients }): number {
  const features = getFeatures(sample);
  return Math.hypot(dot(coefficients.xCoefficients, features) - sample.target.x, dot(coefficients.yCoefficients, features) - sample.target.y);
}