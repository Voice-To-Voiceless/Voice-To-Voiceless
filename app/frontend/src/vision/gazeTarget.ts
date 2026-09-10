import { GazeTargetBounds, NormalizedGazePoint } from './gazeTypes';

export function findGazeTarget(
  point: NormalizedGazePoint,
  targets: GazeTargetBounds[],
  minimumConfidence = 0.5,
): string | null {
  if (point.confidence < minimumConfidence) {
    return null;
  }

  return (
    targets.find(
      target =>
        point.x >= target.left &&
        point.x <= target.right &&
        point.y >= target.top &&
        point.y <= target.bottom,
    )?.id ?? null
  );
}