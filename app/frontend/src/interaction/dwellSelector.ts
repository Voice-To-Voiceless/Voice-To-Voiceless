export type DwellSelection = {
  targetId: string;
  completedAt: number;
};

export class DwellSelector {
  private activeTargetId: string | null = null;
  private startedAt: number | null = null;
  private readonly dwellDurationMs: number;

  public constructor(dwellDurationMs: number) {
    if (dwellDurationMs <= 0) {
      throw new Error('Dwell duration must be greater than zero.');
    }

    this.dwellDurationMs = dwellDurationMs;
  }

  public begin(targetId: string, timestamp: number): void {
    if (this.activeTargetId !== targetId) {
      this.activeTargetId = targetId;
      this.startedAt = timestamp;
    }
  }

  public update(targetId: string, timestamp: number): DwellSelection | null {
    this.begin(targetId, timestamp);

    if (this.startedAt === null || timestamp - this.startedAt < this.dwellDurationMs) {
      return null;
    }

    const selection = {
      targetId,
      completedAt: timestamp,
    };
    this.cancel();
    return selection;
  }

  public progress(targetId: string, timestamp: number): number {
    if (this.activeTargetId !== targetId || this.startedAt === null) {
      return 0;
    }

    return Math.min(1, Math.max(0, (timestamp - this.startedAt) / this.dwellDurationMs));
  }

  public cancel(): void {
    this.activeTargetId = null;
    this.startedAt = null;
  }
}