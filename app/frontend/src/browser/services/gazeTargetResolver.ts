import { findGazeTarget } from '../../vision/estimation/gazeTarget';
import { GazeTargetBounds } from '../../vision/types/gazeTypes';

export function findVisibleTarget(
  board: HTMLDivElement,
  x: number,
  y: number,
): string | null {
  const targetRoot = board.querySelector<HTMLElement>('.patient-notification-popup') ?? board;
  const elementAtGaze = document.elementFromPoint(x * window.innerWidth, y * window.innerHeight);
  const buttonAtGaze = elementAtGaze?.closest<HTMLButtonElement>('[data-action-id]');
  if (buttonAtGaze && targetRoot.contains(buttonAtGaze)) {
    return buttonAtGaze.dataset.actionId ?? null;
  }
  const bounds: GazeTargetBounds[] = Array.from(
    targetRoot.querySelectorAll<HTMLButtonElement>('[data-action-id]'),
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

  return findGazeTarget({ x, y, confidence: 1, timestamp: performance.now() }, bounds) as string | null;
}

