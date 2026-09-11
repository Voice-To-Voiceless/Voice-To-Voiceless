import { NormalizedGazePoint } from './gazeTypes';

export type CalibrationTarget = {
  x: number;
  y: number;
};

export type CalibrationSample = {
  gaze: CalibrationTarget;
  target: CalibrationTarget;
};

type AffineCoefficients = [number, number, number];

export class GazeCalibrationMapper {
  private readonly xCoefficients: AffineCoefficients;
  private readonly yCoefficients: AffineCoefficients;

  private constructor(xCoefficients: AffineCoefficients, yCoefficients: AffineCoefficients) {
    this.xCoefficients = xCoefficients;
    this.yCoefficients = yCoefficients;
  }

  public static fit(samples: CalibrationSample[]): GazeCalibrationMapper | null {
    if (samples.length < 3) {
      return null;
    }

    const matrix = samples.reduce(
      (result, sample) => addOuterProduct(result, [1, sample.gaze.x, sample.gaze.y]),
      createMatrix(),
    );
    const xVector = samples.reduce<Vector>(
      (result, sample) => addVector(result, [1, sample.gaze.x, sample.gaze.y], sample.target.x),
      [0, 0, 0],
    );
    const yVector = samples.reduce<Vector>(
      (result, sample) => addVector(result, [1, sample.gaze.x, sample.gaze.y], sample.target.y),
      [0, 0, 0],
    );
    const xCoefficients = solve(matrix, xVector);
    const yCoefficients = solve(matrix, yVector);

    return xCoefficients === null || yCoefficients === null
      ? null
      : new GazeCalibrationMapper(xCoefficients, yCoefficients);
  }

  public map(gaze: NormalizedGazePoint): NormalizedGazePoint {
    return {
      ...gaze,
      x: clamp(evaluate(this.xCoefficients, gaze.x, gaze.y)),
      y: clamp(evaluate(this.yCoefficients, gaze.x, gaze.y)),
    };
  }
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

function addOuterProduct(matrix: Matrix, vector: Vector): Matrix {
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      matrix[row][column] += vector[row] * vector[column];
    }
  }
  return matrix;
}

function addVector(result: Vector, vector: Vector, value: number): Vector {
  return result.map((entry, index) => entry + vector[index] * value) as Vector;
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