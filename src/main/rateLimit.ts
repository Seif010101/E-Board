// Consecutive-failure limiter: after `threshold` failures a key is blocked for `baseMs`,
// doubling with every further failure up to `maxMs`. A success clears the key.

export interface RateLimitPolicy {
  threshold: number
  baseMs: number
  maxMs: number
}

export const LOGIN_POLICY: RateLimitPolicy = { threshold: 5, baseMs: 30_000, maxMs: 15 * 60_000 }

interface Entry {
  failures: number
  blockedUntil: number
  touched: number
}

/** Entries idle longer than this are forgotten. */
const IDLE_MS = 24 * 60 * 60_000
const MAX_ENTRIES = 10_000

export class RateLimiter {
  private entries = new Map<string, Entry>()

  constructor(
    private readonly policy: RateLimitPolicy = LOGIN_POLICY,
    private readonly now: () => number = Date.now
  ) {}

  /** Milliseconds until `key` may try again; 0 when allowed. */
  retryAfter(key: string): number {
    const e = this.entries.get(key)
    if (!e) return 0
    return Math.max(0, e.blockedUntil - this.now())
  }

  /** Records a failure and returns the resulting block duration (0 while under the threshold). */
  fail(key: string): number {
    const now = this.now()
    this.prune(now)
    const e = this.entries.get(key) ?? { failures: 0, blockedUntil: 0, touched: now }
    e.failures++
    e.touched = now
    let blockMs = 0
    if (e.failures >= this.policy.threshold) {
      const exp = Math.min(e.failures - this.policy.threshold, 30)
      blockMs = Math.min(this.policy.baseMs * 2 ** exp, this.policy.maxMs)
      e.blockedUntil = now + blockMs
    }
    this.entries.set(key, e)
    return blockMs
  }

  succeed(key: string): void {
    this.entries.delete(key)
  }

  private prune(now: number): void {
    if (this.entries.size < MAX_ENTRIES) return
    for (const [key, e] of this.entries) {
      if (now - e.touched > IDLE_MS && e.blockedUntil <= now) this.entries.delete(key)
    }
    // Still full (e.g. a spray of distinct usernames): drop the oldest half.
    if (this.entries.size >= MAX_ENTRIES) {
      const oldest = [...this.entries].sort((a, b) => a[1].touched - b[1].touched)
      for (const [key] of oldest.slice(0, Math.floor(oldest.length / 2))) this.entries.delete(key)
    }
  }
}
