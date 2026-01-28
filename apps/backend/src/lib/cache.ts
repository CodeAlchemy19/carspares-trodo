/**
 * Redis Cache Client
 * 
 * Provides Redis connection and caching utilities.
 * Falls back gracefully if Redis is unavailable.
 * 
 * Uses ioredis for robust Redis operations with automatic reconnection.
 */

import Redis from 'ioredis';

// Singleton instance
let redis: Redis | null = null;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Get Redis client instance (Singleton)
 */
export function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: false,
        retryStrategy(times) {
            // Exponential backoff with max 2s
            if(times > 20) return null; // stop retrying after 20 attempts
            return Math.min(times * 100, 2000);
        }
    });

    // Error handling to prevent crashing
    redis.on('error', (err) => {
       // Suppress confusing connection errors in dev if redis is down
       if(process.env.NODE_ENV === 'development') {
           console.warn('[Redis] Connection warning (Is Redis running?)');
       } else {
           console.error('[Redis] Error:', err.message);
       }
    });
  }
  return redis;
}

/**
 * Check if Redis is available
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    const client = getRedisClient();
    return await client.ping() === 'PONG';
  } catch {
    return false;
  }
}

/**
 * Cache configuration by type
 */
export const CACHE_CONFIG: Record<string, { ttl: number }> = {
  // Long-lived caches (data changes rarely)
  vehicles: { ttl: 3600 },       // 1 hour
  manufacturers: { ttl: 3600 },  // 1 hour
  categories: { ttl: 1800 },     // 30 minutes
  
  // Medium caches
  products: { ttl: 300 },        // 5 minutes
  sku: { ttl: 300 },             // 5 minutes
  
  // Short caches
  search: { ttl: 60 },           // 1 minute
  default: { ttl: 300 }          // 5 minutes
};

/**
 * Get cache key prefix for a type
 */
export function getCacheKey(type: string, identifier: string): string {
  return `carspares:${type}:${identifier}`;
}

/**
 * Get cached value
 */
export async function getCached<T = any>(type: string, identifier: string): Promise<T | null> {
  try {
    const client = getRedisClient();
    const key = getCacheKey(type, identifier);
    const value = await client.get(key);
    
    if (value) {
      return JSON.parse(value);
    }
    return null;
  } catch (err) {
    // Silently fail - cache miss is not an error
    return null;
  }
}

/**
 * Set cached value
 */
export async function setCache(type: string, identifier: string, value: any, ttlOverride: number | null = null): Promise<void> {
  try {
    const client = getRedisClient();
    const key = getCacheKey(type, identifier);
    const config = CACHE_CONFIG[type] || CACHE_CONFIG.default;
    const ttl = ttlOverride || config.ttl;
    
    // ioredis uses 'EX' for seconds
    await client.set(key, JSON.stringify(value), 'EX', ttl);
  } catch (err: any) {
    // Silently fail - cache set failure is not critical
    console.warn('Cache set warning:', err.message);
  }
}

/**
 * Invalidate cache
 */
export async function invalidateCache(type: string, identifier: string): Promise<void> {
  try {
    const client = getRedisClient();
    const key = getCacheKey(type, identifier);
    await client.del(key);
  } catch (err: any) {
    console.warn('Cache invalidation warning:', err.message);
  }
}

/**
 * Cache wrapper for async functions
 * Automatically caches the result of an async function
 */
export async function withCache<T>(type: string, identifier: string, fn: () => Promise<T>): Promise<T> {
  // Try to get from cache
  const cached = await getCached<T>(type, identifier);
  if (cached !== null) {
    return cached;
  }
  
  // Cache miss - call function
  const result = await fn();
  
  // Store in cache
  if (result !== null && result !== undefined) {
    await setCache(type, identifier, result);
  }
  
  return result;
}
