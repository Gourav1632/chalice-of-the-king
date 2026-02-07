import type { Socket } from "socket.io";

export type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
};

type TokenBucket = {
  tokens: number;
  lastRefillTime: number;
};

export function createSocketRateLimiter(options: RateLimitOptions) {
  const buckets = new Map<string, TokenBucket>();
  const { windowMs, maxRequests } = options;

  // Tokens refill at this rate: maxRequests tokens per windowMs
  const refillRatePerMs = maxRequests / windowMs;

  return (socket: Socket, next: (err?: Error) => void) => {
    const now = Date.now();
    const key = socket.id;

    let bucket = buckets.get(key);

    // Initialize bucket on first request
    if (!bucket) {
      bucket = { tokens: maxRequests, lastRefillTime: now };
      buckets.set(key, bucket);
    }

    // Refill tokens based on elapsed time
    const timeSinceLastRefill = now - bucket.lastRefillTime;
    const tokensToAdd = timeSinceLastRefill * refillRatePerMs;
    bucket.tokens = Math.min(maxRequests, bucket.tokens + tokensToAdd);
    bucket.lastRefillTime = now;

    // Check if we have at least 1 token
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      next();
      return;
    }

    // Calculate retry after: time needed to refill 1 token
    const retryAfterMs = (1 - bucket.tokens) / refillRatePerMs;
    const err = new Error("Rate limit exceeded.");
    (err as { data?: { code: string; retryAfterMs: number } }).data = {
      code: "RATE_LIMITED",
      retryAfterMs: Math.ceil(retryAfterMs),
    };
    next(err);
  };
}
