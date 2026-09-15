import { CalibrationSample, getCalibrationFitDiagnostics } from '../vision/gazeCalibration';
import { NormalizedGazePoint } from '../vision/gazeTypes';
import {
  getPoseConditionedCalibrationFitDiagnostics,
  getPoseLeaveOneTargetOutDiagnostics,
  PoseSample,
} from './poseCalibrationDiagnostics';

export type CalibrationDiagnosticPoints = {
  raw: NormalizedGazePoint;
  compensated: NormalizedGazePoint;
  pose: { yaw: number; pitch: number } | null;
};

type CalibrationSessionData = {
  all: CalibrationSample[];
  raw: CalibrationSample[];
  compensated: CalibrationSample[];
  poseConditioned: PoseSample[];
};

export class ModelTestingSession {
  private readonly data: CalibrationSessionData = { all: [], raw: [], compensated: [], poseConditioned: [] };
  private eyeDiagnostics: Array<Record<string, unknown>> = [];
  private eyeDiagnosticsTarget = -1;

  public reset(): void {
    this.data.all = [];
    this.data.raw = [];
    this.data.compensated = [];
    this.data.poseConditioned = [];
    this.eyeDiagnostics = [];
    this.eyeDiagnosticsTarget = -1;
  }

  public recordEyeDiagnostics(targetIndex: number, entry: Record<string, unknown>): void {
    if (this.eyeDiagnosticsTarget === targetIndex) return;
    this.eyeDiagnosticsTarget = targetIndex;
    this.eyeDiagnostics.push(entry);
  }

  public recordCalibrationSample(target: CalibrationSample['target'], points: CalibrationDiagnosticPoints): void {
    this.data.raw.push({ gaze: points.raw, target });
    this.data.compensated.push({ gaze: points.compensated, target });
    if (points.pose !== null) this.data.poseConditioned.push({ gaze: points.raw, target, pose: points.pose });
  }

  public recordPrimarySample(sample: CalibrationSample): void {
    this.data.all.push(sample);
  }

  public complete(): void {
    downloadJson('gaze-calibration-fit-comparison', {
      smoothed: getCalibrationFitDiagnostics(this.data.all),
      raw: getCalibrationFitDiagnostics(this.data.raw),
      compensated: getCalibrationFitDiagnostics(this.data.compensated),
      poseConditioned: getPoseConditionedCalibrationFitDiagnostics(this.data.poseConditioned),
      poseLeaveOneTargetOut: getPoseLeaveOneTargetOutDiagnostics(this.data.poseConditioned),
    });
    downloadJson('gaze-eye-diagnostics', { targets: this.eyeDiagnostics });
  }
}

export function createModelTestingSession(): ModelTestingSession {
  return new ModelTestingSession();
}

function downloadJson(name: string, value: unknown): void {
  if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
