import { GazeJoystickController } from '../src/vision/gazeJoystickController';

function gaze(x: number, y: number, timestamp: number) {
  return { x, y, confidence: 1, timestamp };
}

test('keeps the cursor still inside the radial deadzone', () => {
  const controller = new GazeJoystickController({ deadzone: 0.2 });

  expect(controller.update(gaze(0.5, 0.5, 0))).toEqual({ x: 0.5, y: 0.5 });
  expect(controller.update(gaze(0.6, 0.5, 1000))).toEqual({ x: 0.5, y: 0.5 });
});

test('moves in the requested direction and supports axis inversion', () => {
  const controller = new GazeJoystickController({
    deadzone: 0,
    maximumSpeed: 1,
    acceleration: 100,
    deceleration: 100,
    invertX: true,
  });

  controller.update(gaze(0.5, 0.5, 0));
  const position = controller.update(gaze(1, 0.5, 1000));

  expect(position.x).toBeLessThan(0.5);
  expect(position.y).toBeCloseTo(0.5);
});

test('integrates velocity over time and clamps at the screen edge', () => {
  const controller = new GazeJoystickController({
    deadzone: 0,
    maximumSpeed: 1,
    acceleration: 100,
    deceleration: 100,
  });

  controller.update(gaze(0.5, 0.5, 0));
  expect(controller.update(gaze(1, 0.5, 1000)).x).toBeCloseTo(1);
  expect(controller.update(gaze(1, 0.5, 2000)).x).toBe(1);
});

test('resets velocity without losing the cursor position', () => {
  const controller = new GazeJoystickController({
    deadzone: 0,
    maximumSpeed: 1,
    acceleration: 100,
    deceleration: 100,
  });

  controller.update(gaze(0.5, 0.5, 0));
  const movedPosition = controller.update(gaze(1, 0.5, 1000));
  controller.resetVelocity();

  expect(controller.update(gaze(0.5, 0.5, 2000))).toEqual(movedPosition);
});