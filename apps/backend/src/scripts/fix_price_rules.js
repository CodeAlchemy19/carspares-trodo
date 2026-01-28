/**
 * Fix Price Rules - Add region_id rules to all prices for cart compatibility
 * 
 * Medusa v2 requires prices to have price_rule entries with region_id
 * for the cart to accept them.
 */
const { Client } = require('pg');

async function fixPriceRules() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgres://carspares:carspares@127.0.0.1:5433/carspares'
  });

  const BATCH_SIZE = 5000;
  const REGION_ID = 'reg_eg';

  try {
    await client.connect();
    console.log('Connected to database');

    // Count prices needing fix (only those that actually exist and have no rules)
    const countRes = await client.query(`
      SELECT COUNT(*) as cnt FROM price p
      WHERE p.rules_count = 0 
      AND p.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM price_rule pr 
        WHERE pr.price_id = p.id AND pr.deleted_at IS NULL
      )
    `);
    const total = parseInt(countRes.rows[0].cnt);
    console.log(`Found ${total.toLocaleString()} prices needing region rules`);

    if (total === 0) {
      console.log('All prices already have rules!');
      return;
    }

    let processed = 0;
    let errors = 0;
    const startTime = Date.now();

    while (processed < total) {
      try {
        // Get batch of price IDs that definitely exist
        const priceRes = await client.query(`
          SELECT p.id FROM price p 
          WHERE p.rules_count = 0 
          AND p.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM price_rule pr 
            WHERE pr.price_id = p.id AND pr.deleted_at IS NULL
          )
          LIMIT $1
        `, [BATCH_SIZE]);

        if (priceRes.rows.length === 0) break;

        const priceIds = priceRes.rows.map(r => r.id);
        
        // Insert rules one at a time wrapped in try-catch for each
        let batchInserted = 0;
        for (const priceId of priceIds) {
          try {
            await client.query(`
              INSERT INTO price_rule (id, attribute, value, priority, price_id, created_at, updated_at)
              VALUES ($1, 'region_id', $2, 0, $3, NOW(), NOW())
              ON CONFLICT DO NOTHING
            `, [`prule_${priceId.substring(0, 20).replace(/-/g, '')}`, REGION_ID, priceId]);
            
            await client.query(`UPDATE price SET rules_count = 1 WHERE id = $1`, [priceId]);
            batchInserted++;
          } catch (e) {
            errors++;
            // Skip this price - it may have been deleted
          }
        }

        processed += batchInserted;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = Math.round(processed / elapsed);
        const eta = speed > 0 ? Math.round((total - processed) / speed) : '?';
        const progress = Math.round((processed / total) * 100);
        
        process.stdout.write(`\r🔧 ${progress}% | ${processed.toLocaleString()}/${total.toLocaleString()} | ${speed}/s | Errors: ${errors} | ETA: ${eta}s    `);
      } catch (batchErr) {
        console.error('\nBatch error:', batchErr.message);
        errors++;
        // Continue with next batch
      }
    }

    console.log(`\n✅ Done! Fixed ${processed.toLocaleString()} prices (${errors} errors skipped)`);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

fixPriceRules();
