/**
 * Rate Limiter
 *
 * Implements token bucket algorithm for rate limiting
 */

import { createLogger } from './logger.js';

const logger = createLogger('rate-limiter');

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private buckets: Map<string, RateLimitBucket>;
  private maxTokens: number;
  private refillRate: number; // tokens per second
  private refillInterval: number; // ms

  constructor(maxTokens: number = 100, refillRate: number = 10) {
    this.buckets = new Map();
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.refillInterval = 1000; // 1 second

    // Cleanup old buckets every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if request is allowed
   */
  allow(key: string, cost: number = 1): boolean {
    const bucket = this.getBucket(key);
    this.refill(bucket);

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      logger.debug(`Rate limit OK for ${key}: ${bucket.tokens} tokens remaining`);
      return true;
    }

    logger.warn(`Rate limit exceeded for ${key}: ${bucket.tokens} tokens remaining, need ${cost}`);
    return false;
  }

  /**
   * Get or create bucket for key
   */
  private getBucket(key: string): RateLimitBucket {
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = {
        tokens: this.maxTokens,
        lastRefill: Date.now(),
      };
      this.buckets.set(key, bucket);
    }

    return bucket;
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refill(bucket: RateLimitBucket): void {
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;

    if (elapsed >= this.refillInterval) {
      const tokensToAdd = Math.floor(elapsed / this.refillInterval) * this.refillRate;
      bucket.tokens = Math.min(bucket.tokens + tokensToAdd, this.maxTokens);
      bucket.lastRefill = now;
    }
  }

  /**
   * Get remaining tokens for a key
   */
  getRemaining(key: string): number {
    const bucket = this.getBucket(key);
    this.refill(bucket);
    return bucket.tokens;
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.buckets.delete(key);
    logger.info(`Rate limit reset for ${key}`);
  }

  /**
   * Clear all rate limits
   */
  clear(): void {
    this.buckets.clear();
    logger.info('All rate limits cleared');
  }

  /**
   * Remove stale buckets (not used in last hour)
   */
  private cleanup(): void {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    let removed = 0;

    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.lastRefill < oneHourAgo) {
        this.buckets.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.info(`Rate limiter cleanup: removed ${removed} stale buckets`);
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    activeBuckets: number;
    maxTokens: number;
    refillRate: number;
  } {
    return {
      activeBuckets: this.buckets.size,
      maxTokens: this.maxTokens,
      refillRate: this.refillRate,
    };
  }
}

// Global rate limiter instance
// 100 tokens per bucket, refill 10 tokens/second = 10 requests/second sustained
export const globalRateLimiter = new RateLimiter(100, 10);

/**
 * Rate limiting middleware function
 */
export function checkRateLimit(key: string, cost: number = 1): boolean {
  return globalRateLimiter.allow(key, cost);
}

/**
 * Rate limit error
 */
export class RateLimitError extends Error {
  constructor(message: string = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
  }
}
