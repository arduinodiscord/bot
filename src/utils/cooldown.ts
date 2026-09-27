/**
 * A simple per-user cooldown. Entries expire lazily and are pruned whenever
 * a new one is recorded, so the map can't grow without bound.
 */
export class Cooldown {
  private readonly lastUsed = new Map<string, number>();

  public constructor(private readonly ms: number) {}

  /** Milliseconds left before `userId` may go again (0 when free). */
  public remaining(userId: string, now = Date.now()): number {
    const last = this.lastUsed.get(userId);
    return last === undefined ? 0 : Math.max(0, last + this.ms - now);
  }

  public record(userId: string, now = Date.now()): void {
    for (const [id, at] of this.lastUsed)
      if (at + this.ms <= now) this.lastUsed.delete(id);
    this.lastUsed.set(userId, now);
  }

  public get size(): number {
    return this.lastUsed.size;
  }
}
