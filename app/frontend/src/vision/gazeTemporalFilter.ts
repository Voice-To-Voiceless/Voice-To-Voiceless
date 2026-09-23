import { GazeDiagnostics } from './gazeEstimator';
import { NormalizedGazePoint } from './gazeTypes';

export type TemporalFilterInput = {
  gaze: NormalizedGazePoint;
  diagnostics: GazeDiagnostics;
  leftConfidence: number;
  rightConfidence: number;
};

export type TemporalFilterResult = {
  accepted: boolean;
  gaze: NormalizedGazePoint | null;
  diagnostics: GazeDiagnostics | null;
  rejectionReason: 'non-finite' | 'closed-eye' | 'binocular-disagreement' | 'velocity-spike' | null;
};

type PositionSample = {
  timestamp: number;
  left: { x: number; y: number };
  right: { x: number; y: number };
};

export class GazeTemporalFilter {
  private readonly windowMs: number;
  private readonly maximumEyeDisagreement: number;
  private readonly maximumVelocity: number;
  private samples: PositionSample[] = [];

  public constructor(options: { windowMs?: number; maximumEyeDisagreement?: number; maximumVelocity?: number } = {}) {
    this.windowMs = options.windowMs ?? 100;
    this.maximumEyeDisagreement = options.maximumEyeDisagreement ?? 0.25;
    this.maximumVelocity = options.maximumVelocity ?? 3;
  }

  public update(input: TemporalFilterInput): TemporalFilterResult {
    const { gaze, diagnostics } = input;
    if (!isFiniteInput(input) || diagnostics.leftPosition === null || diagnostics.rightPosition === null) {
      return this.reject('non-finite');
    }
    if (diagnostics.leftAperture < 0.15 || diagnostics.rightAperture < 0.15) return this.reject('closed-eye');
    if ((diagnostics.eyeDisagreement ?? Infinity) > this.maximumEyeDisagreement) return this.reject('binocular-disagreement');

    const sample = { timestamp: gaze.timestamp, left: diagnostics.leftPosition, right: diagnostics.rightPosition };
    const previous = this.samples[this.samples.length - 1];
    if (previous) {
      const elapsedSeconds = Math.max((sample.timestamp - previous.timestamp) / 1000, 0.001);
      const movement = Math.max(
        Math.hypot(sample.left.x - previous.left.x, sample.left.y - previous.left.y),
        Math.hypot(sample.right.x - previous.right.x, sample.right.y - previous.right.y),
      );
      if (movement / elapsedSeconds > this.maximumVelocity) return this.reject('velocity-spike');
    }

    this.samples.push(sample);
    this.samples = this.samples.filter(item => sample.timestamp - item.timestamp <= this.windowMs);
    const left = { x: median(this.samples.map(item => item.left.x)), y: median(this.samples.map(item => item.left.y)) };
    const right = { x: median(this.samples.map(item => item.right.x)), y: median(this.samples.map(item => item.right.y)) };
    const filteredGaze = { ...gaze, x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
    return {
      accepted: true,
      gaze: filteredGaze,
      diagnostics: { ...diagnostics, leftPosition: left, rightPosition: right, eyeDisagreement: Math.hypot(left.x - right.x, left.y - right.y) },
      rejectionReason: null,
    };
  }

  public reset(): void {
    this.samples = [];
  }

  private reject(rejectionReason: TemporalFilterResult['rejectionReason']): TemporalFilterResult {
    return { accepted: false, gaze: null, diagnostics: null, rejectionReason };
  }
}

function isFiniteInput(input: TemporalFilterInput): boolean {
  return [input.gaze.x, input.gaze.y, input.gaze.confidence, input.leftConfidence, input.rightConfidence,
    input.diagnostics.leftAperture, input.diagnostics.rightAperture, input.diagnostics.eyeDisagreement,
    input.diagnostics.leftPosition?.x, input.diagnostics.leftPosition?.y,
    input.diagnostics.rightPosition?.x, input.diagnostics.rightPosition?.y].every(value => value !== null && Number.isFinite(value));
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}