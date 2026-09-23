export type GazeTargetCandidate<T extends string = string> = T | null;

type CandidateSample<T extends string> = {
  candidate: T;
  timestamp: number;
};

export class GazeTargetVoting<T extends string = string> {
  private readonly windowMs: number;
  private samples: Array<CandidateSample<T>> = [];

  public constructor(windowMs = 250) {
    if (windowMs <= 0) throw new Error('Voting window must be greater than zero.');
    this.windowMs = windowMs;
  }

  public update(candidate: GazeTargetCandidate<T>, timestamp: number): T | null {
    this.prune(timestamp);
    if (candidate !== null) this.samples.push({ candidate, timestamp });
    if (this.samples.length === 0) return null;

    const counts = new Map<T, number>();
    this.samples.forEach(sample => counts.set(sample.candidate, (counts.get(sample.candidate) ?? 0) + 1));
    const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1]);
    if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return null;
    return ranked[0][0];
  }

  public reset(): void {
    this.samples = [];
  }

  private prune(timestamp: number): void {
    this.samples = this.samples.filter(sample => timestamp - sample.timestamp <= this.windowMs);
  }
}