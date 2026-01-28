const { Client } = require('pg');

/**
 * Seed Product Specifications
 * 
 * This script:
 * 1. Gets all filterable attributes from the attribute table
 * 2. For each product in a category, generates random spec values
 * 3. Stores them in product.metadata.specifications
 */

const BATCH_SIZE = 5000;

async function seedSpecs() {
  const db = new Client({connectionString:'postgres://carspares:carspares@127.0.0.1:5433/carspares'});
  await db.connect();

  console.log('=== SEEDING PRODUCT SPECIFICATIONS ===\n');
  console.time('Total Time');

  // 1. Get all filterable attributes with their categories
  const attrsRes = await db.query(`
    SELECT 
      a.name, 
      a.type,
      a.unit,
      ca.category_id
    FROM attribute a
    JOIN category_attribute ca ON ca.attribute_id = a.id
    WHERE a.is_filterable = true
  `);
  
  // Group attributes by category
  const categoryAttrs = {};
  attrsRes.rows.forEach(row => {
    if (!categoryAttrs[row.category_id]) categoryAttrs[row.category_id] = [];
    categoryAttrs[row.category_id].push({
      name: row.name,
      type: row.type,
      unit: row.unit
    });
  });
  
  console.log(`Found ${Object.keys(categoryAttrs).length} categories with attributes`);

  // 2. Get products linked to categories
  const productsRes = await db.query(`
    SELECT 
      p.id as product_id,
      pcp.product_category_id as category_id,
      p.metadata
    FROM product p
    JOIN product_category_product pcp ON pcp.product_id = p.id
    WHERE p.metadata IS NOT NULL
    LIMIT 1000000
  `);
  
  console.log(`Found ${productsRes.rows.length} products with category links`);

  // 3. Generate specs for each product
  let updatedCount = 0;
  const startTime = Date.now();
  
  // Value generators by type
  const generateValue = (attr) => {
    const { type, name, unit } = attr;
    
    // Number types
    if (type === 'number') {
      if (name.includes('Diameter')) return [200, 220, 240, 260, 280, 300][Math.floor(Math.random() * 6)];
      if (name.includes('Weight')) return (Math.random() * 5 + 0.5).toFixed(1);
      if (name.includes('Height')) return [30, 35, 40, 45, 50, 55][Math.floor(Math.random() * 6)];
      if (name.includes('Teeth')) return [20, 22, 24, 26, 28][Math.floor(Math.random() * 5)];
      if (name.includes('Thickness')) return [8, 10, 12, 15, 18, 20, 22][Math.floor(Math.random() * 7)];
      return Math.floor(Math.random() * 100) + 10;
    }
    
    // Text/Select types
    if (name.includes('Position')) return ['Front', 'Rear', 'Left', 'Right', 'Front Left', 'Front Right'][Math.floor(Math.random() * 6)];
    if (name.includes('Type')) return ['Standard', 'Sport', 'Heavy Duty', 'OEM', 'Performance'][Math.floor(Math.random() * 5)];
    if (name.includes('Material')) return ['Steel', 'Cast Iron', 'Composite', 'Ceramic'][Math.floor(Math.random() * 4)];
    if (name.includes('Color')) return ['Black', 'Silver', 'Grey'][Math.floor(Math.random() * 3)];
    if (name.includes('System')) return ['Hydraulic', 'Pneumatic', 'Mechanical'][Math.floor(Math.random() * 3)];
    
    return ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)];
  };

  // Process in batches
  for (let i = 0; i < productsRes.rows.length; i += BATCH_SIZE) {
    const batch = productsRes.rows.slice(i, i + BATCH_SIZE);
    const updates = [];
    
    for (const product of batch) {
      const attrs = categoryAttrs[product.category_id];
      if (!attrs || attrs.length === 0) continue;
      
      // Generate specs
      const specs = {};
      attrs.forEach(attr => {
        specs[attr.name] = generateValue(attr).toString();
      });
      
      // Merge with existing metadata
      const newMetadata = {
        ...(product.metadata || {}),
        specifications: specs
      };
      
      updates.push({ id: product.product_id, metadata: newMetadata });
    }
    
    // Bulk update
    if (updates.length > 0) {
      const caseStmt = updates.map((u, idx) => 
        `WHEN id = $${idx*2+1} THEN $${idx*2+2}::jsonb`
      ).join(' ');
      
      const values = updates.flatMap(u => [u.id, JSON.stringify(u.metadata)]);
      
      await db.query(`
        UPDATE product SET metadata = CASE ${caseStmt} END
        WHERE id IN (${updates.map((_, idx) => `$${idx*2+1}`).join(',')})
      `, values);
      
      updatedCount += updates.length;
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    process.stdout.write(`\rUpdated: ${updatedCount.toLocaleString()} products | ${elapsed}s`);
  }

  console.log('\n\n✅ Specifications seeded!');
  console.timeEnd('Total Time');

  // Verify
  const verify = await db.query(`
    SELECT metadata->'specifications' as specs FROM product 
    WHERE metadata->'specifications' IS NOT NULL LIMIT 1
  `);
  console.log('\nSample specs:', JSON.stringify(verify.rows[0]?.specs, null, 2));

  await db.end();
}

seedSpecs();
