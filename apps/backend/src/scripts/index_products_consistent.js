const { Client } = require('pg');
const { Client: OSClient } = require("@opensearch-project/opensearch");

/**
 * Product-Level Indexer (Consistency Fix)
 * 
 * KEY CHANGE: Indexes by PRODUCT HANDLE instead of VARIANT ID
 * This ensures ProductList and ProductPage show the same data.
 * 
 * - Each product gets ONE document (by handle)
 * - Specs come from FIRST variant (matches API behavior)
 * - Fitments aggregated from ALL variants
 * - Price/Stock from FIRST variant (or aggregated range in future)
 */

const INDEX_NAME = 'products_v1';
const BATCH_SIZE = 2000;
const CONCURRENCY = 4;

function log(msg, type = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${type}] ${msg}`);
}

/**
 * Convert brand name to URL-friendly slug (MUST match frontend nameToSlug)
 * Handles special characters like & correctly
 */
function nameToSlug(name) {
  if (!name) return 'unknown';
  return name
    .toLowerCase()
    .replace(/[&]/g, 'and')       // & -> and
    .replace(/[/]/g, '-')          // / -> -
    .replace(/[()]/g, '')          // Remove parentheses
    .replace(/\s+/g, '-')          // Spaces -> dashes
    .replace(/[^a-z0-9-]/g, '')    // Remove other special chars
    .replace(/-+/g, '-')           // Collapse multiple dashes
    .replace(/^-|-$/g, '');        // Trim leading/trailing dashes
}

/**
 * Flatten specifications for OpenSearch
 */
function flattenSpecifications(specs, prefix = '') {
  const result = {};
  
  if (!specs || typeof specs !== 'object') {
    return result;
  }
  
  for (const [key, value] of Object.entries(specs)) {
    const sanitizedKey = key.replace(/\./g, '_').replace(/[^\w\s-]/g, '');
    const fullKey = prefix ? `${prefix}_${sanitizedKey}` : sanitizedKey;
    
    if (value === null || value === undefined) {
      continue;
    } else if (Array.isArray(value)) {
      result[fullKey] = value.map(v => String(v)).join(', ');
    } else if (typeof value === 'object') {
      const nested = flattenSpecifications(value, fullKey);
      Object.assign(result, nested);
    } else {
      result[fullKey] = String(value);
    }
  }
  
  return result;
}

async function indexProducts() {
  const pgClient = new Client({
    connectionString: process.env.DATABASE_URL || 'postgres://carspares:carspares@127.0.0.1:5433/carspares'
  });

  const osClient = new OSClient({
    node: process.env.OPENSEARCH_URL || 'http://localhost:9200',
    requestTimeout: 120000
  });

  try {
    await pgClient.connect();
    log("🔌 Connected to PostgreSQL");

    try {
      await osClient.cluster.health();
      log("🔌 Connected to OpenSearch");
    } catch (osErr) {
      log(`❌ OpenSearch connection failed: ${osErr.message}`, 'ERROR');
      throw osErr;
    }

    // 1. Delete and recreate index
    const indexExists = await osClient.indices.exists({ index: INDEX_NAME });
    if (indexExists.body) {
      log("🗑️ Deleting existing index...");
      await osClient.indices.delete({ index: INDEX_NAME });
    }

    log("✨ Creating optimized index...");
    await osClient.indices.create({
      index: INDEX_NAME,
      body: {
        settings: {
          "number_of_shards": 1,
          "number_of_replicas": 0,
          "refresh_interval": "-1",
          "index.translog.durability": "async",
          "index.translog.sync_interval": "5s",
          "index.mapping.total_fields.limit": 5000
        },
        mappings: {
          properties: {
            id: { type: 'keyword' },           // Primary variant ID (for cart)
            product_id: { type: 'keyword' },   // Product ID
            title: { type: 'text', analyzer: 'standard' },
            slug: { type: 'keyword' },         // Product handle (for URL)
            description: { type: 'text' },
            sku: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            brand: { type: 'keyword' },
            brand_slug: { type: 'keyword' },
            category: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            category_slugs: { type: 'keyword' },
            price: { type: 'float' },
            currency: { type: 'keyword' },
            vehicle_type_ids: { type: 'keyword' },
            is_universal: { type: 'boolean' },
            image_url: { type: 'keyword' },
            in_stock: { type: 'boolean' },
            stock_quantity: { type: 'integer' },
            lead_time_days: { type: 'integer' },
            ean: { type: 'keyword' },
            mpn: { type: 'keyword' },
            popularity_score: { type: 'float' },
            created_at: { type: 'date' },
            variant_count: { type: 'integer' },
            specifications: { 
              type: 'object',
              dynamic: true,
              properties: {}
            }
          },
          dynamic_templates: [
            {
              specifications_as_keyword: {
                path_match: 'specifications.*',
                mapping: { type: 'keyword' }
              }
            }
          ]
        }
      }
    });

    // 2. Build category map
    log("🌳 Building category map...");
    const catRes = await pgClient.query(`
      SELECT id, name, handle, parent_category_id 
      FROM product_category
    `);
    const categoryMap = new Map();
    catRes.rows.forEach(c => categoryMap.set(c.id, c));

    function getCategorySlugs(categoryId) {
      const slugs = [];
      let current = categoryMap.get(categoryId);
      while (current) {
        slugs.push(current.handle);
        if (!current.parent_category_id) break;
        current = categoryMap.get(current.parent_category_id);
      }
      return slugs;
    }

    // 3. Get total count of PRODUCTS (not variants)
    const countRes = await pgClient.query('SELECT COUNT(*) FROM product');
    const total = parseInt(countRes.rows[0].count);
    log(`🚀 Indexing ${total.toLocaleString()} PRODUCTS (Batch: ${BATCH_SIZE}, Concurrency: ${CONCURRENCY})`);

    let processedCount = 0;
    const startTime = Date.now();

    // 4. Process batch function - GROUP BY PRODUCT IN JS (faster than DISTINCT ON)
    async function processBatch(offset) {
      // Simple query - get all variants ordered by product_id, variant_id
      const query = `
        SELECT 
          pv.id as variant_id,
          pv.sku,
          pv.ean as variant_ean,
          pv.barcode,
          pv.metadata as variant_metadata,
          p.id as product_id,
          p.title,
          p.handle,
          p.description,
          p.thumbnail,
          p.metadata,
          p.created_at,
          pc.title as collection_title,
          pc.handle as collection_handle,
          pr.amount as price,
          pr.currency_code
        FROM product p
        JOIN product_variant pv ON pv.product_id = p.id
        LEFT JOIN product_collection pc ON pc.id = p.collection_id
        LEFT JOIN product_variant_price_set pvps ON pvps.variant_id = pv.id
        LEFT JOIN price pr ON pr.price_set_id = pvps.price_set_id AND pr.currency_code = 'egp'
        ORDER BY p.id, pv.id
        LIMIT $1 OFFSET $2
      `;

      const rows = (await pgClient.query(query, [BATCH_SIZE, offset])).rows;
      if (rows.length === 0) return 0;

      // Group by product in JS - take first variant for each product
      const productMap = new Map();
      rows.forEach(row => {
        if (!productMap.has(row.product_id)) {
          productMap.set(row.product_id, {
            ...row,
            variant_count: 1,
            all_variant_ids: [row.variant_id]
          });
        } else {
          const existing = productMap.get(row.product_id);
          existing.variant_count++;
          existing.all_variant_ids.push(row.variant_id);
        }
      });

      const products = Array.from(productMap.values());

      // Get category links (use unique product IDs from grouped products)
      const productIds = [...new Set(products.map(r => r.product_id))];
      const catLinkRes = await pgClient.query(`
        SELECT product_id, product_category_id 
        FROM product_category_product 
        WHERE product_id = ANY($1)
      `, [productIds]);
      
      const productCategoryMap = {};
      catLinkRes.rows.forEach(r => {
        if (!productCategoryMap[r.product_id]) productCategoryMap[r.product_id] = [];
        productCategoryMap[r.product_id].push(r.product_category_id);
      });

      // Get ALL fitments for ALL variants of each product (aggregated)
      const fitRes = await pgClient.query(`
        SELECT pv.product_id, f.vehicle_id 
        FROM fitment f
        JOIN product_variant pv ON pv.id = f.variant_id
        WHERE pv.product_id = ANY($1)
      `, [productIds]);

      const fitmentsMap = {};
      fitRes.rows.forEach(r => {
        if (!fitmentsMap[r.product_id]) fitmentsMap[r.product_id] = new Set();
        fitmentsMap[r.product_id].add(r.vehicle_id);
      });

      // Get inventory for first variant SKUs
      const skus = rows.map(r => r.sku).filter(Boolean);
      const invRes = await pgClient.query(`
        SELECT ii.sku, SUM(GREATEST(0, il.stocked_quantity - COALESCE(il.reserved_quantity, 0))) as available
        FROM inventory_item ii
        JOIN inventory_level il ON il.inventory_item_id = ii.id
        WHERE ii.sku = ANY($1)
        GROUP BY ii.sku
      `, [skus]);

      const inventoryMap = {};
      invRes.rows.forEach(r => {
        inventoryMap[r.sku] = parseInt(r.available) || 0;
      });

      // Build bulk body - INDEX BY PRODUCT HANDLE (one per product)
      const body = products.flatMap(doc => {
        const catSlugs = new Set();
        const catIds = productCategoryMap[doc.product_id] || [];
        catIds.forEach(catId => {
          getCategorySlugs(catId).forEach(s => catSlugs.add(s));
        });

        const firstCatId = catIds[0];
        const firstCat = firstCatId ? categoryMap.get(firstCatId) : null;
        const productFitments = fitmentsMap[doc.product_id] ? [...fitmentsMap[doc.product_id]] : [];

        return [
          // KEY CHANGE: Index by product HANDLE (slug), not variant ID
          { index: { _index: INDEX_NAME, _id: doc.handle } },
          {
            id: doc.variant_id,  // Primary variant ID (for cart/add-to-cart)
            product_id: doc.product_id,
            title: doc.title,
            slug: doc.handle,   // Product handle (for URL)
            description: doc.description,
            sku: doc.sku,
            ean: doc.variant_ean || doc.barcode || doc.metadata?.ean || doc.variant_metadata?.ean || null,
            mpn: doc.variant_metadata?.mpn || doc.metadata?.mpn || doc.sku,
            brand: doc.collection_title || 'Unknown',
            // Use nameToSlug for consistent slug matching with frontend
            brand_slug: nameToSlug(doc.collection_title || 'Unknown'),
            category: firstCat?.name || null,
            category_slugs: Array.from(catSlugs),
            price: doc.price ? parseFloat(doc.price) / 100 : 0,
            currency: doc.currency_code || 'EGP',
            // Aggregate fitments from ALL variants of this product
            vehicle_type_ids: productFitments,
            is_universal: doc.metadata?.is_universal === true || doc.variant_metadata?.is_universal === true,
            image_url: doc.thumbnail,
            in_stock: (inventoryMap[doc.sku] || 0) > 0,
            stock_quantity: inventoryMap[doc.sku] || 0,
            lead_time_days: doc.metadata?.lead_time_days || doc.variant_metadata?.lead_time_days || 2,
            popularity_score: 0,
            created_at: doc.created_at,
            variant_count: parseInt(doc.variant_count) || 1,
            // KEY: Use FIRST variant's specs (same as API retrieveBySlug)
            specifications: flattenSpecifications(doc.variant_metadata?.specifications || doc.metadata?.specifications || {})
          }
        ];
      });

      // Bulk index
      if (body.length > 0) {
        const bulkRes = await osClient.bulk({ body, refresh: false });
        if (bulkRes.body.errors) {
          const errItem = bulkRes.body.items.find(i => i.index?.error);
          if (errItem) {
            log(`⚠️ Batch error: ${JSON.stringify(errItem.index.error)}`, 'WARN');
          }
        }
      }

      return products.length;
    }

    // 5. Run with high concurrency
    const totalBatches = Math.ceil(total / BATCH_SIZE);
    const offsets = [];
    for (let offset = 0; offset < total; offset += BATCH_SIZE) {
      offsets.push(offset);
    }

    while (offsets.length > 0) {
      const batch = offsets.splice(0, CONCURRENCY);
      const results = await Promise.all(batch.map(offset => processBatch(offset)));
      processedCount += results.reduce((a, b) => a + b, 0);

      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processedCount / elapsed;
      const pct = ((processedCount / total) * 100).toFixed(1);
      log(`📊 Progress: ${processedCount.toLocaleString()}/${total.toLocaleString()} (${pct}%) @ ${rate.toFixed(0)} products/sec`);
    }

    // 6. Re-enable refresh
    log("🔄 Enabling refresh...");
    await osClient.indices.putSettings({
      index: INDEX_NAME,
      body: { "refresh_interval": "1s" }
    });

    await osClient.indices.refresh({ index: INDEX_NAME });

    const finalCount = await osClient.count({ index: INDEX_NAME });
    const elapsed = (Date.now() - startTime) / 1000;
    log(`✅ Complete! Indexed ${finalCount.body.count.toLocaleString()} PRODUCTS in ${elapsed.toFixed(1)}s`);
    log(`📈 Final rate: ${(processedCount / elapsed).toFixed(0)} products/sec`);

  } catch (err) {
    log(`❌ Error: ${err.message}`, 'ERROR');
    console.error(err);
    process.exit(1);
  } finally {
    await pgClient.end();
  }
}

indexProducts();
