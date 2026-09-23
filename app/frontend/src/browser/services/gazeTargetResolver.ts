import { ActionId } from '../../types/communication';
import { findGazeTarget } from '../../vision/estimation/gazeTarget';
import { GazeTargetBounds } from '../../vision/types/gazeTypes';

export function findVisibleTarget(
  board: HTMLDivElement,
  x: number,
  y: number,
): ActionId | null {
  const bounds: GazeTargetBounds[] = Array.from(
    board.querySelectorAll<HTMLButtonElement>('[data-action-id]'),
  ).map(button => {
    const rectangle = button.getBoundingClientRect();
    return {
      id: button.dataset.actionId!,
      left: rectangle.left / window.innerWidth,
      top: rectangle.top / window.innerHeight,
      right: rectangle.right / window.innerWidth,
      bottom: rectangle.bottom / window.innerHeight,
    };
  });

  return findGazeTarget({ x, y, confidence: 1, timestamp: performance.now() }, bounds) as ActionId | null;
}

