const { Client } = require("pg");
const { v4: uuidv4 } = require("uuid");

/**
 * SYNC AUTOMOTIVE PRODUCTS TO MEDUSA PRODUCT MODULE - V2
 * 
 * Creates Medusa product entries from automotive products to enable
 * Medusa v2 Cart/Order workflows.
 */

async function main() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();
  const now = new Date().toISOString();

  try {
    console.log("\n╔══════════════════════════════════════════════╗");
    console.log("║  SYNC AUTOMOTIVE PRODUCTS TO MEDUSA MODULE   ║");
    console.log("╚══════════════════════════════════════════════╝\n");

    // 1. Get Sales Channel
    const scResult = await client.query("SELECT id FROM sales_channel WHERE deleted_at IS NULL LIMIT 1");
    const salesChannelId = scResult.rows[0]?.id;
    if (!salesChannelId) {
      console.log("✗ No Sales Channel found! Run setup_medusa_cart.js first.");
      return;
    }
    console.log("✓ Sales Channel:", salesChannelId);

    // 2. Get Region for pricing
    const regionResult = await client.query("SELECT id, currency_code FROM region WHERE deleted_at IS NULL LIMIT 1");
    const regionId = regionResult.rows[0]?.id;
    const currencyCode = regionResult.rows[0]?.currency_code || "egp";
    if (!regionId) {
      console.log("✗ No Region found! Run setup_medusa_cart.js first.");
      return;
    }
    console.log("✓ Region:", regionId, "- Currency:", currencyCode);

    // 3. Check existing Medusa products count
    const existingCount = await client.query("SELECT COUNT(*) FROM product WHERE deleted_at IS NULL");
    console.log("✓ Existing Medusa products:", existingCount.rows[0].count);

    // 4. Check if medusa_variant_id column exists, add if not
    console.log("\n--- Checking automotive schema ---");
    const colCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'automotive' AND table_name = 'product_variant' AND column_name = 'medusa_variant_id'
    `);
    
    if (colCheck.rows.length === 0) {
      console.log("Adding medusa_variant_id column to automotive.product_variant...");
      await client.query(`ALTER TABLE automotive.product_variant ADD COLUMN medusa_variant_id VARCHAR(255)`);
      console.log("✓ Column added");
    } else {
      console.log("✓ medusa_variant_id column exists");
    }

    // 5. Get automotive products that don't have Medusa mapping yet  
    console.log("\n--- Syncing Products ---");
    const productsToSync = await client.query(`
      SELECT 
        p.id as product_id,
        p.title,
        p.slug,
        p.description,
        b.name as brand
      FROM automotive.product p
      LEFT JOIN automotive.brand b ON b.id = p.brand_id
      WHERE EXISTS (
        SELECT 1 FROM automotive.product_variant pv 
        WHERE pv.product_id = p.id AND pv.medusa_variant_id IS NULL
      )
      ORDER BY p.created_at
      LIMIT 500
    `);

    console.log(`Found ${productsToSync.rows.length} products to sync`);

    let synced = 0;
    let failed = 0;

    for (const product of productsToSync.rows) {
      try {
        // Check if Medusa product with this handle exists
        const existingProduct = await client.query(
          "SELECT id FROM product WHERE handle = $1 AND deleted_at IS NULL",
          [product.slug]
        );

        let medusaProductId;

        if (existingProduct.rows.length > 0) {
          medusaProductId = existingProduct.rows[0].id;
        } else {
          // Create Medusa product with correct column names
          medusaProductId = "prod_" + uuidv4().replace(/-/g, "").substring(0, 20);
          
          await client.query(`
            INSERT INTO product (id, title, handle, subtitle, description, is_giftcard, discountable, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, false, true, 'published', $6, $6)
          `, [
            medusaProductId,
            product.title || "Untitled",
            product.slug,
            product.brand || null,
            product.description || null,
            now
          ]);

          // Link to Sales Channel
          const linkId = "psc_" + Math.random().toString(36).substring(2, 10);
          await client.query(`
            INSERT INTO product_sales_channel (id, product_id, sales_channel_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $4)
            ON CONFLICT DO NOTHING
          `, [linkId, medusaProductId, salesChannelId, now]);
        }

        // Get variants for this product
        const variants = await client.query(`
          SELECT 
            pv.id as variant_id,
            pv.sku,
            pr.amount as price,
            sl.quantity as stock
          FROM automotive.product_variant pv
          LEFT JOIN automotive.price pr ON pr.product_variant_id = pv.id AND pr.min_quantity = 1
          LEFT JOIN automotive.stock_level sl ON sl.product_variant_id = pv.id
          WHERE pv.product_id = $1 AND pv.medusa_variant_id IS NULL
        `, [product.product_id]);

        for (const variant of variants.rows) {
          // Create Medusa variant
          const medusaVariantId = "variant_" + uuidv4().replace(/-/g, "").substring(0, 18);
          
          await client.query(`
            INSERT INTO product_variant (id, title, sku, product_id, manage_inventory, allow_backorder, created_at, updated_at)
            VALUES ($1, $2, $3, $4, true, false, $5, $5)
          `, [
            medusaVariantId,
            variant.sku || product.title || "Default",
            variant.sku,
            medusaProductId,
            now
          ]);

          // Update automotive variant with Medusa mapping
          await client.query(
            "UPDATE automotive.product_variant SET medusa_variant_id = $1 WHERE id = $2",
            [medusaVariantId, variant.variant_id]
          );
        }

        synced++;
        if (synced % 50 === 0) {
          console.log(`Progress: ${synced}/${productsToSync.rows.length}`);
        }

      } catch (err) {
        failed++;
        console.error(`Failed to sync product ${product.product_id}:`, err.message);
      }
    }

    console.log(`\n✓ Synced ${synced} products`);
    if (failed > 0) console.log(`✗ Failed: ${failed}`);

    // 6. Summary
    console.log("\n--- Summary ---");
    const totalMapped = await client.query(
      "SELECT COUNT(*) FROM automotive.product_variant WHERE medusa_variant_id IS NOT NULL"
    );
    console.log("Total variants with Medusa mapping:", totalMapped.rows[0].count);

    const medusaProducts = await client.query("SELECT COUNT(*) FROM product WHERE deleted_at IS NULL");
    console.log("Total Medusa products:", medusaProducts.rows[0].count);

  } catch (err) {
    console.error("Fatal error:", err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
