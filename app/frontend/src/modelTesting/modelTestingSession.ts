import { CalibrationSample, getCalibrationFitDiagnostics } from '../vision/gazeCalibration';
import { aggregateSamples, evaluate, fitRobustMapping, getMedianGazeByTarget } from '../vision/calibrationMath';
import { NormalizedGazePoint } from '../vision/gazeTypes';
import { CalibrationSampleQuality, CalibrationQualityRejectionReason } from '../vision/calibrationQuality';
import {
  getPoseConditionedCalibrationFitDiagnostics,
  getPoseCoefficientDiagnostics,
  getPitchBinnedResidualDiagnostics,
  getPoseLeaveOneTargetOutDiagnostics,
  getPoseFeatureRanges,
  getPoseValidationDiagnostics,
  PoseSample,
} from './poseCalibrationDiagnostics';

export type CalibrationPassKind = 'training' | 'validation';
export type ModelTestingSessionOptions = {
  enableDiagnostics?: boolean;
};

export type CalibrationPass = {
  id: number;
  kind: CalibrationPassKind;
  targetOrder: CalibrationSample['target'][];
};

export type CalibrationDiagnosticPoints = {
  raw: NormalizedGazePoint;
  compensated: NormalizedGazePoint;
  pose: { yaw: number; pitch: number; eyeScale: number; interEyeDistance: number } | null;
  quality: CalibrationSampleQuality;
};

export type CalibrationQualitySummary = {
  accepted: number;
  rejected: number;
  rejectionReasons: Partial<Record<CalibrationQualityRejectionReason, number>>;
};

export type CalibrationDiagnosticsSnapshot = {
  calibrationFitComparison: {
    passOrder: Array<{ pass: CalibrationPassKind; targetOrder: CalibrationSample['target'][] }>;
    training: ReturnType<typeof getPassDiagnostics>;
    validation: ReturnType<typeof getPassCaptureSummary> | null;
    separatePassValidation: {
      ordinary: ReturnType<typeof getOrdinaryValidationDiagnostics>;
      poseConditioned: ReturnType<typeof getPoseValidationDiagnostics>;
    };
  };
  eyeDiagnostics: { targets: Array<Record<string, unknown>>; passCount: number };
};

type CalibrationSessionData = {
  all: CalibrationSample[];
  raw: CalibrationSample[];
  compensated: CalibrationSample[];
  poseConditioned: PoseSample[];
};

type PassData = CalibrationSessionData & {
  qualityByTarget: Record<number, CalibrationQualitySummary>;
  targetOrder: CalibrationSample['target'][];
};

export class ModelTestingSession {
  private readonly enableDiagnostics: boolean;
  private readonly passes: PassData[] = [];
  private currentPass: PassData | null = null;
  private passIndex = 0;
  private eyeDiagnostics: Array<Record<string, unknown>> = [];
  private eyeDiagnosticsTarget = -1;

  public constructor(options: ModelTestingSessionOptions = {}) {
    this.enableDiagnostics = options.enableDiagnostics ?? false;
  }

  public reset(): void {
    this.passes.length = 0;
    this.currentPass = null;
    this.passIndex = 0;
    this.eyeDiagnostics = [];
    this.eyeDiagnosticsTarget = -1;
  }

  public startPass(targetOrder: CalibrationSample['target'][]): CalibrationPass {
    const pass: PassData = {
      all: [],
      raw: [],
      compensated: [],
      poseConditioned: [],
      qualityByTarget: {},
      targetOrder,
    };
    this.currentPass = pass;
    this.passes.push(pass);
    const result = { id: this.passIndex, kind: this.passIndex === 0 ? 'training' : 'validation' as CalibrationPassKind, targetOrder };
    this.passIndex += 1;
    return result;
  }

  public get nextPassKind(): CalibrationPassKind {
    return this.passes.length === 0 ? 'training' : 'validation';
  }

  public recordEyeDiagnostics(targetIndex: number, entry: Record<string, unknown>): void {
    if (this.eyeDiagnosticsTarget === targetIndex) return;
    this.eyeDiagnosticsTarget = targetIndex;
    this.eyeDiagnostics.push(entry);
  }

  public recordCalibrationSample(target: CalibrationSample['target'], points: CalibrationDiagnosticPoints): void {
    if (!this.currentPass) return;
    this.currentPass.raw.push({ gaze: points.raw, target });
    this.currentPass.compensated.push({ gaze: points.compensated, target });
    if (points.pose !== null) this.currentPass.poseConditioned.push({ gaze: points.raw, target, pose: points.pose });
  }

  public recordPrimarySample(sample: CalibrationSample): void {
    this.currentPass?.all.push(sample);
  }

