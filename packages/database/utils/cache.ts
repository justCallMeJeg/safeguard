/**
 * LRU Cache with TTL support for database query caching
 */

import type { CacheEntry, CacheOptions } from "../types/index.js";

/**
 * A simple LRU (Least Recently Used) cache with TTL (Time To Live) support.
 * Used to reduce database queries for frequently accessed data.
 */
export class LRUCache<K, V> {
  private cache: Map<K, CacheEntry<V>>;
  private readonly maxSize: number;
  private readonly ttl: number;
  private readonly updateOnAccess: boolean;

  constructor(options: CacheOptions) {
    this.cache = new Map();
    this.maxSize = options.maxSize;
    this.ttl = options.ttl;
    this.updateOnAccess = options.updateOnAccess ?? false;
  }

  /**
   * Get an item from the cache
   * @param key - The cache key
   * @returns The cached value or undefined if not found/expired
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if the entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used) by re-inserting
    this.cache.delete(key);

    if (this.updateOnAccess) {
      // Update TTL on access
      this.cache.set(key, {
        value: entry.value,
        expiresAt: Date.now() + this.ttl,
      });
    } else {
      this.cache.set(key, entry);
    }

    return entry.value;
  }

  /**
   * Set an item in the cache
   * @param key - The cache key
   * @param value - The value to cache
   * @param customTtl - Optional custom TTL for this specific entry
   */
  set(key: K, value: V, customTtl?: number): void {
    // If key exists, delete it first (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // If cache is at max size, remove the oldest (first) entry
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (customTtl ?? this.ttl),
    });
  }

  /**
   * Check if a key exists in the cache (and is not expired)
   * @param key - The cache key
   * @returns True if the key exists and is not expired
   */
  has(key: K): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete an item from the cache
   * @param key - The cache key
   * @returns True if the item was deleted
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all items from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the current size of the cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Remove all expired entries from the cache
   * @returns The number of entries removed
   */
  prune(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get all valid (non-expired) keys in the cache
   */
  keys(): K[] {
    const now = Date.now();
    const validKeys: K[] = [];

    for (const [key, entry] of this.cache) {
      if (now <= entry.expiresAt) {
        validKeys.push(key);
      }
    }

    return validKeys;
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; maxSize: number; ttl: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
    };
  }
}

/**
 * Default cache instances for common use cases
 */

/** Guild settings cache - 5 minute TTL, 1000 entries max */
export const guildCache = new LRUCache<string, unknown>({
  maxSize: 1000,
  ttl: 5 * 60 * 1000, // 5 minutes
  updateOnAccess: true,
});

/** Short-lived cache for rate limiting - 1 minute TTL */
export const rateLimitCache = new LRUCache<string, number>({
  maxSize: 10000,
  ttl: 60 * 1000, // 1 minute
  updateOnAccess: false,
});
