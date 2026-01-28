/**
 * Health Check Endpoint
 * 
 * GET /store/health
 * 
 * Returns the status of all connected services.
 * Useful for load balancers, monitoring, and debugging.
 */
import { getPgClient, getOsClient, ALLOWED_ORIGIN } from "../../../lib/clients";
import { isRedisAvailable } from "../../../lib/cache";
import { logger } from "../../../lib/logger";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export async function OPTIONS(req, res) {
  setCors(res);
  res.sendStatus(200);
}

/**
 * Check PostgreSQL connectivity
 * @returns {Promise<boolean>}
 */
async function checkDatabase() {
  try {
    const client = getPgClient();
    const result = await client.query('SELECT 1 as ok');
    return result.rows[0]?.ok === 1;
  } catch (err) {
    logger.error('Health check - Database error:', err.message);
    return false;
  }
}

/**
 * Check OpenSearch connectivity
 * @returns {Promise<boolean>}
 */
async function checkOpenSearch() {
  try {
    const client = getOsClient();
    const response = await client.cluster.health();
    return response.body?.status === 'green' || response.body?.status === 'yellow';
  } catch (err) {
    logger.error('Health check - OpenSearch error:', err.message);
    return false;
  }
}

/**
 * Check Redis connectivity
 * @returns {Promise<boolean>}
 */
async function checkRedis() {
  try {
    return await isRedisAvailable();
  } catch (err) {
    logger.error('Health check - Redis error:', err.message);
    return false;
  }
}

/**
 * GET /store/health
 */
export async function GET(req, res) {
  setCors(res);
  
  const timestamp = new Date().toISOString();
  
  // Check services in parallel
  const [dbHealthy, osHealthy, redisHealthy] = await Promise.all([
    checkDatabase(),
    checkOpenSearch(),
    checkRedis()
  ]);
  
  // Core services required for healthy status
  // Both Database and OpenSearch are required for production with 1M+ products
  const coreHealthy = dbHealthy && osHealthy;
  
  const response = {
    status: coreHealthy ? 'healthy' : 'degraded',
    timestamp,
    services: {
      database: dbHealthy,      // Required - product data storage
      opensearch: osHealthy,    // Required - search indexing for 1M+ products
      redis: redisHealthy       // Optional - caching for performance
    }
  };
  
  // Return 503 if core services (DB or OpenSearch) are down
  const statusCode = coreHealthy ? 200 : 503;
  
  return res.status(statusCode).json(response);
}
