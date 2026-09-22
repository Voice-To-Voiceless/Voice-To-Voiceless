export type DwellSelection = {
  targetId: string;
  completedAt: number;
};

export class DwellSelector {
  private activeTargetId: string | null = null;
  private startedAt: number | null = null;
  private completedTargetId: string | null = null;
  private readonly dwellDurationMs: number;
  private readonly gracePeriodMs: number;
  private lastUpdateAt: number | null = null;
  private stableUpdates = 0;

  public constructor(dwellDurationMs: number, gracePeriodMs = 250) {
    if (dwellDurationMs <= 0) {
      throw new Error('Dwell duration must be greater than zero.');
    }
    if (gracePeriodMs < 0) {
      throw new Error('Dwell grace period must not be negative.');
    }

    this.dwellDurationMs = dwellDurationMs;
    this.gracePeriodMs = gracePeriodMs;
  }

  public begin(targetId: string, timestamp: number): void {
    if (this.activeTargetId !== targetId) {
      this.activeTargetId = targetId;
      this.startedAt = timestamp;
      this.stableUpdates = 1;
    } else {
      this.stableUpdates += 1;
    }
    this.lastUpdateAt = timestamp;
  }

  public update(targetId: string | null, timestamp: number): DwellSelection | null {
    if (targetId === null) {
      if (this.activeTargetId === null || this.lastUpdateAt === null || timestamp - this.lastUpdateAt > this.gracePeriodMs) {
        this.cancel();
      }
      return null;
    }
    if (this.completedTargetId === targetId) {
      return null;
    }

    this.begin(targetId, timestamp);

    if (this.startedAt === null || this.stableUpdates < 2 || timestamp - this.startedAt < this.dwellDurationMs) {
      return null;
    }

    const selection = {
      targetId,
      completedAt: timestamp,
    };
    this.completedTargetId = targetId;
    this.cancel();
    return selection;
  }

  public progress(targetId: string, timestamp: number): number {
    if (this.activeTargetId !== targetId || this.startedAt === null || this.stableUpdates < 2) {
      return 0;
    }

    return Math.min(1, Math.max(0, (timestamp - this.startedAt) / this.dwellDurationMs));
  }

  public getActiveTargetId(): string | null {
    return this.activeTargetId;
  }

  public cancel(): void {
    this.activeTargetId = null;
    this.startedAt = null;
    this.lastUpdateAt = null;
    this.stableUpdates = 0;
  }

  public resetCompletedTarget(): void {
    this.completedTargetId = null;
  }
}