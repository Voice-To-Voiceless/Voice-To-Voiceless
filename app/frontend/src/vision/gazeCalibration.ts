import { NormalizedGazePoint } from './gazeTypes';
import { aggregateSamples, clamp, evaluate, fitRobustMapping, getCalibrationFitDiagnostics, MAX_RMS_RESIDUAL } from './calibrationMath';

export type CalibrationTarget = { x: number; y: number };
export type CalibrationSample = { gaze: CalibrationTarget; target: CalibrationTarget };
export type CalibrationFitDiagnostics = {
  accepted: boolean;
  rmsResidual: number | null;
  targetResiduals: Array<{ target: CalibrationTarget; residual: number }>;
  rejectionReason: 'fewer than three target groups' | 'too many unstable target groups' | 'singular calibration matrix' | 'residual exceeds threshold' | null;
};

export class GazeCalibrationMapper {
  private constructor(private readonly xCoefficients: [number, number, number], private readonly yCoefficients: [number, number, number]) {}

  public static fit(samples: CalibrationSample[]): GazeCalibrationMapper | null {
    const aggregatedSamples = aggregateSamples(samples);
    const diagnostics = getCalibrationFitDiagnostics(samples);
    if (diagnostics.rejectionReason !== null || diagnostics.rmsResidual === null || diagnostics.rmsResidual > MAX_RMS_RESIDUAL) {
      console.warn('[gaze-calibration] fit rejected', {
        reason: diagnostics.rejectionReason ?? 'residual exceeds threshold',
        sampleCount: samples.length,
        targetGroupCount: aggregatedSamples.length,
        targetResiduals: diagnostics.targetResiduals,
      });
      return null;
    }
    const fit = fitRobustMapping(aggregatedSamples);
    return fit === null ? null : new GazeCalibrationMapper(fit.xCoefficients, fit.yCoefficients);
  }

  public map(gaze: NormalizedGazePoint): NormalizedGazePoint {
    return { ...gaze, x: clamp(evaluate(this.xCoefficients, gaze.x, gaze.y)), y: clamp(evaluate(this.yCoefficients, gaze.x, gaze.y)) };
  }
}

export { getCalibrationFitDiagnostics } from './calibrationMath';
