/**
 * Centralized Error Handler
 * 
 * Sanitizes error responses to prevent leaking internal details.
 * Logs full errors server-side for debugging.
 */

import { logger, LOG_LEVELS } from "./logger";

/**
 * Map of known error types to user-friendly messages
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Database errors
  '23505': 'This item already exists',
  '23503': 'Referenced item not found',
  '22P02': 'Invalid data format',
  'ECONNREFUSED': 'Service temporarily unavailable',
  'ETIMEDOUT': 'Request timed out',
  // Validation errors
  'VALIDATION_ERROR': 'Invalid input data',
  'NOT_FOUND': 'Resource not found',
  'UNAUTHORIZED': 'Authentication required',
  'FORBIDDEN': 'Access denied',
  'INSUFFICIENT_STOCK': 'Insufficient stock for one or more items'
};

/**
 * Generate a unique request ID for tracking
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Log error with context (server-side only)
 */
function logError(requestId: string, context: string, err: any, level = LOG_LEVELS.ERROR) {
  logger.error(`API Error: ${context}`, {
    requestId,
    context,
    error: err,
    code: err.code,
    type: err.type
  });
}

/**
 * Get user-friendly error message
 */
function getSafeMessage(err: any): string {
  // 1. Check if it's a validation error with safe message (Prioritize specific feedback)
  if (err.isValidationError && err.message) {
    return err.message;
  }

  // 2. Check for known error codes
  if (err.code && ERROR_MESSAGES[err.code]) {
    return ERROR_MESSAGES[err.code];
  }
  
  // 3. Check for custom error types
  if (err.type && ERROR_MESSAGES[err.type]) {
    return ERROR_MESSAGES[err.type];
  }
  
  // Default generic message
  return `An unexpected error occurred: ${err.message}`;
}

/**
 * Get appropriate HTTP status code
 */
function getStatusCode(err: any): number {
  // Explicit status code on error
  if (err.statusCode) return err.statusCode;
  
  // Map error types to status codes
  if (err.type === 'NOT_FOUND') return 404;
  if (err.type === 'VALIDATION_ERROR') return 400;
  if (err.type === 'UNAUTHORIZED') return 401;
  if (err.type === 'FORBIDDEN') return 403;
  if (err.type === 'INSUFFICIENT_STOCK') return 422;
  
  // Database constraint violations
  if (err.code === '23505') return 409; // Conflict
  if (err.code === '23503') return 400; // Bad Request
  if (err.code === '22P02') return 400; // Bad Request
  
  // Connection errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') return 503;
  
  // Default to 500
  return 500;
}

/**
 * Handle API error - main export
 */
export function handleApiError(res: any, err: any, context = 'Unknown') {
  const requestId = generateRequestId();
  
  // Log full error server-side
  logError(requestId, context, err);
  
  // Determine safe response
  const statusCode = getStatusCode(err);
  const message = getSafeMessage(err);
  
  // Send sanitized response to client
  res.status(statusCode).json({
    message,
    requestId, // Include for support reference
    // Only include error type in non-500 errors
    ...(statusCode !== 500 && err.type && { type: err.type })
  });
}

/**
 * Create a custom error with type
 */
export function createError(message: string, type: string, statusCode: number | null = null): any {
  const error: any = new Error(message);
  error.type = type;
  if (statusCode) error.statusCode = statusCode;
  return error;
}

/**
 * Create a validation error
 */
export function validationError(message: string): any {
  const error: any = new Error(message);
  error.type = 'VALIDATION_ERROR';
  error.isValidationError = true;
  error.statusCode = 400;
  return error;
}

/**
 * Create a not found error
 */
export function notFoundError(resource = 'Resource'): any {
  const error: any = new Error(`${resource} not found`);
  error.type = 'NOT_FOUND';
  error.statusCode = 404;
  return error;
}

/**
 * Create an insufficient stock error
 */
export function insufficientStockError(details = ''): any {
  const error: any = new Error(details || 'Insufficient stock for one or more items');
  error.type = 'INSUFFICIENT_STOCK';
  error.statusCode = 422;
  return error;
}

export { LOG_LEVELS };
