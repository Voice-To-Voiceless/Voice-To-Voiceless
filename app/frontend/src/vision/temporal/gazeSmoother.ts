import { NormalizedGazePoint } from '../types/gazeTypes';

export class GazeSmoother {
  private readonly alpha: number;
  private readonly deadband: number;
  private smoothedPoint: NormalizedGazePoint | null = null;

  public constructor(alpha = 0.30, deadband = 0) {
    if (alpha <= 0 || alpha > 1) {
      throw new Error('Smoothing alpha must be greater than zero and at most one.');
    }
    if (deadband < 0 || deadband >= 0.5) {
      throw new Error('Smoothing deadband must be non-negative and less than 0.5.');
    }

    this.alpha = alpha;
    this.deadband = deadband;
  }

  public update(point: NormalizedGazePoint): NormalizedGazePoint {
    if (this.smoothedPoint === null) {
      this.smoothedPoint = { ...point };
      return this.smoothedPoint;
    }

    this.smoothedPoint = {
      x: this.smoothAxis(this.smoothedPoint.x, point.x),
      y: this.smoothAxis(this.smoothedPoint.y, point.y),
      confidence: point.confidence,
      timestamp: point.timestamp,
    };
    return this.smoothedPoint;
  }

  public reset(): void {
    this.smoothedPoint = null;
  }

  private smoothAxis(previous: number, next: number): number {
    const delta = next - previous;
    return Math.abs(delta) <= this.deadband ? previous : previous + this.alpha * delta;
  }
}
