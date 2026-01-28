/**
 * Redis-based Rate Limiter
 * 
 * Implements a simple Fixed Window Counter algorithm.
 */

import { getRedisClient } from "./cache";

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
}

/**
 * Check rate limit for a given key
 * @param key Unique identifier (e.g., IP address or API key)
 * @param limit Max requests allowed in the window
 * @param windowSeconds Duration of the window in seconds
 */
export async function checkRateLimit(key: string, limit: number = 60, windowSeconds: number = 60): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const now = Date.now();
  const redisKey = `ratelimit:${key}`;

  try {
    // Pipeline for atomicity
    const pipeline = redis.pipeline();
    pipeline.incr(redisKey);
    pipeline.ttl(redisKey);
    
    const result = await pipeline.exec();
    
    // Parse results
    // result[0] is INCR: [error, newValue]
    // result[1] is TTL: [error, allowedSeconds]
    
    const count = result?.[0]?.[1] as number;
    let ttl = result?.[1]?.[1] as number;

    // If key is new (no TTL), set expiration
    if (ttl === -1) {
       await redis.expire(redisKey, windowSeconds);
       ttl = windowSeconds;
    }

    const remaining = Math.max(0, limit - count);
    const reset = Math.floor(Date.now() / 1000) + (ttl > 0 ? ttl : windowSeconds);

    return {
      success: count <= limit,
      limit,
      remaining,
      reset
    };

  } catch (err) {
    // Fail OPEN if Redis fails (don't block traffic due to infra issue)
    console.error('[RateLimit] Error:', err);
    return {
      success: true,
      limit,
      remaining: 1,
      reset: Math.floor(Date.now() / 1000) + windowSeconds
    };
  }
}
