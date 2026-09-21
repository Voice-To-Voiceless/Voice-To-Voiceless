import { CalibrationSample } from '../vision/gazeCalibration';
import { NormalizedGazePoint } from '../vision/gazeTypes';
import { CalibrationSampleQuality, CalibrationQualityRejectionReason } from '../vision/calibrationQuality';
import { getPoseFeatureRanges, PoseSample } from './poseCalibrationDiagnostics';
import {
  downloadJson,
  getAcceptedPoseValidationDiagnostics,
  getOrdinaryValidationDiagnostics,
  getPassCaptureSummary,
  getPassDiagnostics,
  getPoseDistributionShift,
  hasCompleteTargetCoverage,
} from './modelTestingDiagnostics';

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
    poseDistributionShift: ReturnType<typeof getPoseDistributionShift>;
    separatePassValidation: {
      ordinary: ReturnType<typeof getOrdinaryValidationDiagnostics>;
      poseConditioned: ReturnType<typeof getAcceptedPoseValidationDiagnostics>;
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

export type PassData = CalibrationSessionData & {
  qualityByTarget: Record<number, CalibrationQualitySummary>;
  targetOrder: CalibrationSample['target'][];
};

export class ModelTestingSession {
  private readonly enableDiagnostics: boolean;
  private readonly passes: PassData[] = [];
  private currentPass: PassData | null = null;
  private passIndex = 0;
  private sessionClosed = false;
  private eyeDiagnostics: Array<Record<string, unknown>> = [];
  private eyeDiagnosticsTarget = -1;

  public constructor(options: ModelTestingSessionOptions = {}) {
    this.enableDiagnostics = options.enableDiagnostics ?? false;
  }

  public reset(): void {
    this.passes.length = 0;
    this.currentPass = null;
    this.passIndex = 0;
    this.sessionClosed = false;
    this.eyeDiagnostics = [];
    this.eyeDiagnosticsTarget = -1;
  }

  public startPass(targetOrder: CalibrationSample['target'][]): CalibrationPass | null {
    if (this.sessionClosed) {
      this.currentPass = null;
      return null;
    }
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

  public get nextPassKind(): CalibrationPassKind | null {
    if (this.sessionClosed) return null;
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
    return this.getValidationPass() !== null;
  }

  public completePass(): void {
    if (!this.currentPass) return;
    if (this.passes.length >= 2) {
      this.sessionClosed = true;
      this.currentPass = null;
    }
    if (this.enableDiagnostics) this.exportDiagnostics();
  }

  public exportDiagnostics(): void {
    if (!this.enableDiagnostics || this.passes.length === 0) return;
    downloadJson('gaze-calibration-diagnostics', this.getDiagnosticsSnapshot());
  }

  public getDiagnosticsSnapshot(): CalibrationDiagnosticsSnapshot {
    const training = this.passes[0];
    const validation = this.getValidationPass();
    return {
      calibrationFitComparison: {
        passOrder: this.passes.map((pass, index) => ({ pass: index === 0 ? 'training' : 'validation', targetOrder: pass.targetOrder })),
        training: getPassDiagnostics(training),
        validation: validation ? getPassCaptureSummary(validation) : null,
        poseDistributionShift: getPoseDistributionShift(
          getPoseFeatureRanges(training.poseConditioned),
          getPoseFeatureRanges(validation?.poseConditioned ?? []),
        ),
        separatePassValidation: {
          ordinary: getOrdinaryValidationDiagnostics(training.all, validation?.all ?? []),
          poseConditioned: getAcceptedPoseValidationDiagnostics(
            training.poseConditioned,
            validation?.poseConditioned ?? [],
          ),
        },
      },
      eyeDiagnostics: { targets: this.eyeDiagnostics, passCount: this.passes.length },
    };
  }

  private getValidationPass(): PassData | null {
    return this.passes.slice(1).find(pass => hasCompleteTargetCoverage(pass)) ?? null;
  }
}

export function createModelTestingSession(options?: ModelTestingSessionOptions): ModelTestingSession {
  return new ModelTestingSession(options);
}
