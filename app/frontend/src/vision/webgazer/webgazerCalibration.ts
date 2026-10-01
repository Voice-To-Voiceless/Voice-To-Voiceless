import { CalibrationSample, GazeCalibrationMapperLike, MAX_VALIDATION_RMS } from '../calibration/gazeCalibration';
import type { ValidationFitDiagnostics } from '../calibration/gazeCalibration';
import type { NormalizedGazePoint } from '../types/gazeTypes';
import { BrowserWebGazerAdapter } from './webgazerAdapter';
import { WebGazerScreenPoint } from './webgazerTypes';

export type WebGazerCalibrationPass = 'training' | 'validation';

// RidgeReg keeps only the latest 50 click samples. Spread 45 samples across
// the nine targets so the final dot cannot replace the rest of the training set.
const TRAINING_SAMPLES_PER_TARGET = 5;
const TRAINING_SAMPLE_SPACING_MS = 400;

export interface ExternalCalibrationBackend {
  recordTrainingSample(sample: CalibrationSample): boolean;
  hasEnoughTrainingSamples(target: CalibrationSample['target']): boolean;
  clearTrainingData(): Promise<void>;
  fitTraining(samples: CalibrationSample[]): GazeCalibrationMapperLike | null;
  fitWithValidationDetailed(training: CalibrationSample[], validation: CalibrationSample[]): { mapper: GazeCalibrationMapperLike | null };
}

const identityMapper: GazeCalibrationMapperLike = {
  map(gaze: NormalizedGazePoint) { return gaze; },
};

/** Routes training labels to WebGazer; validation samples are only scored. */
export function createWebGazerCalibrationBackend(adapter: BrowserWebGazerAdapter): ExternalCalibrationBackend {
  const sampleCounts = new Map<string, number>();
  const lastRecordedAt = new Map<string, number>();
  return {
    async clearTrainingData() {
      sampleCounts.clear();
      lastRecordedAt.clear();
      await adapter.clearTrainingData();
    },
    recordTrainingSample(sample) {
      const key = `${sample.target.x}:${sample.target.y}`;
      if ((sampleCounts.get(key) ?? 0) >= TRAINING_SAMPLES_PER_TARGET) return true;
      const now = performance.now();
      if (now - (lastRecordedAt.get(key) ?? Number.NEGATIVE_INFINITY) < TRAINING_SAMPLE_SPACING_MS) return true;
      const recorded = adapter.recordTrainingTarget(toViewportPoint(sample.target));
      if (recorded) {
        sampleCounts.set(key, (sampleCounts.get(key) ?? 0) + 1);
        lastRecordedAt.set(key, now);
      }
      return recorded;
    },
    hasEnoughTrainingSamples(target) {
      return (sampleCounts.get(`${target.x}:${target.y}`) ?? 0) >= TRAINING_SAMPLES_PER_TARGET;
    },
    fitTraining(samples) {
      const targets = new Set(samples.map(sample => `${sample.target.x}:${sample.target.y}`));
      const enoughModelSamples = [...targets].every(target => (sampleCounts.get(target) ?? 0) >= TRAINING_SAMPLES_PER_TARGET);
      return targets.size === 9 && enoughModelSamples ? identityMapper : null;
    },
    fitWithValidationDetailed(training, validation) {
      const completeTrainingCoverage = new Set(training.map(sample => `${sample.target.x}:${sample.target.y}`)).size === 9;
      const completeValidationCoverage = new Set(validation.map(sample => `${sample.target.x}:${sample.target.y}`)).size === 9;
      const finiteValidationSamples = validation.length > 0 && validation.every(sample => Number.isFinite(sample.gaze.x) && Number.isFinite(sample.gaze.y));
      return {
        mapper: completeTrainingCoverage && completeValidationCoverage && finiteValidationSamples ? identityMapper : null,
      };
    },
  };
}

function toViewportPoint(point: WebGazerScreenPoint): WebGazerScreenPoint {
  return { x: point.x * window.innerWidth, y: point.y * window.innerHeight };
}

function evaluateSamples(samples: CalibrationSample[], applyThreshold: boolean): ValidationFitDiagnostics {
  const byTarget = new Map<string, CalibrationSample[]>();
  samples.forEach(sample => {
    const key = `${sample.target.x}:${sample.target.y}`;
    byTarget.set(key, [...(byTarget.get(key) ?? []), sample]);
  });
  const targetResiduals = [...byTarget.values()].map(group => ({
    target: group[0]!.target,
    residual: Math.hypot(
      median(group.map(sample => sample.gaze.x)) - group[0]!.target.x,
      median(group.map(sample => sample.gaze.y)) - group[0]!.target.y,
    ),
  }));
  const residuals = targetResiduals.map(result => result.residual);
  const sorted = [...residuals].sort((left, right) => left - right);
  const rmsResidual = residuals.length > 0
    ? Math.sqrt(residuals.reduce((sum, residual) => sum + residual ** 2, 0) / residuals.length)
    : null;
  const rejectionReason = residuals.length === 0
    ? 'no validation samples'
    : applyThreshold && rmsResidual! > MAX_VALIDATION_RMS
      ? 'validation residual exceeds threshold'
      : null;
  return {
    rmsResidual,
    p95Residual: sorted.length > 0 ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]! : null,
    maxResidual: sorted.length > 0 ? sorted[sorted.length - 1]! : null,
    targetResiduals,
    rejectionReason,
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}
