/**
 * Smart caching system for API responses with TTL support
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheOptions {
  defaultTtl?: number;
  maxSize?: number;
  enableCompression?: boolean;
}

export class SmartCache {
  private cache = new Map<string, CacheEntry<any>>();
  private options: Required<CacheOptions>;

  constructor(options: CacheOptions = {}) {
    this.options = {
      defaultTtl: options.defaultTtl || 30000, // 30 seconds default
      maxSize: options.maxSize || 100,
      enableCompression: options.enableCompression || false,
    };
  }

  /**
   * Store data in cache with optional TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.options.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data: this.options.enableCompression ? this.compress(data) : data,
      timestamp: Date.now(),
      ttl: ttl || this.options.defaultTtl,
      accessCount: 0,
      lastAccessed: Date.now(),
    };

    this.cache.set(key, entry);
  }

  /**
   * Retrieve data from cache if not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    return this.options.enableCompression
      ? this.decompress(entry.data)
      : entry.data;
  }

  /**
   * Check if key exists in cache and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Remove entry from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Invalidate entries matching a pattern
   */
  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    totalAccesses: number;
  } {
    const totalAccesses = Array.from(this.cache.values()).reduce(
      (sum, entry) => sum + entry.accessCount,
      0
    );

    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      hitRate: totalAccesses > 0 ? 1 : 0, // Simplified hit rate calculation
      totalAccesses,
    };
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Clean expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lruKey = "";
    let lruTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  /**
   * Simple compression for large objects (placeholder)
   */
  private compress<T>(data: T): T {
    // In a real implementation, you might use LZ compression
    // For now, just return the data as-is
    return data;
  }

  /**
   * Simple decompression (placeholder)
   */
  private decompress<T>(data: T): T {
    // In a real implementation, you would decompress
    return data;
  }
}

// Global cache instance
export const globalCache = new SmartCache({
  defaultTtl: 30000,
  maxSize: 100,
  enableCompression: false,
});
