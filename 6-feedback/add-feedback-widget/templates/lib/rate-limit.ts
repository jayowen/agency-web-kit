/**
 * Simple in-memory rate limiter.
 *
 * Tracks { count, windowStart } per key in a Map. Each call:
 *   - resets the counter if the window has rolled over
 *   - increments the counter
 *   - returns whether the caller is allowed
 *
 * NOTE: in-memory only — on multi-instance deploys (e.g. Vercel serverless
 * with concurrent lambdas) this will be best-effort. Swap for @upstash/ratelimit
 * + Redis for hard guarantees.
 */

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

let lastSweep = 0;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 min

function sweep(now: number, maxWindowMs: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  // Use Array.from to avoid ES iteration target issues
  Array.from(buckets.entries()).forEach(([key, bucket]) => {
    if (now - bucket.windowStart > maxWindowMs) {
      buckets.delete(key);
    }
  });
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check + record a hit. Returns { allowed: false } when the limit is exceeded.
 *
 * @param key   stable identifier for the bucket (include the route + IP/email)
 * @param limit max hits allowed per window
 * @param windowMs window length in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now, Math.max(windowMs, 60_000));

  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    bucket = { count: 0, windowStart: now };
    buckets.set(key, bucket);
  }
  bucket.count += 1;

  const remaining = Math.max(0, limit - bucket.count);
  const resetAt = bucket.windowStart + windowMs;
  return { allowed: bucket.count <= limit, remaining, resetAt };
}

/** Best-effort client IP from a Next.js request. Falls back to 'unknown'. */
export function getClientIp(request: Request | { headers: Headers }): string {
  const h = (request as any).headers as Headers;
  const xff = h.get?.('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const real = h.get?.('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}
