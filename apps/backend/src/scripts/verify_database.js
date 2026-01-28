const { Client } = require('pg');

/**
 * Comprehensive Database Verification
 * 
 * Verifies all seeded data and existing automotive data
 */

async function verifyDatabase() {
  const client = new Client({
    connectionString: 'postgres://carspares:carspares@127.0.0.1:5433/carspares'
  });

  try {
    await client.connect();
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║       COMPREHENSIVE DATABASE VERIFICATION                     ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    // 1. PHASE 1 - Store Configuration
    console.log('═══ PHASE 1: STORE CONFIGURATION ═══\n');
    
    // Tax regions
    const taxRegions = await client.query('SELECT country_code FROM tax_region ORDER BY country_code');
    console.log('Tax Regions:', taxRegions.rows.map(r => r.country_code.toUpperCase()).join(', '));

    // Shipping options
    const shipping = await client.query(`
      SELECT so.name, p.amount 
      FROM shipping_option so 
      LEFT JOIN shipping_option_price_set sops ON sops.shipping_option_id = so.id
      LEFT JOIN price p ON p.price_set_id = sops.price_set_id
    `);
    console.log('Shipping Options:');
    shipping.rows.forEach(s => console.log(`  - ${s.name}: €${s.amount ? (s.amount / 100).toFixed(2) : 'N/A'}`));

    // Payment
    const payment = await client.query('SELECT id, is_enabled FROM payment_provider');
    console.log('Payment Providers:', payment.rows.map(p => `${p.id} (${p.is_enabled ? 'enabled' : 'disabled'})`).join(', '));

    // 2. PHASE 2 - Custom DML Tables
    console.log('\n═══ PHASE 2: CUSTOM DML TABLES ═══\n');

    // Brands
    const brands = await client.query('SELECT COUNT(*) as total FROM brand');
    const brandSample = await client.query('SELECT name, logo_url FROM brand ORDER BY name LIMIT 5');
    console.log(`Brands: ${brands.rows[0].total}`);
    console.log('  Sample:', brandSample.rows.map(b => b.name).join(', '));

    // Attributes
    const attrs = await client.query('SELECT type, COUNT(*) as cnt FROM attribute GROUP BY type ORDER BY cnt DESC');
    const totalAttrs = await client.query('SELECT COUNT(*) FROM attribute');
    console.log(`\nAttributes: ${totalAttrs.rows[0].count}`);
    attrs.rows.forEach(a => console.log(`  - ${a.type}: ${a.cnt}`));

    // Category-Attribute Links
    const catAttrLinks = await client.query('SELECT COUNT(*) FROM category_attribute');
    const topCatAttrs = await client.query(`
      SELECT pc.name, COUNT(*) as cnt 
      FROM category_attribute ca 
      JOIN product_category pc ON pc.id = ca.category_id 
      GROUP BY pc.name 
      ORDER BY cnt DESC LIMIT 5
    `);
    console.log(`\nCategory-Attribute Links: ${catAttrLinks.rows[0].count}`);
    console.log('  Top categories:', topCatAttrs.rows.map(c => `${c.name} (${c.cnt})`).join(', '));

    // 3. VEHICLE DATA
    console.log('\n═══ VEHICLE DATA ═══\n');
    
    const manufacturers = await client.query('SELECT COUNT(*) FROM vehicle_manufacturer');
    const models = await client.query('SELECT COUNT(*) FROM vehicle_model');
    const vehicleTypes = await client.query('SELECT COUNT(*) FROM vehicle_type');
    
    console.log(`Vehicle Manufacturers: ${manufacturers.rows[0].count}`);
    console.log(`Vehicle Models: ${models.rows[0].count}`);
    console.log(`Vehicle Types (engines): ${vehicleTypes.rows[0].count}`);

    // Sample manufacturers
    const mfgSample = await client.query('SELECT name FROM vehicle_manufacturer ORDER BY name LIMIT 10');
    console.log('  Sample:', mfgSample.rows.map(m => m.name).join(', '));

    // 4. PRODUCT DATA
    console.log('\n═══ PRODUCT DATA ═══\n');

    const products = await client.query('SELECT COUNT(*) FROM product');
    const variants = await client.query('SELECT COUNT(*) FROM product_variant');
    const categories = await client.query('SELECT COUNT(*) FROM product_category');
    const collections = await client.query('SELECT COUNT(*) FROM product_collection');
    
    console.log(`Products: ${parseInt(products.rows[0].count).toLocaleString()}`);
    console.log(`Product Variants: ${parseInt(variants.rows[0].count).toLocaleString()}`);
    console.log(`Product Categories: ${categories.rows[0].count}`);
    console.log(`Product Collections (brands): ${collections.rows[0].count}`);

    // Product-Category links
    const prodCatLinks = await client.query('SELECT COUNT(*) FROM product_category_product');
    console.log(`Product-Category Links: ${parseInt(prodCatLinks.rows[0].count).toLocaleString()}`);

    // Sample products
    const prodSample = await client.query('SELECT title FROM product ORDER BY RANDOM() LIMIT 5');
    console.log('  Sample products:', prodSample.rows.map(p => p.title.substring(0, 40)).join(', '));

    // 5. FITMENT DATA
    console.log('\n═══ FITMENT DATA ═══\n');

    const fitments = await client.query('SELECT COUNT(*) FROM fitment');
    console.log(`Fitments: ${parseInt(fitments.rows[0].count).toLocaleString()}`);

    // Average fitments per product
    const avgFitments = await client.query(`
      SELECT AVG(cnt)::numeric(10,2) as avg_fitments
      FROM (SELECT variant_id, COUNT(*) as cnt FROM fitment GROUP BY variant_id) sub
    `);
    console.log(`Average fitments per variant: ${avgFitments.rows[0].avg_fitments || 'N/A'}`);

    // Sample fitment
    const fitmentSample = await client.query(`
      SELECT pv.title, vt.name as vehicle, vm.name as make
      FROM fitment f
      JOIN product_variant pv ON pv.id = f.variant_id
      JOIN vehicle_type vt ON vt.id = f.vehicle_id
      JOIN vehicle_model vmod ON vmod.id = vt.model_id
      JOIN vehicle_manufacturer vm ON vm.id = vmod.make_id
      LIMIT 3
    `);
    console.log('  Sample fitments:');
    fitmentSample.rows.forEach(f => console.log(`    - ${f.title?.substring(0, 30)} fits ${f.make} ${f.vehicle}`));

    // 6. PRICING & INVENTORY
    console.log('\n═══ PRICING & INVENTORY ═══\n');

    const prices = await client.query('SELECT COUNT(*) FROM price WHERE price_set_id IN (SELECT price_set_id FROM product_variant_price_set)');
    const inventory = await client.query('SELECT COUNT(*) FROM inventory_item');
    
    console.log(`Product Prices: ${parseInt(prices.rows[0].count).toLocaleString()}`);
    console.log(`Inventory Items: ${parseInt(inventory.rows[0].count).toLocaleString()}`);

    // Price range
    const priceRange = await client.query(`
      SELECT MIN(amount) as min_price, MAX(amount) as max_price, AVG(amount)::numeric(10,2) as avg_price
      FROM price 
      WHERE price_set_id IN (SELECT price_set_id FROM product_variant_price_set)
    `);
    if (priceRange.rows[0].min_price) {
      console.log(`  Price range: €${(priceRange.rows[0].min_price / 100).toFixed(2)} - €${(priceRange.rows[0].max_price / 100).toFixed(2)}`);
      console.log(`  Average price: €${(priceRange.rows[0].avg_price / 100).toFixed(2)}`);
    }

    // SUMMARY
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                        SUMMARY                                ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  Brands:          ${brands.rows[0].total.toString().padStart(10)}                             ║`);
    console.log(`║  Attributes:      ${totalAttrs.rows[0].count.toString().padStart(10)}                             ║`);
    console.log(`║  Cat-Attr Links:  ${catAttrLinks.rows[0].count.toString().padStart(10)}                             ║`);
    console.log(`║  Products:        ${parseInt(products.rows[0].count).toLocaleString().padStart(10)}                             ║`);
    console.log(`║  Fitments:        ${parseInt(fitments.rows[0].count).toLocaleString().padStart(10)}                             ║`);
    console.log(`║  Vehicle Types:   ${vehicleTypes.rows[0].count.toString().padStart(10)}                             ║`);
    console.log('╚══════════════════════════════════════════════════════════════╝');

    console.log('\n✅ Database verification complete!');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

verifyDatabase();
