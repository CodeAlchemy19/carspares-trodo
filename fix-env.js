const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

// Read existing .env if it exists
let existingContent = '';
if (fs.existsSync(envPath)) {
  existingContent = fs.readFileSync(envPath, 'utf8');
}

// Required environment variables
const requiredEnv = `# Database
POSTGRES_URL=postgres://carspares:carspares@localhost:5432/carspares
DATABASE_URL=postgres://carspares:carspares@localhost:5432/carspares

# Redis
REDIS_URL=redis://localhost:6379

# OpenSearch
OPENSEARCH_URL=http://localhost:9200

# Medusa Backend
MEDUSA_BACKEND_URL=http://localhost:9000
NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000

# Medusa Configuration
STORE_CORS=http://localhost:3000
ADMIN_CORS=http://localhost:7001
AUTH_CORS=http://localhost:3000
JWT_SECRET=supersecret
COOKIE_SECRET=supersecret
`;

// Check if DATABASE_URL exists
if (!existingContent.includes('DATABASE_URL=')) {
  console.log('⚠️  DATABASE_URL is missing from .env file');
  console.log('📝 Updating .env file...');
  
  // If file exists, append missing variables, otherwise create new
  if (existingContent) {
    // Add DATABASE_URL if POSTGRES_URL exists
    if (existingContent.includes('POSTGRES_URL=')) {
      const postgresMatch = existingContent.match(/POSTGRES_URL=(.+)/);
      if (postgresMatch) {
        const dbUrl = postgresMatch[1].replace(':5433', ':5432').replace('127.0.0.1', 'localhost');
        existingContent += `\nDATABASE_URL=${dbUrl}\n`;
      }
    }
    
    // Add missing Medusa config
    if (!existingContent.includes('STORE_CORS=')) {
      existingContent += `\nSTORE_CORS=http://localhost:3000\n`;
    }
    if (!existingContent.includes('ADMIN_CORS=')) {
      existingContent += `\nADMIN_CORS=http://localhost:7001\n`;
    }
    if (!existingContent.includes('AUTH_CORS=')) {
      existingContent += `\nAUTH_CORS=http://localhost:3000\n`;
    }
    if (!existingContent.includes('JWT_SECRET=')) {
      existingContent += `\nJWT_SECRET=supersecret\n`;
    }
    if (!existingContent.includes('COOKIE_SECRET=')) {
      existingContent += `\nCOOKIE_SECRET=supersecret\n`;
    }
    
    // Fix ports and URLs
    existingContent = existingContent.replace(/:5433/g, ':5432');
    existingContent = existingContent.replace(/127\.0\.0\.1/g, 'localhost');
    existingContent = existingContent.replace(/https:\/\/admin:StrongPassword123!@/g, 'http://');
    
    fs.writeFileSync(envPath, existingContent, 'utf8');
    console.log('✅ .env file updated!');
  } else {
    fs.writeFileSync(envPath, requiredEnv, 'utf8');
    console.log('✅ .env file created!');
  }
} else {
  console.log('✅ DATABASE_URL already exists in .env');
}

// Verify
const finalContent = fs.readFileSync(envPath, 'utf8');
if (finalContent.includes('DATABASE_URL=')) {
  console.log('\n✅ Verification: DATABASE_URL is now in .env');
  const dbUrlMatch = finalContent.match(/DATABASE_URL=(.+)/);
  if (dbUrlMatch) {
    console.log(`   DATABASE_URL=${dbUrlMatch[1]}`);
  }
} else {
  console.log('\n❌ Error: DATABASE_URL still missing!');
  process.exit(1);
}

console.log('\n📋 Next steps:');
console.log('1. Restart the backend: cd apps/backend && npm run dev');
console.log('2. You should see: DB URL: postgres://carspares:carspares@localhost:5432/carspares');
