/**
 * Rate Limiter Utility
 * 
 * In-memory rate limiting for API endpoints.
 * Uses a sliding window approach for accurate limiting.
 * 
 * Note: For production with multiple instances, consider Redis-based rate limiting.
 */

// Define types
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  limit: number;
}

/**
 * Rate limit configurations by endpoint type
 */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Strict limits for sensitive operations
  checkout: { windowMs: 60 * 1000, maxRequests: 60 },   // 60 per minute (1 per second)
  cart: { windowMs: 60 * 1000, maxRequests: 300 },      // 300 per minute (5 per second) - Relaxed for Dev/UI interaction
  
  // Moderate limits for read operations
  search: { windowMs: 60 * 1000, maxRequests: 300 },    // 300 per minute
  default: { windowMs: 60 * 1000, maxRequests: 300 },   // 300 per minute
  
  // Very permissive for static data
  vehicles: { windowMs: 60 * 1000, maxRequests: 600 },  // 600 per minute
  health: { windowMs: 60 * 1000, maxRequests: 120 }     // 120 per minute
};

/**
 * In-memory store for rate limit tracking
 * Key: clientId, Value: { count, windowStart }
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Clean up expired entries periodically (every 5 minutes)
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    // Remove entries older than 5 minutes
    if (now - value.windowStart > 5 * 60 * 1000) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Get client identifier from request
 * Uses IP + User-Agent as a composite key
 */
export function getClientId(req: any): string {
  // Get IP from various sources (handles proxies)
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
    || req.headers['x-real-ip']
    || req.connection?.remoteAddress 
    || req.ip
    || 'unknown';
  
  // Add user-agent to make fingerprint more unique
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  return `${ip}:${userAgent.slice(0, 50)}`;
}

/**
 * Check if request should be rate limited
 */
export function checkRateLimit(clientId: string, endpointType = 'default'): RateLimitResult {
  const config = RATE_LIMITS[endpointType] || RATE_LIMITS.default;
  const { windowMs, maxRequests } = config;
  const now = Date.now();
  const key = `${clientId}:${endpointType}`;
  
  let entry = rateLimitStore.get(key);
  
  // Initialize or reset if window expired
  if (!entry || (now - entry.windowStart) >= windowMs) {
    entry = { count: 0, windowStart: now };
  }
  
  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);
  
  const remaining = Math.max(0, maxRequests - entry.count);
  const resetTime = entry.windowStart + windowMs;
  
  return {
    allowed: entry.count <= maxRequests,
    remaining,
    resetTime,
    limit: maxRequests
  };
}

/**
 * Create rate limiting middleware for a specific endpoint type
 * Note: Returns an Express-like middleware signature
 */
export function createRateLimiter(endpointType = 'default') {
  return function rateLimitMiddleware(req: any, res: any, next: any) {
    const clientId = getClientId(req);
    const result = checkRateLimit(clientId, endpointType);
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', result.limit);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));
    
    if (!result.allowed) {
      res.setHeader('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000));
      return res.status(429).json({
        message: 'Too many requests. Please slow down.',
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
      });
    }
    
    next();
  };
}

/**
 * Pre-configured rate limiters for different endpoint types
 */
export const rateLimiters: Record<string, any> = {
  checkout: createRateLimiter('checkout'),
  cart: createRateLimiter('cart'),
  search: createRateLimiter('search'),
  vehicles: createRateLimiter('vehicles'),
  health: createRateLimiter('health'),
  default: createRateLimiter('default')
};
