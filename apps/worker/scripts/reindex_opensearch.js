const { Client } = require("pg");
const { Client: OSClient } = require("@opensearch-project/opensearch");
require("dotenv").config({ path: "../../.env" });

async function main() {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║   RE-INDEX OPENSEARCH (MEDUSA v2 DATA)       ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  const pgClient = new Client({ connectionString: process.env.POSTGRES_URL });
  await pgClient.connect();

  const osClient = new OSClient({
    node: process.env.OPENSEARCH_URL || "http://localhost:9200",
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Delete and recreate index
    try {
      await osClient.indices.delete({ index: "skus_v1" });
      console.log("✓ Deleted old index");
    } catch (e) {
      console.log("Creating fresh index...");
    }

    await osClient.indices.create({
      index: "skus_v1",
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0
        },
        mappings: {
          properties: {
            sku_id: { type: "keyword" },
            title: { type: "text", analyzer: "standard" },
            brand: { type: "keyword" },
            mpn: { type: "keyword" },
            ean: { type: "keyword" },
            category: { type: "keyword" },
            price: { type: "float" }, // Placeholder for now
            in_stock: { type: "boolean" },
            lead_time_days: { type: "integer" },
            vehicle_type_ids: { type: "keyword" },  // Array of UUIDs
            oe_numbers: { type: "keyword" }          // Array of OE numbers
          }
        }
      }
    });
    console.log("✓ Created skus_v1 index with fitment fields\n");

    // 1. Fetch Products & Variants from Medusa tables
    console.log("Fetching product data from public.product_variant...");
    const partsResult = await pgClient.query(`
      SELECT 
        pv.id as sku_id,
        pv.title as variant_title,
        p.title as product_title,
        pv.sku as mpn, -- Medusa SKU is mapped to MPN in migration script? Or legacy SKU? 
                       -- In migration: sku -> sku, mpn -> metadata.mpn
        pv.sku,
        pv.ean,
        pv.metadata as v_meta,
        p.metadata as p_meta
      FROM public.product_variant pv
      JOIN public.product p ON p.id = pv.product_id
      WHERE pv.deleted_at IS NULL
    `);
    console.log(`Found ${partsResult.rows.length} variants\n`);

    // 2. Fetch Fitments from Medusa custom table (public.fitment)
    console.log("Fetching fitment data from public.fitment...");
    const fitmentResult = await pgClient.query(`
      SELECT variant_id, array_agg(vehicle_id) as vehicle_ids
      FROM public.fitment
      GROUP BY variant_id
    `);
    const fitmentMap = {};
    for (const row of fitmentResult.rows) {
      fitmentMap[row.variant_id] = row.vehicle_ids;
    }
    console.log(`Found fitments for ${Object.keys(fitmentMap).length} variants\n`);

    // 3. Fetch Prices (Native Medusa Prices)
    // For now, check price_set linked to variant.
    // If migration didn't do prices yet, we might use placeholder.
    // The previous migration script comment said "Prices will be handled...".
    // We'll set 0.00 for now to unblock search, or check default price.
    const priceMap = {}; 

    // 4. Bulk Index
    console.log("Indexing to OpenSearch...");
    const bulkBody = [];
    
    for (const row of partsResult.rows) {
        // Resolve Brand from metadata or title
        // Migration: jsonb_build_object('brand_id', brand_id...) in p.metadata
        // We don't have brand name in metadata, only ID. 
        // We might want to fetch brands or just use title split for now.
        const brand = "Generic"; // Query db for brand name if needed later

        const vMeta = row.v_meta || {};
        const pMeta = row.p_meta || {};
        
        const mpn = vMeta.mpn || row.mpn || row.sku;
        const ean = row.ean || "";
        const category = pMeta.category || "General";
        const price = 0.00; // Pending price migration

        const vehicleTypeIds = fitmentMap[row.sku_id] || [];
        const oeNumbers = []; // Pending OE migration

        bulkBody.push({ index: { _index: "skus_v1", _id: row.sku_id } });
        bulkBody.push({
            sku_id: row.sku_id,
            title: row.product_title, // Use product title
            brand: brand,
            mpn: mpn,
            ean: ean,
            category: category,
            price: price,
            in_stock: true,
            lead_time_days: 1,
            vehicle_type_ids: vehicleTypeIds,
            oe_numbers: oeNumbers
        });
    }

    if (bulkBody.length > 0) {
      const batchSize = 1000;
      for (let i = 0; i < bulkBody.length; i += batchSize * 2) {
        const batch = bulkBody.slice(i, i + batchSize * 2);
        const bulkResponse = await osClient.bulk({ body: batch, refresh: false });
        
        if (bulkResponse.body.errors) {
          const errors = bulkResponse.body.items.filter(item => item.index?.error);
          console.log(`   Batch ${i / (batchSize * 2) + 1}: ${errors.length} errors`);
        } else {
          console.log(`   Batch ${i / (batchSize * 2) + 1}: ${batch.length / 2} docs indexed`);
        }
      }
      await osClient.indices.refresh({ index: "skus_v1" });
    }

    // Verify
    const countRes = await osClient.count({ index: "skus_v1" });
    console.log(`\n✓ Total documents: ${countRes.body.count}`);

    console.log("\n╔══════════════════════════════════════════════╗");
    console.log("║         INDEXING COMPLETE                    ║");
    console.log("╚══════════════════════════════════════════════╝\n");

  } catch (err) {
    console.error("\n✗ Error:", err.message);
    console.error(err.stack);
  } finally {
    await pgClient.end();
  }
}

main();