  public recordQualityDecision(targetIndex: number, quality: CalibrationSampleQuality): void {
    if (!this.currentPass) return;
    const summary = this.currentPass.qualityByTarget[targetIndex] ?? { accepted: 0, rejected: 0, rejectionReasons: {} };
    if (quality.accepted) {
      summary.accepted += 1;
    } else {
      summary.rejected += 1;
      quality.rejectionReasons.forEach(reason => {
        summary.rejectionReasons[reason] = (summary.rejectionReasons[reason] ?? 0) + 1;
      });
    }
    this.currentPass.qualityByTarget[targetIndex] = summary;
  }

  public get hasValidationData(): boolean {
    return this.passes.length >= 2 && this.passes[1].all.length > 0;
  }

  public completePass(): void {
    if (!this.enableDiagnostics || !this.currentPass) return;
    this.exportDiagnostics();
  }

  public exportDiagnostics(): void {
    if (!this.enableDiagnostics || this.passes.length === 0) return;
    downloadJson('gaze-calibration-diagnostics', this.getDiagnosticsSnapshot());
  }

  public getDiagnosticsSnapshot(): CalibrationDiagnosticsSnapshot {
    const training = this.passes[0];
    const validation = this.passes[1];
    return {
      calibrationFitComparison: {
        passOrder: this.passes.map((pass, index) => ({ pass: index === 0 ? 'training' : 'validation', targetOrder: pass.targetOrder })),
        training: getPassDiagnostics(training),
        validation: validation ? getPassCaptureSummary(validation) : null,
        separatePassValidation: {
          ordinary: getOrdinaryValidationDiagnostics(training.all, validation?.all ?? []),
          poseConditioned: getPoseValidationDiagnostics(training.poseConditioned, validation?.poseConditioned ?? []),
        },
      },
      eyeDiagnostics: { targets: this.eyeDiagnostics, passCount: this.passes.length },
    };
  }
}

function getOrdinaryValidationDiagnostics(training: CalibrationSample[], validation: CalibrationSample[]) {
  const fit = fitRobustMapping(aggregateSamples(training));
  if (fit === null || validation.length === 0) return { rmsResidual: null, maxResidual: null, targetResiduals: [] };
  const residuals = validation.map(sample => Math.hypot(evaluate(fit.xCoefficients, sample.gaze.x, sample.gaze.y) - sample.target.x, evaluate(fit.yCoefficients, sample.gaze.x, sample.gaze.y) - sample.target.y));
  return {
    rmsResidual: Math.sqrt(residuals.reduce((sum, residual) => sum + residual ** 2, 0) / residuals.length),
    maxResidual: Math.max(...residuals),
    targetResiduals: [...new Set(validation.map(sample => `${sample.target.x}:${sample.target.y}`))].map(key => {
      const group = validation.filter(sample => `${sample.target.x}:${sample.target.y}` === key);
      const groupResiduals = group.map(sample => Math.hypot(evaluate(fit.xCoefficients, sample.gaze.x, sample.gaze.y) - sample.target.x, evaluate(fit.yCoefficients, sample.gaze.x, sample.gaze.y) - sample.target.y));
      return { target: group[0].target, residual: Math.sqrt(groupResiduals.reduce((sum, residual) => sum + residual ** 2, 0) / groupResiduals.length) };
    }),
  };
}

function getPassDiagnostics(pass: PassData) {
  const poseConditioned = getPoseConditionedCalibrationFitDiagnostics(pass.poseConditioned);
  const poseLeaveOneTargetOut = getPoseLeaveOneTargetOutDiagnostics(pass.poseConditioned);
  return {
    rawMedianGazeByTarget: getMedianGazeByTarget(pass.raw),
    smoothed: getCalibrationFitDiagnostics(pass.all),
    raw: getCalibrationFitDiagnostics(pass.raw),
    compensated: getCalibrationFitDiagnostics(pass.compensated),
    poseConditioned: {
      ...poseConditioned,
      accepted: poseConditioned.accepted && poseLeaveOneTargetOut.accepted,
      rejectionReason: poseConditioned.accepted && !poseLeaveOneTargetOut.accepted
        ? 'leave-one-target-out residual exceeds threshold'
        : poseConditioned.rejectionReason,
    },
    poseCoefficientDiagnostics: getPoseCoefficientDiagnostics(pass.poseConditioned),
    pitchBinnedResiduals: getPitchBinnedResidualDiagnostics(pass.poseConditioned),
    poseLeaveOneTargetOut,
    qualityByTarget: pass.qualityByTarget,
  };
}

function getPassCaptureSummary(pass: PassData) {
  return {
    sampleCount: pass.all.length,
    rawSampleCount: pass.raw.length,
    poseSampleCount: pass.poseConditioned.length,
    poseFeatureRanges: getPoseFeatureRanges(pass.poseConditioned),
    qualityByTarget: pass.qualityByTarget,
  };
}

export function createModelTestingSession(options?: ModelTestingSessionOptions): ModelTestingSession {
  return new ModelTestingSession(options);
}

function downloadJson(name: string, value: unknown): void {
  if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}
