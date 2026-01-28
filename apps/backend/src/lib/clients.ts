import { Pool } from "pg";
import { Client as OSClient } from "@opensearch-project/opensearch";

// CORS origin from environment variable
export const ALLOWED_ORIGIN = process.env.STORE_CORS || "http://localhost:3000";

let pgPool: Pool;
let osClient: OSClient;

/**
 * Get PostgreSQL connection pool
 * Uses pg.Pool for proper connection management and pooling
 */
export function getPgClient(): Pool {
  if (!pgPool) {
    pgPool = new Pool({ 
      connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
      max: 20, // Maximum number of connections in pool
      idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
      connectionTimeoutMillis: 5000, // Timeout if connection takes too long
    });
    
    // Handle pool errors
    pgPool.on('error', (err) => {
      console.error('Unexpected PostgreSQL pool error:', err);
    });
  }
  return pgPool;
}

/**
 * Get OpenSearch client
 */
export function getOsClient(): OSClient {
  if (!osClient) {
    const config: any = {
      node: process.env.OPENSEARCH_URL
    };
    // Only add SSL config if URL is HTTPS
    if (process.env.OPENSEARCH_URL && process.env.OPENSEARCH_URL.startsWith('https')) {
      config.ssl = { rejectUnauthorized: false };
    }
    osClient = new OSClient(config);
  }
  return osClient;
}
