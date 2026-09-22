import { GazeTargetBounds, NormalizedGazePoint } from './gazeTypes';

export function findGazeTarget(
  point: NormalizedGazePoint,
  targets: GazeTargetBounds[],
  minimumConfidence = 0.5,
): string | null {
  if (point.confidence < minimumConfidence) {
    return null;
  }
  if (targets.length === 0) return null;

  const boardBounds = targets.reduce(
    (bounds, target) => ({
      left: Math.min(bounds.left, target.left),
      top: Math.min(bounds.top, target.top),
      right: Math.max(bounds.right, target.right),
      bottom: Math.max(bounds.bottom, target.bottom),
    }),
    { left: Number.POSITIVE_INFINITY, top: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY },
  );
  if (point.x < boardBounds.left || point.x > boardBounds.right || point.y < boardBounds.top || point.y > boardBounds.bottom) return null;

  const ranked = targets
    .map(target => ({ target, distance: normalizedDistance(point, target) }))
    .sort((left, right) => left.distance - right.distance);
  const closest = ranked[0];
  const runnerUp = ranked[1];
  if (!closest || closest.distance > 1.25) return null;
  if (runnerUp && runnerUp.distance - closest.distance < 0.15) return null;
  return closest.target.id;
}

function normalizedDistance(point: NormalizedGazePoint, target: GazeTargetBounds): number {
  const width = Math.max(target.right - target.left, Number.EPSILON);
  const height = Math.max(target.bottom - target.top, Number.EPSILON);
  const centerX = (target.left + target.right) / 2;
  const centerY = (target.top + target.bottom) / 2;
  return Math.hypot((point.x - centerX) / width, (point.y - centerY) / height);
}