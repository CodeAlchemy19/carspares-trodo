import { loadEnv, defineConfig } from '@medusajs/framework/utils'
import path from 'path'

// Load .env from project root (carspares/), not from apps/backend/
// When running from apps/backend/, process.cwd() is apps/backend, so go up 2 levels
// Use current directory for .env loading
const projectRoot = process.cwd()

loadEnv(process.env.NODE_ENV || 'development', projectRoot)

// Validate required secrets
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'supersecret') {
  console.error('ERROR: JWT_SECRET environment variable is required and must not be "supersecret"');
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

if (!process.env.COOKIE_SECRET || process.env.COOKIE_SECRET === 'supersecret') {
  console.error('ERROR: COOKIE_SECRET environment variable is required and must not be "supersecret"');
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET!,
      cookieSecret: process.env.COOKIE_SECRET!,
    }
  },
  modules: {
    automotive: {
      resolve: "./src/modules/automotive",
    },
  },
})


