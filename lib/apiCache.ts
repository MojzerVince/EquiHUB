/**
 * API Cache Utility
 * Provides caching mechanism for frequently called API endpoints
 * to reduce redundant network requests and improve performance
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class APICache {
  private cache = new Map<string, CacheEntry<any>>();
  
  // Default cache duration: 5 minutes
  private defaultTTL = 5 * 60 * 1000;
  
  // Different TTL for different data types
  private ttlConfig = {
    horses: 3 * 60 * 1000,      // 3 minutes - frequently updated
    profiles: 10 * 60 * 1000,   // 10 minutes - less frequently updated
    stables: 15 * 60 * 1000,    // 15 minutes - rarely updated
    badges: 30 * 60 * 1000,     // 30 minutes - rarely updated
  };

  /**
   * Get cached data if it exists and hasn't expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Set data in cache with optional custom TTL
   */
  set<T>(key: string, data: T, customTTL?: number): void {
    const ttl = customTTL || this.defaultTTL;
    const now = Date.now();
    
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });
  }

  /**
   * Set data with predefined TTL based on data type
   */
  setByType<T>(key: string, data: T, type: keyof typeof this.ttlConfig): void {
    this.set(key, data, this.ttlConfig[type]);
  }

  /**
   * Remove specific cache entry
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear expired entries
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let expired = 0;
    let active = 0;
    
    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expired++;
      } else {
        active++;
      }
    }
    
    return {
      total: this.cache.size,
      active,
      expired,
      hitRate: this.getHitRate(),
    };
  }

  private hits = 0;
  private misses = 0;

  private getHitRate(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : this.hits / total;
  }

  /**
   * Wrapper function to cache API calls
   */
  async cachedApiCall<T>(
    key: string,
    apiFunction: () => Promise<T>,
    type?: keyof typeof this.ttlConfig,
    customTTL?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = this.get<T>(key);
    if (cached) {
      this.hits++;
      return cached;
    }

    this.misses++;
    
    // Call the API function
    try {
      const result = await apiFunction();
      
      // Cache the result
      if (type) {
        this.setByType(key, result, type);
      } else {
        this.set(key, result, customTTL);
      }
      
      return result;
    } catch (error) {
      // Don't cache errors
      throw error;
    }
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Cache key generators for consistent naming
   */
  static keys = {
    horses: (userId?: string) => userId ? `horses:${userId}` : 'horses:all',
    horseCount: (userId?: string) => userId ? `horse_count:${userId}` : 'horse_count:all',
    profile: (userId: string) => `profile:${userId}`,
    userBadges: (userId: string) => `user_badges:${userId}`,
    stables: () => 'stables:all',
    friends: (userId: string) => `friends:${userId}`,
    friendsCount: (userId: string) => `friends_count:${userId}`,
  };
}

// Export singleton instance
export const apiCache = new APICache();

// Export cache keys for consistency
export const CacheKeys = APICache.keys;

export default apiCache;
