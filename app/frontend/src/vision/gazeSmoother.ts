import { NormalizedGazePoint } from './gazeTypes';

export class GazeSmoother {
  private readonly alpha: number;
  private smoothedPoint: NormalizedGazePoint | null = null;

  public constructor(alpha = 0.35) {
    if (alpha <= 0 || alpha > 1) {
      throw new Error('Smoothing alpha must be greater than zero and at most one.');
    }

    this.alpha = alpha;
  }

  public update(point: NormalizedGazePoint): NormalizedGazePoint {
    if (this.smoothedPoint === null) {
      this.smoothedPoint = { ...point };
      return this.smoothedPoint;
    }

    this.smoothedPoint = {
      x: this.smoothedPoint.x + this.alpha * (point.x - this.smoothedPoint.x),
      y: this.smoothedPoint.y + this.alpha * (point.y - this.smoothedPoint.y),
      confidence: point.confidence,
      timestamp: point.timestamp,
    };
    return this.smoothedPoint;
  }

  public reset(): void {
    this.smoothedPoint = null;
  }
}