# Testing Guide

## Prerequisites
- All services running (Postgres, Redis, OpenSearch)
- Database schema applied
- OpenSearch index created
- Demo data generated (at least 20k SKUs for meaningful tests)

## Manual Testing Checklist

### 1. Infrastructure Tests

#### Docker Services
```bash
# Check all services are running
docker ps

# Expected output should show:
# - postgres (port 5432)
# - redis (port 6379)
# - opensearch (port 9200)
```

#### Database Connection
```bash
# Test PostgreSQL connection
node apps/worker/scripts/test_db.js
# (You may need to create this test script)
```

#### OpenSearch Connection
```bash
# Test OpenSearch
curl http://localhost:9200/_cluster/health
# Should return status: "green" or "yellow"
```

### 2. Backend API Tests

#### Vehicle Endpoints
```bash
# Test makes endpoint
curl http://localhost:9000/store/vehicles/makes

# Test models endpoint (replace {makeId} with actual ID)
curl http://localhost:9000/store/vehicles/models?make={makeId}

# Test types endpoint (replace {modelId} with actual ID)
curl http://localhost:9000/store/vehicles/types?model={modelId}
```

**Expected**: JSON responses with arrays of makes/models/types

#### Search Endpoint
```bash
# Test basic search
curl "http://localhost:9000/store/search?q=filter"

# Test part number search
curl "http://localhost:9000/store/search?q=ABC123"

# Test with vehicle filter
curl "http://localhost:9000/store/search?q=filter&vehicleTypeId={vehicleTypeId}"

# Test with category filter
curl "http://localhost:9000/store/search?categoryPath=electronics"

# Test pagination
curl "http://localhost:9000/store/search?page=2"
```

**Expected**: 
- Response time < 500ms for 200k SKUs
- Results sorted by: in_stock desc, lead_time_days asc, price asc
- Correct pagination (page, totalPages, total)

#### SKU Details Endpoint
```bash
# Test SKU endpoint (replace {skuId} with actual ID)
curl http://localhost:9000/store/sku/{skuId}
```

**Expected**: JSON with SKU details including price, stock status, lead time

### 3. Storefront Tests

#### Home Page
1. Navigate to http://localhost:3000
2. **Verify**:
   - Page loads without errors
   - Vehicle selector is visible
   - Search bar is functional
   - Navigation links work

#### Vehicle Selection
1. Select a Make from dropdown
2. **Verify**: Models dropdown populates
3. Select a Model
4. **Verify**: Types dropdown populates
5. Select a Type
6. **Verify**: 
   - Selection saved to localStorage
   - Cookie set with vehicleTypeId
   - Page reloads or updates

#### Search Functionality
1. Enter search query in home page
2. Click Search or press Enter
3. **Verify**:
   - Redirects to /s?q={query}
   - Results display correctly
   - Product cards show: title, brand, price, stock status
   - Results are sorted correctly (in stock first, then by price)

#### Part Number Search
1. Search for a normalized part number (e.g., "ABC123")
2. **Verify**:
   - Exact matches appear first
   - Results are relevant

#### Vehicle Filter Integration
1. Select a vehicle
2. Perform a search
3. **Verify**:
   - Only compatible parts shown
   - vehicleTypeId included in search params

#### Product Detail Page
1. Click on a product from search results
2. **Verify**:
   - Product details load correctly
   - Price, stock status, lead time displayed
   - Technical details shown
   - "Add to Cart" button works (if in stock)

#### Cart Functionality
1. Add items to cart from product pages
2. Navigate to /cart
3. **Verify**:
   - All added items displayed
   - Quantities can be updated
   - Items can be removed
   - Total price calculated correctly
   - "Proceed to Checkout" button works

#### Checkout Flow
1. From cart, click "Proceed to Checkout"
2. **Verify**:
   - Form displays correctly
   - Can fill in shipping information
   - Order summary shows correct items
   - Form validation works

### 4. Performance Tests

#### Search Performance
```bash
# Test search speed with timing
time curl "http://localhost:9000/store/search?q=test"
```

**Target**: < 500ms for typical queries with 200k+ SKUs

#### Filter Performance
```bash
# Test with multiple filters
time curl "http://localhost:9000/store/search?q=test&vehicleTypeId={id}&brand=BrandName&inStock=true"
```

**Target**: < 500ms

### 5. Data Integrity Tests

#### Verify Data Generation
```sql
-- Connect to PostgreSQL
psql postgres://carspares:carspares@localhost:5432/carspares

-- Check counts
SELECT COUNT(*) FROM catalog.brand; -- Should be ~200
SELECT COUNT(*) FROM catalog.category; -- Should be ~100
SELECT COUNT(*) FROM catalog.part; -- Should match SKU count
SELECT COUNT(*) FROM catalog.sku; -- Should match --skus parameter
SELECT COUNT(*) FROM catalog.offer; -- Should be ~skus * offersPerSku
SELECT COUNT(*) FROM fitment.vehicle_make; -- Should be ~50
SELECT COUNT(*) FROM fitment.vehicle_model; -- Should be ~400
SELECT COUNT(*) FROM fitment.vehicle_type; -- Should be ~5000
SELECT COUNT(*) FROM fitment.sku_fitment; -- Should be ~skus * fitmentsPerSku
```

#### Verify OpenSearch Index
```bash
# Check index exists
curl http://localhost:9200/skus_v1

# Check document count
curl "http://localhost:9200/skus_v1/_count"

# Should match SKU count
```

### 6. Edge Cases

#### Empty Search
- Search with empty query
- **Verify**: Shows all products or appropriate message

#### No Results
- Search for non-existent term
- **Verify**: Shows "No products found" message

#### Invalid SKU ID
- Navigate to /p/invalid-id
- **Verify**: Shows 404 or error message

#### Empty Cart
- Navigate to /cart with no items
- **Verify**: Shows "Cart is empty" message

#### Vehicle Selection Persistence
- Select vehicle, navigate away, come back
- **Verify**: Selection persists

### 7. Browser Console Tests

1. Open browser DevTools (F12)
2. Check Console tab
3. **Verify**: No JavaScript errors
4. Check Network tab
5. **Verify**: API calls return 200 status codes

### 8. Known Limitations (For Demo)

- Cart uses localStorage (not persistent across devices)
- Checkout is placeholder (doesn't actually process orders)
- Product images are placeholders
- Some filters UI not fully implemented
- Pagination UI not implemented (backend supports it)

## Automated Testing (Future)

Consider adding:
- Jest tests for API endpoints
- Playwright/Cypress for E2E tests
- Load testing with k6 or Artillery
- Integration tests for data generation
