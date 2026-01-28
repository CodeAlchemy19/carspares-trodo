/**
 * Fix Inventory Management Script
 * 
 * This script enables manage_inventory on all product variants
 * and ensures stock deduction works on order completion.
 * 
 * Run with: npx ts-node src/scripts/fix_inventory_management.ts
 */

import { config } from 'dotenv';
config({ path: '.env' });

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function fixInventoryManagement() {
  const client = await pool.connect();
  
  try {
    console.log("=" .repeat(60));
    console.log("INVENTORY MANAGEMENT FIX SCRIPT");
    console.log("=" .repeat(60));
    
    // Step 1: Check current state of BOTH flags
    console.log("\n[1/5] Checking current inventory management state...");
    const checkResult = await client.query(`
      SELECT 
        COUNT(*) as total_variants,
        COUNT(*) FILTER (WHERE manage_inventory = true) as with_inventory,
        COUNT(*) FILTER (WHERE manage_inventory = false OR manage_inventory IS NULL) as without_inventory,
        COUNT(*) FILTER (WHERE allow_backorder = true OR allow_backorder IS NULL) as with_backorder,
        COUNT(*) FILTER (WHERE allow_backorder = false) as without_backorder
      FROM product_variant
    `);
    
    const { total_variants, with_inventory, without_inventory, with_backorder, without_backorder } = checkResult.rows[0];
    console.log(`   Total variants: ${total_variants}`);
    console.log(`   With inventory management: ${with_inventory}`);
    console.log(`   Without inventory management: ${without_inventory}`);
    console.log(`   With backorder ALLOWED (BAD): ${with_backorder}`);
    console.log(`   With backorder DISABLED (GOOD): ${without_backorder}`);
    
    // CRITICAL: We need BOTH manage_inventory=true AND allow_backorder=false for stock enforcement!
    if (without_inventory === '0' && with_backorder === '0') {
      console.log("\n✅ All variants correctly configured (manage_inventory=true, allow_backorder=false)!");
      // Continue to check linkage anyway, don't return
    }
    
    // Step 2: Enable manage_inventory AND disable allow_backorder on all variants
    // CRITICAL: Both settings are required for Medusa to enforce stock limits!
    // - manage_inventory = true: Tells Medusa to track inventory
    // - allow_backorder = false: Tells Medusa to REJECT orders when stock is insufficient
    console.log("\n[2/5] Enabling inventory management and disabling backorders...");
    const updateResult = await client.query(`
      UPDATE product_variant 
      SET manage_inventory = true, 
          allow_backorder = false
      WHERE manage_inventory IS NULL OR manage_inventory = false 
         OR allow_backorder IS NULL OR allow_backorder = true
      RETURNING id
    `);
    console.log(`   Updated ${updateResult.rowCount} variants (manage_inventory=true, allow_backorder=false)`);
    
    // Step 3: Check inventory items linkage
    console.log("\n[3/4] Checking inventory items linkage...");
    const linkageResult = await client.query(`
      SELECT 
        COUNT(DISTINCT pv.id) as total_variants,
        COUNT(DISTINCT pvii.variant_id) as linked_variants
      FROM product_variant pv
      LEFT JOIN product_variant_inventory_item pvii ON pv.id = pvii.variant_id
    `);
    
    const linkedVariants = parseInt(linkageResult.rows[0].linked_variants) || 0;
    const totalVariants = parseInt(linkageResult.rows[0].total_variants) || 0;
    console.log(`   Variants with inventory items: ${linkedVariants}/${totalVariants}`);
    
    if (linkedVariants < totalVariants) {
      console.log("\n⚠️  Some variants don't have inventory items linked.");
      console.log("   Stock deduction requires proper inventory item linkage.");
      console.log("   You may need to run the inventory seeding workflow.");
    }
    
    // Step 4: Check inventory levels
    console.log("\n[4/4] Checking inventory levels...");
    const levelsResult = await client.query(`
      SELECT 
        COUNT(*) as total_levels,
        SUM(stocked_quantity) as total_stock,
        SUM(reserved_quantity) as total_reserved
      FROM inventory_level
    `);
    
    const { total_levels, total_stock, total_reserved } = levelsResult.rows[0];
    console.log(`   Inventory levels: ${total_levels}`);
    console.log(`   Total stocked: ${total_stock || 0}`);
    console.log(`   Total reserved: ${total_reserved || 0}`);
    
    console.log("\n" + "=" .repeat(60));
    console.log("DONE! Next steps:");
    console.log("1. Place a test order");
    console.log("2. Check if reserved_quantity increases");
    console.log("3. After fulfillment, stocked_quantity should decrease");
    console.log("=" .repeat(60));
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

fixInventoryManagement();
