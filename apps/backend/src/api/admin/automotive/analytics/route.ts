/**
 * Admin API - Automotive Analytics
 * 
 * Provides analytics endpoints for automotive data overview.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgClient } from "../../../../lib/clients";

// GET /admin/automotive/analytics - Get automotive statistics
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pgClient = getPgClient();
    
    // Get counts from automotive module tables
    // Medusa v2 creates tables in public schema with pattern: {module}_{model}
    // e.g., automotive_vehicle_manufacturer, automotive_vehicle_model, etc.
    const stats = await pgClient.query(`
      SELECT 
        (SELECT COUNT(*) FROM automotive_vehicle_manufacturer) as total_makes,
        (SELECT COUNT(*) FROM automotive_vehicle_model) as total_models,
        (SELECT COUNT(*) FROM automotive_vehicle_type) as total_types,
        (SELECT COUNT(*) FROM automotive_fitment) as total_fitments,
        (SELECT COUNT(*) FROM automotive_user_garage) as total_garage_entries,
        (SELECT COUNT(*) FROM automotive_category) as total_categories,
        (SELECT COUNT(*) FROM automotive_attribute) as total_attributes
    `);
    
    // Get recent activity
    const recentFitments = await pgClient.query(`
      SELECT COUNT(*) as count 
      FROM automotive_fitment 
      WHERE created_at > NOW() - INTERVAL '7 days'
    `);
    
    // Get product stats
    const productStats = await pgClient.query(`
      SELECT 
        (SELECT COUNT(*) FROM product) as total_products,
        (SELECT COUNT(*) FROM product_variant) as total_variants,
        (SELECT COUNT(*) FROM product_variant WHERE manage_inventory = true) as variants_with_inventory
    `);
    
    // Get inventory health
    const inventoryHealth = await pgClient.query(`
      SELECT 
        COUNT(*) as total_levels,
        SUM(stocked_quantity) as total_stock,
        SUM(reserved_quantity) as total_reserved,
        COUNT(*) FILTER (WHERE stocked_quantity - reserved_quantity <= 0) as out_of_stock,
        COUNT(*) FILTER (WHERE stocked_quantity - reserved_quantity > 0 AND stocked_quantity - reserved_quantity <= 5) as low_stock
      FROM inventory_level
    `);
    
    // Get top makes by model count
    const topMakes = await pgClient.query(`
      SELECT 
        vm.name,
        vm.id,
        COUNT(vmod.id) as model_count
      FROM automotive_vehicle_manufacturer vm
      LEFT JOIN automotive_vehicle_model vmod ON vmod.make_id = vm.id
      GROUP BY vm.id, vm.name
      ORDER BY model_count DESC
      LIMIT 10
    `);
    
    res.json({
      automotive: {
        makes: parseInt(stats.rows[0]?.total_makes || '0'),
        models: parseInt(stats.rows[0]?.total_models || '0'),
        types: parseInt(stats.rows[0]?.total_types || '0'),
        fitments: parseInt(stats.rows[0]?.total_fitments || '0'),
        garage_entries: parseInt(stats.rows[0]?.total_garage_entries || '0'),
        categories: parseInt(stats.rows[0]?.total_categories || '0'),
        attributes: parseInt(stats.rows[0]?.total_attributes || '0'),
      },
      products: {
        total: parseInt(productStats.rows[0]?.total_products || '0'),
        variants: parseInt(productStats.rows[0]?.total_variants || '0'),
        with_inventory: parseInt(productStats.rows[0]?.variants_with_inventory || '0'),
      },
      inventory: {
        total_levels: parseInt(inventoryHealth.rows[0]?.total_levels || '0'),
        total_stock: parseInt(inventoryHealth.rows[0]?.total_stock || '0'),
        total_reserved: parseInt(inventoryHealth.rows[0]?.total_reserved || '0'),
        out_of_stock: parseInt(inventoryHealth.rows[0]?.out_of_stock || '0'),
        low_stock: parseInt(inventoryHealth.rows[0]?.low_stock || '0'),
      },
      activity: {
        fitments_last_7_days: parseInt(recentFitments.rows[0]?.count || '0'),
      },
      top_makes: topMakes.rows,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Admin] Analytics error:", error);
    res.status(500).json({ 
      error: "Failed to get analytics",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
