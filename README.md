# CarSpares - Automotive E-Commerce Platform

A full-featured e-commerce platform for automotive spare parts built with **Medusa v2**, **Next.js 15**, **PostgreSQL**, **Redis**, and **OpenSearch**.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         STOREFRONT                              │
│                    (Next.js 15 - Port 3000)                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────┐│
│  │ Product List│ │ Product Page│ │ Cart / Checkout / Orders    ││
│  │ (OpenSearch)│ │ (Medusa API)│ │ (Medusa SDK)                ││
│  └──────┬──────┘ └──────┬──────┘ └──────────────┬──────────────┘│
└─────────┼───────────────┼───────────────────────┼───────────────┘
          │               │                       │
          ▼               ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                 │
│                    (Medusa v2 - Port 9000)                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────┐│
│  │  Store API  │ │  Admin API  │ │    Automotive Module        ││
│  │  /store/*   │ │  /admin/*   │ │ (Vehicles, Fitment, Attrs)  ││
│  └──────┬──────┘ └──────┬──────┘ └──────────────┬──────────────┘│
└─────────┼───────────────┼───────────────────────┼───────────────┘
          │               │                       │
          ▼               ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────┐│
│  │ PostgreSQL  │ │   Redis     │ │      OpenSearch             ││
│  │ (Port 5433) │ │ (Port 6379) │ │    (Port 9200)              ││
│  │  Products   │ │   Cache     │ │   Product Search Index      ││
│  │  Orders     │ │   Sessions  │ │   Faceted Filters           ││
│  │  Vehicles   │ │   Jobs      │ │   Full-Text Search          ││
│  └─────────────┘ └─────────────┘ └─────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
carspares/
├── .env                    # Environment variables (NOT in git)
├── .gitignore              # Git ignore rules
├── docker-compose.yml      # PostgreSQL, Redis, OpenSearch
├── fix-env.js              # Environment setup helper
├── README.md               # This file
├── SETUP.md                # Detailed setup instructions
├── TESTING.md              # Testing guide
│
├── apps/
│   ├── backend/            # Medusa v2 Backend
│   │   ├── src/
│   │   │   ├── api/        # REST API routes
│   │   │   │   ├── store/  # Storefront endpoints
│   │   │   │   ├── admin/  # Admin endpoints
│   │   │   │   └── middlewares.ts
│   │   │   ├── lib/        # Utilities & Services
│   │   │   │   ├── logger.ts           # Structured logging
│   │   │   │   ├── cache.ts            # Redis client
│   │   │   │   ├── opensearchSync.ts   # Search sync
│   │   │   │   └── services/           # Business logic
│   │   │   ├── modules/    # Medusa v2 Modules
│   │   │   │   └── automotive/         # Custom vehicle module
│   │   │   ├── scripts/    # Utility scripts
│   │   │   ├── subscribers/# Event handlers
│   │   │   └── links/      # Module links
│   │   ├── medusa-config.ts
│   │   └── package.json
│   │
│   └── storefront/         # Next.js 15 Frontend
│       ├── app/            # App Router pages
│       │   ├── c/[slug]/   # Category pages
│       │   ├── p/[slug]/   # Product pages
│       │   ├── cart/       # Shopping cart
│       │   ├── checkout/   # Checkout flow
│       │   └── api/        # API routes (search proxy)
│       ├── components/     # React components
│       ├── context/        # React contexts
│       ├── lib/            # Utilities
│       └── public/         # Static assets
│
├── data/                   # Import data (NOT in git)
│   └── *.json              # Product/attribute data
│
└── packages/
    └── shared/             # Shared utilities
```

---

## 🗄️ Database Schema (Medusa v2)

### Core Medusa Tables (Public Schema)

| Table | Purpose |
|-------|---------|
| `product` | Products with title, handle, description |
| `product_variant` | SKUs with pricing, inventory links |
| `product_category` | Category hierarchy |
| `cart` | Shopping carts |
| `order` | Completed orders |
| `customer` | Customer accounts |
| `region` | Geographic regions with tax/currency |
| `price_set` | Price configurations |
| `inventory_item` | Inventory tracking |
| `stock_location` | Warehouse locations |

### Automotive Module Tables

| Table | Purpose |
|-------|---------|
| `vehicle_manufacturer` | Car makes (Toyota, BMW, etc.) |
| `vehicle_model` | Car models (Camry, 3 Series) |
| `vehicle_type` | Specific variants (year, engine, body) |
| `part_fitment` | Links variants to vehicle types |
| `attribute` | Product attributes (Color, Size, etc.) |
| `category_attribute` | Attributes per category |

### Key Relationships

```
product_variant ──┬── product (1:N)
                  ├── product_variant_price_set → price_set → price
                  ├── product_variant_inventory_item → inventory_item → inventory_level
                  └── part_fitment → vehicle_type → vehicle_model → vehicle_manufacturer
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+
- **Docker** & Docker Compose
- **Git**

### 1. Clone & Install

```bash
git clone <repo-url> carspares
cd carspares
```

### 2. Start Infrastructure

```bash
docker compose up -d
```

This starts:
- **PostgreSQL** on port 5433
- **Redis** on port 6379
- **OpenSearch** on port 9200

### 3. Setup Environment

> [!IMPORTANT]
> The `.env` file is not committed to Git. You must create your own from the template.

```bash
node fix-env.js
```

```bash
# Copy the template
cp .env.example .env

# Copy the storefront template
cp apps/storefront/.env.example apps/storefront/.env.local
```

Then edit both files to add your values.

### .env.example Template

We provide `.env.example` files in both places:
- `/.env.example` - Root environment for backend
- `/apps/storefront/.env.example` - Storefront-specific env

> [!WARNING]
> Never commit your actual `.env` or `.env.local` files! They contain secrets.

### Getting the Publishable API Key

The `NEXT_PUBLIC_PUBLISHABLE_API_KEY` is required for the storefront to work. Get it from:

1. **Via Database** (recommended for dev):
   ```sql
   SELECT * FROM publishable_api_key;
   ```

2. **Via Medusa Admin** (if available):
   Settings → API Keys → Publishable Keys

3. **From `fix-env.js` output** after running setup

### 4. Start Backend

```bash
cd apps/backend
rm package-lock.json
npm install
npx medusa db:generate automotive
npx medusa db:migrate
npx medusa user --email youradminmail@mail.com --password youradminpassword
npm run dev
```

Backend runs on http://localhost:9000

### 5. Start Storefront

```bash
cd apps/storefront
npm install
npm run dev
```

Storefront runs on http://localhost:3000

---

## 🔧 Development Workflow

### Backend Development

```bash
cd apps/backend
npm run dev          # Start dev server with hot reload
npm run build        # Build for production
npm run migrations   # Run database migrations
```

### Storefront Development

```bash
cd apps/storefront
npm run dev          # Start Next.js dev server
npm run build        # Build for production
npm run start        # Start production server
```

### Re-index Products (when data changes)

```bash
cd apps/backend
node src/scripts/index_products_fast.js
```

---

## 📡 API Reference

### Store Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/store/health` | Health check |
| GET | `/store/vehicles` | List vehicle manufacturers |
| GET | `/store/vehicles?model_id=x` | List vehicle types |
| GET | `/store/categories/tree` | Category hierarchy |
| GET | `/store/automotive/products/:slug` | Product details |
| GET | `/store/automotive/categories/:slug/attributes` | Category filters |
| POST | `/store/carts` | Create cart |
| POST | `/store/carts/:id/line-items` | Add to cart |
| POST | `/store/carts/:id/complete` | Complete checkout |

### Search API (Storefront)

```
GET /api/products?category=brake-discs&manufacturer=brembo&page=1&limit=20
```

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/automotive/makes` | Create vehicle make |
| POST | `/admin/automotive/models` | Create vehicle model |
| POST | `/admin/automotive/types` | Create vehicle type |
| POST | `/admin/automotive/fitments/bulk` | Bulk add fitments |

---

## 🛠️ Key Scripts

Located in `apps/backend/src/scripts/`:

| Script | Purpose | Usage |
|--------|---------|-------|
| `index_products_fast.js` | Index products to OpenSearch | `node index_products_fast.js` |
| `seed.ts` | Seed initial data | `npx ts-node seed.ts` |
| `seed_specifications.js` | Seed product specifications | `node seed_specifications.js` |
| `verify_database.js` | Verify database integrity | `node verify_database.js` |

---

## 🔍 OpenSearch Index

The `products_v1` index contains:

```javascript
{
  id: "variant-uuid",
  product_id: "product-uuid",
  title: "Brake Disc Front Left",
  slug: "brake-disc-front-left-brembo",
  sku: "BRM-123456",
  brand: "Brembo",
  brand_slug: "brembo",
  category: "Brake Discs",
  category_slug: "brake-discs",
  category_slugs: ["brakes", "brake-discs"],
  price: 150.00,
  currency: "EGP",
  in_stock: true,
  stock_quantity: 50,
  vehicle_type_ids: ["uuid-1", "uuid-2"],
  is_universal: false,
  specifications: {
    "Diameter": "320mm",
    "Thickness": "28mm"
  }
}
```

---

## 🧩 Key Components

### Backend

- **AutomotiveProductServiceV2** (`src/lib/services/`)
  - Retrieves products with pricing, inventory, fitment data
  - Uses Medusa's Remote Query for v2 compatibility

- **Logger** (`src/lib/logger.ts`)
  - Structured JSON logging
  - Request ID tracking
  - Log levels: debug, info, warn, error

- **Rate Limiters** (`src/lib/`)
  - `rateLimiter.ts` - In-memory for dev
  - `rateLimit.ts` - Redis-based for production

### Storefront

- **VehicleContext** - Global vehicle selection state
- **CartContext** - Shopping cart management
- **ProductList** - Product grid with filters
- **FilterSidebar** - Dynamic faceted filters

---

## 🐛 Troubleshooting

### "Product not available" error
- Run indexer: `node src/scripts/index_products_fast.js`
- Check variant has inventory and prices linked

### OpenSearch connection failed
- Ensure Docker is running: `docker compose ps`
- Check OpenSearch: `curl http://localhost:9200`

### Database connection issues
- Verify PostgreSQL is running on port 5433
- Check `.env` has correct DATABASE_URL

### Missing API Key
- Get from Medusa admin or database: `SELECT * FROM publishable_api_key`
- Add to storefront `.env.local`

---

## 📝 Notes for Developers

1. **Medusa v2** - Uses new module architecture, Remote Query, and workflows
2. **TypeScript** - Backend uses TypeScript, storefront uses JavaScript/TSX
3. **OpenSearch security** - Disabled for local dev
4. **EGP Currency** - Default currency is Egyptian Pound
5. **Variant-centric** - Products are indexed by variant, not product

---

## ⚠️ Critical Development Gotchas

### 1. Medusa SDK Usage

All cart/checkout operations MUST use the Medusa JS SDK, not custom API calls:

```typescript
// ✅ CORRECT - Use SDK
import { sdk } from "../lib/medusa";
await sdk.store.cart.addLineItem(cartId, { variant_id, quantity });

// ❌ WRONG - Don't use custom fetch
fetch('/api/cart/items', { ... });
```

### 2. Publishable API Key

The SDK requires a valid `publishableKey`. Without it, all API calls fail:

```typescript
// lib/medusa.ts
export const sdk = new Medusa({
  baseUrl: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL,
  publishableKey: process.env.NEXT_PUBLIC_PUBLISHABLE_API_KEY, // REQUIRED!
});
```

### 3. Environment Files Location

| File | Location | Purpose |
|------|----------|----------|
| `.env` | `/carspares/` | Backend + shared config |
| `.env.local` | `/apps/storefront/` | Storefront-specific |

**Both files need the publishable API key!**

### 4. Database Port

PostgreSQL runs on **port 5433** (not 5432) to avoid conflicts:

```bash
# Connect via CLI
psql -h 127.0.0.1 -p 5433 -U carspares -d carspares
```

### 5. OpenSearch Re-indexing

After any product/category changes, re-index:

```bash
cd apps/backend
node src/scripts/index_products_fast.js
```

### 6. Price Format

- **Database/API**: Prices in **cents** (e.g., 15000 = 150.00 EGP)
- **Display**: Divide by 100 for human-readable format

```typescript
const displayPrice = (priceInCents / 100).toFixed(2);
```

### 7. Image Domains

Next.js requires whitelisted domains for `next/image`. Add new domains to:

```js
// apps/storefront/next.config.mjs
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'your-domain.com' }
  ]
}
```

### 8. Rate Limiting

Two rate limiters exist for different contexts:
- `rateLimiter.ts` - In-memory (development)
- `rateLimit.ts` - Redis-based (production)

### 9. Inventory + Backorder

By default, `allow_backorder` is set to `true` for simpler development. For strict inventory:

```sql
UPDATE inventory_item SET allow_backorder = false;
```

### 10. Category vs. Product Metadata

Specifications come from **variant metadata** first, then **product metadata**:

```typescript
// Priority order in indexer
const specs = variant.metadata?.specifications || product.metadata?.specifications;
```

---

## 🔗 Useful Links

- [Medusa v2 Docs](https://docs.medusajs.com/)
- [Next.js App Router](https://nextjs.org/docs/app)
- [OpenSearch Docs](https://opensearch.org/docs/)

---

## 📄 License

MIT
