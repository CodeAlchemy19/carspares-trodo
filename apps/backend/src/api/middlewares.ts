/**
 * Medusa API Middlewares Configuration
 * 
 * Defines middleware chains for all API routes:
 * - Rate limiting per endpoint type
 * - Request logging with IDs
 * - Security headers
 * - CORS validation
 */
import { defineMiddlewares } from "@medusajs/framework/http";
import type { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http";

// Import custom middleware utilities
// Import custom middleware utilities
import { rateLimiters } from "../lib/rateLimiter";
import { logRequest } from "../lib/logger";

/**
 * Security headers middleware
 * Adds essential security headers to all responses
 */
function securityHeaders(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");
  
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  
  // Enable XSS filter
  res.setHeader("X-XSS-Protection", "1; mode=block");
  
  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Content Security Policy (basic)
  res.setHeader("Content-Security-Policy", "default-src 'self'");
  
  // Remove X-Powered-By header (don't reveal tech stack)
  res.removeHeader("X-Powered-By");
  
  next();
}

/**
 * Request ID middleware
 * Adds unique ID to each request for tracing
 */
function addRequestId(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  (req as any).requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}

/**
 * Request timing middleware
 * Logs request duration on response finish
 */
function requestTiming(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const start = Date.now();
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    
    // Structured log output
    const logEntry = {
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      requestId: (req as any).requestId,
      ip: req.ip || req.headers["x-forwarded-for"]?.toString().split(",")[0]
    };
    
    // Use proper logger
    logRequest(logEntry);
  });
  
  next();
}

export default defineMiddlewares({
  routes: [
    // =========================================
    // GLOBAL MIDDLEWARES (all routes)
    // =========================================
    {
      matcher: "/store/*",
      middlewares: [securityHeaders, addRequestId, requestTiming]
    },
    
    // =========================================
    // RATE LIMITING BY ENDPOINT TYPE
    // =========================================
    
    // Strict limits for checkout (prevent abuse)
    {
      matcher: "/store/checkout",
      middlewares: [rateLimiters.checkout]
    },
    
    // Cart operations (moderate limits)
    {
      matcher: "/store/cart",
      middlewares: [rateLimiters.cart]
    },
    {
      matcher: "/store/cart/*",
      middlewares: [rateLimiters.cart]
    },
    
    // Health check (allow frequent monitoring)
    {
      matcher: "/store/health",
      middlewares: [rateLimiters.health]
    },
    
    // Vehicles (cached data, more permissive)
    {
      matcher: "/store/vehicles",
      middlewares: [rateLimiters.vehicles]
    },
    
    // SKU lookups (standard limits)
    {
      matcher: "/store/sku/*",
      middlewares: [rateLimiters.default]
    },
    
    // Orders (standard limits)
    {
      matcher: "/store/orders",
      middlewares: [rateLimiters.default]
    },
    
    // User garage (standard limits)
    {
      matcher: "/store/user-garage",
      middlewares: [rateLimiters.default]
    }
  ]
});
