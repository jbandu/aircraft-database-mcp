/**
 * Simple in-memory cache with TTL support
 */

import { createLogger } from './logger.js';

const logger = createLogger('cache');

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class Cache<T = any> {
  private cache: Map<string, CacheEntry<T>>;
  private defaultTTL: number;

  constructor(defaultTTL: number = 300000) {
    // Default 5 minutes
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
  }

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      logger.debug(`Cache miss (expired): ${key}`);
      return null;
    }

    logger.debug(`Cache hit: ${key}`);
    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);

    this.cache.set(key, {
      value,
      expiresAt,
    });

    logger.debug(`Cache set: ${key} (TTL: ${ttl || this.defaultTTL}ms)`);
  }

  /**
   * Delete value from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
    logger.debug(`Cache delete: ${key}`);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    logger.info('Cache cleared');
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Remove expired entries
   */
  cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.info(`Cache cleanup: removed ${removed} expired entries`);
    }
  }

  /**
   * Get or set value (fetch if not cached)
   */
  async getOrSet(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get(key);

    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Generate cache key from object
   */
  static generateKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}=${JSON.stringify(params[key])}`)
      .join('&');

    return `${prefix}:${sortedParams}`;
  }
}

// Global cache instance
export const globalCache = new Cache();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  globalCache.cleanup();
}, 300000);

/**
 * Cache decorator for functions
 */
export function cached(ttl?: number) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = Cache.generateKey(propertyKey, { args });
      const cached = globalCache.get(cacheKey);

      if (cached !== null) {
        return cached;
      }

      const result = await originalMethod.apply(this, args);
      globalCache.set(cacheKey, result, ttl);
      return result;
    };

    return descriptor;
  };
}
