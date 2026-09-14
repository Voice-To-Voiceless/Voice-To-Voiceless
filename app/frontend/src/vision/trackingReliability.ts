export class FaceTrackingLossTracker {
  private readonly lostFrameThreshold: number;
  private lostFrames = 0;

  public constructor(lostFrameThreshold = 3) {
    if (lostFrameThreshold <= 0) {
      throw new Error('Lost frame threshold must be greater than zero.');
    }

    this.lostFrameThreshold = lostFrameThreshold;
  }

  public markDetected(): void {
    this.lostFrames = 0;
  }

  public markLost(): boolean {
    this.lostFrames += 1;
    return this.lostFrames >= this.lostFrameThreshold;
  }

  public reset(): void {
    this.lostFrames = 0;
  }
}