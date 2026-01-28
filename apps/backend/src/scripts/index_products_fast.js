const { Client } = require('pg');
const { Client: OSClient } = require("@opensearch-project/opensearch");

/**
 * High-Performance Product Indexer
 * Optimized for: 24GB RAM, RTX 3070
 * 
 * Uses:
 * - Large batch size (5000)
 * - High concurrency (8 workers)
 * - Async bulk operations
 */

const INDEX_NAME = 'products_v1';
const BATCH_SIZE = 5000;
const CONCURRENCY = 4;

function log(msg, type = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${type}] ${msg}`);
}

/**
 * Recursively flatten specifications object
 * Handles nested objects, arrays, and converts all values to strings
 * This prevents OpenSearch mapper_parsing_exception with ObjectMapper conflicts
 */
function flattenSpecifications(specs, prefix = '') {
  const result = {};
  
  if (!specs || typeof specs !== 'object') {
    return result;
  }
  
  // Banned keys - identifier-type attributes that shouldn't be in specifications
  // Matches the cleaning logic in automotive-product-v2.ts
  const bannedKeys = ['EAN', 'MPN', 'SKU', 'Year', 'Start Year', 'End Year', 'Make', 'Model', 'Type', 'Brand', 'Manufacturer Part Number'];
  const bannedLower = bannedKeys.map(k => k.toLowerCase());
  
  for (const [key, value] of Object.entries(specs)) {
    // Skip banned keys (case-insensitive)
    if (bannedLower.includes(key.toLowerCase())) {
      continue;
    }
    
    // Sanitize key - remove dots and special chars that cause issues
    const sanitizedKey = key.replace(/\./g, '_').replace(/[^\w\s-]/g, '');
    const fullKey = prefix ? `${prefix}_${sanitizedKey}` : sanitizedKey;
    
    if (value === null || value === undefined) {
      continue; // Skip null/undefined values
    } else if (Array.isArray(value)) {
      // Convert arrays to comma-separated strings
      result[fullKey] = value.map(v => String(v)).join(', ');
    } else if (typeof value === 'object') {
      // Recursively flatten nested objects
      const nested = flattenSpecifications(value, fullKey);
      Object.assign(result, nested);
    } else {
      // Convert primitives to strings
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
    requestTimeout: 120000 // 2 min timeout for large bulks
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
          "refresh_interval": "-1", // Disable refresh during bulk
          "index.translog.durability": "async", // Faster writes
          "index.translog.sync_interval": "5s",
          "index.mapping.total_fields.limit": 5000 // Allow many spec fields
        },
        mappings: {
          properties: {
            id: { type: 'keyword' },
            product_id: { type: 'keyword' },
            title: { type: 'text', analyzer: 'standard' },
            slug: { type: 'keyword' },
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
            popularity_score: { type: 'float' },
            created_at: { type: 'date' },
            specifications: { 
              type: 'object',
              dynamic: true,
              properties: {} // Will be dynamically added
            }
          },
          dynamic_templates: [
            {
              // Force all specification fields to be keyword type for aggregations
              specifications_as_keyword: {
                path_match: 'specifications.*',
                mapping: {
                  type: 'keyword'
                }
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

    // 3. Get total count
    const countRes = await pgClient.query('SELECT COUNT(*) FROM product_variant');
    const total = parseInt(countRes.rows[0].count);
    log(`🚀 Indexing ${total.toLocaleString()} variants (Batch: ${BATCH_SIZE}, Concurrency: ${CONCURRENCY})`);

    let processedCount = 0;
    const startTime = Date.now();

    // 4. Process batch function
    async function processBatch(offset) {
      const query = `
        SELECT 
          pv.id,
          pv.sku,
          pv.ean as variant_ean,
          pv.barcode,
          pv.title as variant_title,
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
        FROM product_variant pv
        JOIN product p ON p.id = pv.product_id
        LEFT JOIN product_collection pc ON pc.id = p.collection_id
        LEFT JOIN product_variant_price_set pvps ON pvps.variant_id = pv.id
        LEFT JOIN price pr ON pr.price_set_id = pvps.price_set_id AND pr.currency_code = 'egp'
        ORDER BY pv.id
        LIMIT $1 OFFSET $2
      `;

      const rows = (await pgClient.query(query, [BATCH_SIZE, offset])).rows;
      if (rows.length === 0) return 0;

      // Get category links
      const productIds = [...new Set(rows.map(r => r.product_id))];
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

      // Get fitments
      const variantIds = rows.map(r => r.id);
      const fitRes = await pgClient.query(`
        SELECT variant_id, vehicle_id 
        FROM fitment 
        WHERE variant_id = ANY($1)
      `, [variantIds]);

      const fitmentsMap = {};
      fitRes.rows.forEach(r => {
        if (!fitmentsMap[r.variant_id]) fitmentsMap[r.variant_id] = [];
        fitmentsMap[r.variant_id].push(r.vehicle_id);
      });

      // Get inventory levels per SKU (batch fetch for performance)
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

      // Build bulk body
      const body = rows.flatMap(doc => {
        const catSlugs = new Set();
        const catIds = productCategoryMap[doc.product_id] || [];
        catIds.forEach(catId => {
          getCategorySlugs(catId).forEach(s => catSlugs.add(s));
        });

        const firstCatId = catIds[0];
        const firstCat = firstCatId ? categoryMap.get(firstCatId) : null;

        return [
          { index: { _index: INDEX_NAME, _id: doc.id } },
          {
            id: doc.id,
            product_id: doc.product_id,
            title: doc.title,
            slug: doc.handle,
            description: doc.description,
            sku: doc.sku,
            // EAN: prioritize variant.ean, then barcode, then metadata
            ean: doc.variant_ean || doc.barcode || doc.metadata?.ean || doc.variant_metadata?.ean || null,
            mpn: doc.variant_metadata?.mpn || doc.metadata?.mpn || doc.sku,
            brand: doc.collection_title || 'Unknown',
            brand_slug: doc.collection_handle || 'unknown',
            category: firstCat?.name || null,
            category_slug: firstCat?.handle || null,
            category_slugs: Array.from(catSlugs),
            price: doc.price ? parseFloat(doc.price) / 100 : 0,
            currency: doc.currency_code || 'EGP',
            vehicle_type_ids: fitmentsMap[doc.id] || [],
            is_universal: doc.metadata?.is_universal === true || doc.variant_metadata?.is_universal === true,
            image_url: doc.thumbnail,
            // Real inventory data from Medusa's inventory module (batch fetched)
            in_stock: (inventoryMap[doc.sku] || 0) > 0,
            stock_quantity: inventoryMap[doc.sku] || 0,
            lead_time_days: doc.metadata?.lead_time_days || doc.variant_metadata?.lead_time_days || 2,
            popularity_score: 0,
            created_at: doc.created_at,
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

      return rows.length;
    }

    // 5. Run with high concurrency
    const totalBatches = Math.ceil(total / BATCH_SIZE);
    const offsets = [];
    for (let offset = 0; offset < total; offset += BATCH_SIZE) {
      offsets.push(offset);
    }

    while (offsets.length > 0) {
      const chunk = offsets.splice(0, CONCURRENCY);
      const promises = chunk.map(off => processBatch(off));
      const results = await Promise.all(promises);
      
      const indexedInChunk = results.reduce((a, b) => a + b, 0);
      processedCount += indexedInChunk;

      const elapsed = (Date.now() - startTime) / 1000;
      const speed = Math.round(processedCount / elapsed);
      const progress = Math.round((processedCount / total) * 100);
      const eta = Math.round((total - processedCount) / speed);
      
      process.stdout.write(`\r🚀 ${progress}% | ${processedCount.toLocaleString()}/${total.toLocaleString()} | ${speed.toLocaleString()} docs/s | ETA: ${eta}s    `);
    }

    // 6. Finalize index
    log("\n\n✨ Finalizing index...");
    await osClient.indices.putSettings({
      index: INDEX_NAME,
      body: { "index.refresh_interval": "1s" }
    });
    await osClient.indices.refresh({ index: INDEX_NAME });

    // Verify
    const countCheck = await osClient.count({ index: INDEX_NAME });
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    log(`🎉 Done! Indexed ${countCheck.body.count.toLocaleString()} documents in ${totalTime}s`);

  } catch (err) {
    log(`❌ Fatal Error: ${err.message}`, 'ERROR');
    console.error(err);
  } finally {
    await pgClient.end();
  }
}

indexProducts();
