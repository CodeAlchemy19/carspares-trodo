# Quick Start Guide

## Prerequisites Check
- ✅ Node.js >= 20 installed
- ✅ Docker Desktop running
- ✅ Ports 3000, 5432, 6379, 9200, 9000 available

## Step 1: Create .env File

**CRITICAL**: The `.env` file MUST be in the `carspares/` root directory.

```bash
cd carspares

# Copy the example file
copy .env.example .env  # Windows PowerShell
# or
cp .env.example .env    # Linux/Mac/Git Bash
```

Then verify the file exists:
```bash
# Windows
dir .env

# Linux/Mac
ls -la .env
```

## Step 2: Start Docker Services

```bash
cd carspares
docker compose up -d
```

Wait 30 seconds for services to start, then verify:
```bash
docker ps
```

You should see:
- postgres (port 5432)
- redis (port 6379)  
- opensearch (port 9200)

## Step 3: Initialize Database

```bash
# From carspares/ directory
node apps/worker/scripts/apply_schema.js
```

Expected output: `Schema applied.`

## Step 4: Create OpenSearch Index

```bash
node apps/worker/opensearch/create_index.js
```

Expected output: `Created index: skus_v1`

## Step 5: Generate Demo Data

For quick testing (20k SKUs, ~2-5 minutes):
```bash
node apps/worker/scripts/generate_demo_data.js --skus=20000 --offersPerSku=3 --fitmentsPerSku=10
```

For scale testing (200k SKUs, ~10-30 minutes):
```bash
node apps/worker/scripts/generate_demo_data.js --skus=200000 --offersPerSku=3 --fitmentsPerSku=10
```

## Step 6: Start Backend

Open a **new terminal**:

```bash
cd carspares/apps/backend
npm install  # Only needed first time
npm run dev
```

**Verify it's working:**
- Should see: `Loading Medusa Config...`
- Should see: `DB URL: postgres://carspares:carspares@localhost:5432/carspares`
- Should NOT see: `DB URL: undefined`
- Server should start on `http://localhost:9000`

**If you see "DB URL: undefined":**
- Check `.env` file exists in `carspares/` (not `apps/backend/`)
- Verify `DATABASE_URL` is in the file
- Restart the backend

## Step 7: Start Frontend

Open **another new terminal**:

```bash
cd carspares/apps/storefront
npm install  # Only needed first time
npm run dev
```

Should start on `http://localhost:3000`

## Step 8: Test

1. Open browser: `http://localhost:3000`
2. You should see the home page
3. Vehicle selector should load (if backend is running)
4. Try searching for a product

## Troubleshooting

### Backend shows "DB URL: undefined"
- ✅ `.env` file is in `carspares/` (root), not `apps/backend/`
- ✅ File is named exactly `.env` (not `.env.txt`)
- ✅ `DATABASE_URL` line exists in the file
- ✅ Restart backend after creating/editing `.env`

### "Failed to fetch" in browser
- ✅ Backend is running (check terminal)
- ✅ Backend shows correct DB URL
- ✅ Test: `curl http://localhost:9000/store/vehicles/makes`

### Docker services not starting
- ✅ Docker Desktop is running
- ✅ Ports not in use by other services
- ✅ Check: `docker ps`

## Common Commands

```bash
# Stop all services
docker compose down

# View logs
docker compose logs -f

# Restart a service
docker compose restart postgres

# Check if backend can connect to DB
cd apps/backend
node -e "require('dotenv').config({path:'../../.env'}); console.log(process.env.DATABASE_URL)"
```
