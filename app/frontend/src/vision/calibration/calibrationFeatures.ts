import { GazeDiagnostics } from '../estimation/gazeEstimator';
import { RelativeFacePose } from '../estimation/facePoseEstimator';
import { RidgeCalibrationFeatures } from './ridgeCalibration';

export function getCalibrationFeatures(
  diagnostics: GazeDiagnostics,
  pose: RelativeFacePose | null,
): RidgeCalibrationFeatures | undefined {
  if (diagnostics.leftPosition === null || diagnostics.rightPosition === null || pose === null || pose.yaw === null || pose.pitch === null || pose.faceCenterX === undefined || pose.faceCenterY === undefined) return undefined;
  return {
    leftIrisX: diagnostics.leftPosition.x,
    leftIrisY: diagnostics.leftPosition.y,
    rightIrisX: diagnostics.rightPosition.x,
    rightIrisY: diagnostics.rightPosition.y,
    yaw: pose.yaw,
    pitch: pose.pitch,
    roll: pose.rollRadians,
    eyeScale: pose.eyeScale,
    faceCenterX: pose.faceCenterX,
    faceCenterY: pose.faceCenterY,
  };
}
