# Setup Guide

## Prerequisites

- Node.js >= 20
- Docker and Docker Compose
- npm or yarn

## Step-by-Step Setup

### 1. Create Environment File

**IMPORTANT**: The `.env` file must be in the `carspares/` root directory (not in `apps/backend/`).

You can either:

**Option A**: Copy the example file:
```bash
cd carspares
copy .env.example .env  # Windows
# or
cp .env.example .env   # Linux/Mac
```

**Option B**: Create a `.env` file manually in the `carspares/` directory with:

```env
POSTGRES_URL=postgres://carspares:carspares@localhost:5432/carspares
REDIS_URL=redis://localhost:6379
OPENSEARCH_URL=http://localhost:9200
MEDUSA_BACKEND_URL=http://localhost:9000
NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000

# Medusa Configuration
DATABASE_URL=postgres://carspares:carspares@localhost:5432/carspares
STORE_CORS=http://localhost:3000
ADMIN_CORS=http://localhost:7001
AUTH_CORS=http://localhost:3000
JWT_SECRET=supersecret
COOKIE_SECRET=supersecret
```

### 2. Start Infrastructure Services

```bash
cd carspares
docker compose up -d
```

Wait for services to be ready (about 30 seconds).

### 3. Initialize Database Schema

```bash
node apps/worker/scripts/apply_schema.js
```

This creates the `catalog` and `fitment` schemas with all required tables.

### 4. Create OpenSearch Index

```bash
node apps/worker/opensearch/create_index.js
```

This creates the `skus_v1` index with proper mappings for fast search.

### 5. Generate Demo Data

For a quick demo (20k SKUs):
```bash
node apps/worker/scripts/generate_demo_data.js --skus=20000 --offersPerSku=3 --fitmentsPerSku=10
```

For scale testing (200k SKUs):
```bash
node apps/worker/scripts/generate_demo_data.js --skus=200000 --offersPerSku=3 --fitmentsPerSku=10
```

**Note**: Generating 200k SKUs may take 10-30 minutes depending on your machine.

### 6. Install Backend Dependencies

```bash
cd apps/backend
npm install
```

### 7. Start Backend

```bash
npm run dev
```

Backend will be available at http://localhost:9000

### 8. Install Storefront Dependencies

In a new terminal:

```bash
cd apps/storefront
npm install
```

### 9. Start Storefront

```bash
npm run dev
```

Storefront will be available at http://localhost:3000

## Verification

1. **Backend Health**: Visit http://localhost:9000/health (if available)
2. **Storefront**: Visit http://localhost:3000
3. **Search**: Try searching for a part number or product name
4. **Vehicle Selection**: Select a vehicle make/model/type and verify search filters

## Troubleshooting

### PostgreSQL Connection Issues
- Ensure Docker container is running: `docker ps`
- Check port 5432 is not in use by another service
- Verify `.env` has correct `POSTGRES_URL`

### OpenSearch Issues
- Check container logs: `docker logs carspares-opensearch-1`
- Verify security is disabled (for local dev)
- Check memory allocation (should be at least 1GB)

### Medusa Backend Issues
- Check `DATABASE_URL` in `.env`
- Verify Redis is running: `docker ps | grep redis`
- Check backend logs for errors

### Storefront Issues
- Verify `NEXT_PUBLIC_MEDUSA_BACKEND_URL` in `.env`
- Check browser console for API errors
- Ensure backend is running before starting storefront

## Next Steps

- Integrate Medusa cart API for real checkout
- Add product images
- Implement advanced filters (price range, brand, etc.)
- Add pagination to search results
- Implement user authentication
