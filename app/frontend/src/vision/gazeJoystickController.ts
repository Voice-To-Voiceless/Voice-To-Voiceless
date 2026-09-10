import { NormalizedGazePoint } from './gazeTypes';

export type GazeJoystickOptions = {
  deadzone?: number;
  maximumSpeed?: number;
  acceleration?: number;
  deceleration?: number;
  invertX?: boolean;
  invertY?: boolean;
};

type Vector = {
  x: number;
  y: number;
};

export class GazeJoystickController {
  private readonly deadzone: number;
  private readonly maximumSpeed: number;
  private readonly acceleration: number;
  private readonly deceleration: number;
  private readonly invertX: boolean;
  private readonly invertY: boolean;
  private position: Vector = { x: 0.5, y: 0.5 };
  private velocity: Vector = { x: 0, y: 0 };
  private previousTimestamp: number | null = null;

  public constructor(options: GazeJoystickOptions = {}) {
    this.deadzone = options.deadzone ?? 0.02;
    this.maximumSpeed = options.maximumSpeed ?? 1.4;
    this.acceleration = options.acceleration ?? 8;
    this.deceleration = options.deceleration ?? 9;
    this.invertX = options.invertX ?? false;
    this.invertY = options.invertY ?? false;

    if (this.deadzone < 0 || this.deadzone >= 1) {
      throw new Error('Joystick deadzone must be at least zero and less than one.');
    }
    if (this.maximumSpeed <= 0 || this.acceleration <= 0 || this.deceleration <= 0) {
      throw new Error('Joystick speed and response values must be greater than zero.');
    }
  }

  public update(gaze: NormalizedGazePoint): Vector {
    const deltaSeconds = this.getDeltaSeconds(gaze.timestamp);
    const input = this.getInputVector(gaze);
    const targetVelocity = {
      x: input.x * this.maximumSpeed,
      y: input.y * this.maximumSpeed,
    };

    this.velocity = {
      x: moveTowards(
        this.velocity.x,
        targetVelocity.x,
        this.getResponseRate(this.velocity.x, targetVelocity.x) * deltaSeconds,
      ),
      y: moveTowards(
        this.velocity.y,
        targetVelocity.y,
        this.getResponseRate(this.velocity.y, targetVelocity.y) * deltaSeconds,
      ),
    };
    this.position = {
      x: clamp(this.position.x + this.velocity.x * deltaSeconds),
      y: clamp(this.position.y + this.velocity.y * deltaSeconds),
    };

    return { ...this.position };
  }

  public resetVelocity(): void {
    this.velocity = { x: 0, y: 0 };
    this.previousTimestamp = null;
  }

  public reset(position = { x: 0.5, y: 0.5 }): void {
    this.position = { x: clamp(position.x), y: clamp(position.y) };
    this.resetVelocity();
  }

  private getDeltaSeconds(timestamp: number): number {
    if (this.previousTimestamp === null) {
      this.previousTimestamp = timestamp;
      return 0;
    }

    const deltaSeconds = clamp(timestamp - this.previousTimestamp, 0, 1000) / 1000;
    this.previousTimestamp = timestamp;
    return deltaSeconds;
  }

  private getInputVector(gaze: NormalizedGazePoint): Vector {
    const rawInput = {
      x: (gaze.x - 0.5) * (this.invertX ? -1 : 1),
      y: (gaze.y - 0.5) * (this.invertY ? -1 : 1),
    };
    const magnitude = Math.hypot(rawInput.x, rawInput.y);
    if (magnitude <= this.deadzone) {
      return { x: 0, y: 0 };
    }

    const normalizedMagnitude = Math.min(1, (magnitude - this.deadzone) / (0.5 - this.deadzone));
    const response = normalizedMagnitude ** 2 / magnitude;
    return {
      x: rawInput.x * response,
      y: rawInput.y * response,
    };
  }

  private getResponseRate(current: number, target: number): number {
    return Math.abs(target) > Math.abs(current) ? this.acceleration : this.deceleration;
  }
}

function moveTowards(current: number, target: number, maximumDelta: number): number {
  if (Math.abs(target - current) <= maximumDelta) {
    return target;
  }

  return current + Math.sign(target - current) * maximumDelta;
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}