import { GazeDiagnostics } from '../estimation/gazeEstimator';
import { RelativeFacePose } from '../estimation/facePoseEstimator';
import { RidgeCalibrationFeatures } from './ridgeCalibration';
import { L2CSAngularGaze } from '../estimation/l2csGaze';

export function getCalibrationFeatures(
  diagnostics: GazeDiagnostics,
  pose: RelativeFacePose | null,
  l2cs?: L2CSAngularGaze,
): RidgeCalibrationFeatures | undefined {
  if (pose === null || pose.yaw === null || pose.pitch === null || pose.faceCenterX === undefined || pose.faceCenterY === undefined) return undefined;
  if (!l2cs && (diagnostics.leftPosition === null || diagnostics.rightPosition === null)) return undefined;
  return {
    leftIrisX: diagnostics.leftPosition?.x,
    leftIrisY: diagnostics.leftPosition?.y,
    rightIrisX: diagnostics.rightPosition?.x,
    rightIrisY: diagnostics.rightPosition?.y,
    yaw: pose.yaw,
    pitch: pose.pitch,
    roll: pose.rollRadians,
    eyeScale: pose.eyeScale,
    faceCenterX: pose.faceCenterX,
    faceCenterY: pose.faceCenterY,
    l2csYaw: l2cs?.yaw,
    l2csPitch: l2cs?.pitch,
  };
}
