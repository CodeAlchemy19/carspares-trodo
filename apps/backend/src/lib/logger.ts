import winston from 'winston';

const { combine, timestamp, json, colorize, printf, errors } = winston.format;

const isDev = process.env.NODE_ENV === 'development';

export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  HTTP: 'http',
  VERBOSE: 'verbose',
  DEBUG: 'debug',
  SILLY: 'silly'
};

// Define custom levels if needed, but standard npm levels are usually fine
// npm levels: error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6

/**
 * Custom format for development
 * readable, colorful output
 */
const devFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  
  // If there's a stack trace (for errors), append it
  if (stack) {
    log += `\n${stack}`;
  }
  
  // If there are extra metadata fields (like requestId, duration), print them nicely
  if (Object.keys(metadata).length > 0) {
    // Exclude internal winston properties
    const metaStr = JSON.stringify(metadata);
    if (metaStr !== '{}') {
        log += ` ${metaStr}`;
    }
  }
  
  return log;
});

/**
 * Main Logger Instance
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }), // Handle Error objects gracefully
    isDev 
      ? combine(colorize(), devFormat)
      : json() // Production: Pure JSON for observability tools
  ),
  defaultMeta: { service: 'backend-api' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'debug.log' })
  ],
});

/**
 * Access Logging Helper (for Middleware)
 * Formats access logs strictly
 */
export const logRequest = (data: any) => {
    logger.http(data.message || `HTTP ${data.method} ${data.path}`, {
        method: data.method,
        path: data.path,
        status: data.status,
        duration: data.duration,
        requestId: data.requestId,
        ip: data.ip
    });
};
