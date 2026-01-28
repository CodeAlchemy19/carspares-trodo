/**
 * OpenSearch Sync Service - Medusa V2 Edition
 * 
 * Provides real-time product indexing for OpenSearch.
 * Uses Medusa v2 native tables (public.*) instead of legacy automotive.* tables.
 * 
 * MEDUSA V2 COMPLIANT - Uses native Product, Pricing, and Inventory modules
 */

import { getOsClient, getPgClient } from "./clients";
import { logger } from "./logger";

export const INDEX_NAME = 'products_v1';

/**
 * Build category handle path from category ID (Medusa v2)
 * Uses public.product_category instead of automotive.category
 */
async function getCategoryHandles(pgClient: any, categoryId: string): Promise<string[]> {
  const handles: string[] = [];
  let currentId = categoryId;
  
  while (currentId) {
    const result = await pgClient.query(`
      SELECT id, parent_category_id, handle, name FROM product_category WHERE id = $1
    `, [currentId]);
    
    if (result.rows.length === 0) break;
    
    const cat = result.rows[0];
    handles.push(cat.handle);
    
    // Also index leaf handle if it's a path
    if (cat.handle && cat.handle.includes('-')) {
        const parts = cat.handle.split('-');
        if (parts.length > 0) handles.push(parts[parts.length - 1]);
    }

    currentId = cat.parent_category_id;
  }
  
  return handles;
}

/**
 * Get fitment vehicle type IDs for a product variant (via link table)
 * Uses Medusa module link or direct query
 */
async function getVehicleTypeIds(pgClient: any, variantId: string): Promise<string[]> {
  // Try to get from module link (productVariant <-> fitment)
  const result = await pgClient.query(`
    SELECT fitment_id FROM product_variant_fitment 
    WHERE product_variant_id = $1
  `, [variantId]);
  
  if (result.rows.length > 0) {
    // Get vehicle type IDs from fitment records
    const fitmentIds = result.rows.map((r: any) => r.fitment_id);
    const vehicleResult = await pgClient.query(`
      SELECT vehicle_id FROM fitment WHERE id = ANY($1::text[])
    `, [fitmentIds]);
    return vehicleResult.rows.map((r: any) => r.vehicle_id);
  }
  
  // Fallback: Try automotive schema if link doesn't exist yet
  const fallbackResult = await pgClient.query(`
    SELECT vehicle_type_id FROM automotive.fitment 
    WHERE product_variant_id = $1
  `, [variantId]);
  
  return fallbackResult.rows.map((r: any) => r.vehicle_type_id);
}

/**
 * Build product document for OpenSearch using Medusa v2 tables
 */
export async function buildProductDocument(pgClient: any, variantId: string): Promise<any | null> {
  // Fetch product variant with all related data from Medusa tables
  const result = await pgClient.query(`
    SELECT 
      pv.id,
      pv.sku,
      pv.ean,
      pv.metadata as variant_metadata,
      p.id as product_id,
      p.title,
      p.handle,
      p.description,
      p.subtitle as brand,
      p.thumbnail,
      p.metadata as product_metadata,
      -- Get price from Medusa Pricing Module
      (SELECT pr.amount / 100.0 FROM product_variant_price_set pvps
       JOIN price pr ON pr.price_set_id = pvps.price_set_id
       WHERE pvps.variant_id = pv.id
       LIMIT 1) as price,
      (SELECT pr.currency_code FROM product_variant_price_set pvps
       JOIN price pr ON pr.price_set_id = pvps.price_set_id
       WHERE pvps.variant_id = pv.id
       LIMIT 1) as currency_code,
      -- Get stock from Medusa Inventory Module (if enabled)
      (SELECT COALESCE(SUM(il.stocked_quantity - il.reserved_quantity), 0)
       FROM product_variant_inventory_item pvii
       JOIN inventory_item ii ON ii.id = pvii.inventory_item_id
       JOIN inventory_level il ON il.inventory_item_id = ii.id
       WHERE pvii.variant_id = pv.id) as stock,
      -- Get categories
      (SELECT array_agg(pcp.product_category_id) 
       FROM product_category_product pcp 
       WHERE pcp.product_id = p.id) as category_ids,
      (SELECT pc.name 
       FROM product_category_product pcp 
       JOIN product_category pc ON pc.id = pcp.product_category_id
       WHERE pcp.product_id = p.id 
       LIMIT 1) as primary_category,
      pv.created_at
    FROM product_variant pv
    JOIN product p ON p.id = pv.product_id
    WHERE pv.id = $1 AND pv.deleted_at IS NULL
  `, [variantId]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  // Get category handles (full ancestry for filtering)
  const categoryHandles = new Set<string>();
  if (row.category_ids) {
    for (const catId of row.category_ids) {
      const handles = await getCategoryHandles(pgClient, catId);
      handles.forEach(h => categoryHandles.add(h));
    }
  }

  // Get vehicle type IDs for fitment filtering
  const vehicleTypeIds = await getVehicleTypeIds(pgClient, variantId);

  // Get specifications from variant metadata
  const specs = { ...(row.variant_metadata?.specifications || row.product_metadata?.specs || {}) };
  
  // Clean specifications (remove identifier-type attributes)
  const bannedKeys = ['EAN', 'MPN', 'SKU', 'Year', 'Start Year', 'End Year', 'Make', 'Model', 'Type', 'Brand', 'Manufacturer Part Number'];
  bannedKeys.forEach(key => {
    delete specs[key];
    Object.keys(specs).forEach(k => {
      if (k.toLowerCase() === key.toLowerCase()) delete specs[k];
    });
  });

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    sku: row.sku,
    mpn: row.variant_metadata?.mpn || row.sku,
    ean: row.ean,
    brand: row.brand,
    brand_slug: row.brand?.toLowerCase().replace(/\s+/g, '-'),
    category: row.primary_category,
    category_slugs: Array.from(categoryHandles),
    specifications: specs,
    image_url: row.thumbnail || null,
    images: row.product_metadata?.images || [],
    price: parseFloat(row.price || 0),
    currency: row.currency_code || 'egp',
    in_stock: parseInt(row.stock || 0) > 0,
    stock_quantity: parseInt(row.stock || 0),
    lead_time_days: 2, // Default
    vehicle_type_ids: vehicleTypeIds,
    created_at: row.created_at
  };
}

/**
 * Index a single product variant in OpenSearch
 */
export async function indexProduct(variantId: string): Promise<boolean> {
  const pgClient = getPgClient();
  const osClient = getOsClient();

  try {
    const document = await buildProductDocument(pgClient, variantId);
    
    if (!document) {
      logger.warn('Product not found for indexing', { variantId });
      return false;
    }

    await osClient.index({
      index: INDEX_NAME,
      id: variantId,
      body: document,
      refresh: 'wait_for' // Ensure immediately searchable
    });

    logger.info('Product indexed', { variantId, sku: document.sku });
    return true;
  } catch (err) {
    logger.error('Failed to index product', { variantId, error: err });
    return false;
  }
}

/**
 * Index multiple products in batch
 */
export async function indexProducts(variantIds: string[]): Promise<{success: number, failed: number}> {
  const pgClient = getPgClient();
  const osClient = getOsClient();
  
  let success = 0;
  let failed = 0;

  try {
    // Build bulk body
    const operations: any[] = [];
    
    for (const variantId of variantIds) {
      const document = await buildProductDocument(pgClient, variantId);
      
      if (document) {
        operations.push({ index: { _index: INDEX_NAME, _id: variantId } });
        operations.push(document);
      } else {
        failed++;
      }
    }

    if (operations.length > 0) {
      const response = await osClient.bulk({ body: operations, refresh: true });
      
      if (response.body.errors) {
        response.body.items.forEach((item: any) => {
          if (item.index?.error) {
            failed++;
            logger.error('Bulk index error', { error: item.index.error });
          } else {
            success++;
          }
        });
      } else {
        success = operations.length / 2; // Each doc has 2 items (action + doc)
      }
    }

    logger.info('Batch indexing complete', { success, failed });
  } catch (err) {
    logger.error('Batch indexing failed', { error: err });
    failed = variantIds.length;
  }

  return { success, failed };
}

/**
 * Remove a product from OpenSearch index
 */
export async function deleteProduct(variantId: string): Promise<boolean> {
  const osClient = getOsClient();

  try {
    await osClient.delete({
      index: INDEX_NAME,
      id: variantId,
      refresh: true
    });

    logger.info('Product deleted from index', { variantId });
    return true;
  } catch (err: any) {
    if (err.meta?.statusCode === 404) {
      // Already deleted - not an error
      return true;
    }
    logger.error('Failed to delete product from index', { variantId, error: err });
    return false;
  }
}

/**
 * Update product stock status in OpenSearch
 */
export async function updateProductStock(variantId: string, inStock: boolean, stockQuantity?: number): Promise<boolean> {
  const osClient = getOsClient();

  try {
    const updateDoc: any = { in_stock: inStock };
    if (stockQuantity !== undefined) {
      updateDoc.stock_quantity = stockQuantity;
    }
    
    await osClient.update({
      index: INDEX_NAME,
      id: variantId,
      body: {
        doc: updateDoc
      },
      refresh: true
    });

    logger.debug('Product stock updated', { variantId, inStock, stockQuantity });
    return true;
  } catch (err: any) {
    if (err.meta?.statusCode === 404) {
      // Document doesn't exist - index it fully
      return await indexProduct(variantId);
    }
    logger.error('Failed to update product stock', { variantId, error: err });
    return false;
  }
}

/**
 * Update product price in OpenSearch
 */
export async function updateProductPrice(variantId: string, price: number): Promise<boolean> {
  const osClient = getOsClient();

  try {
    await osClient.update({
      index: INDEX_NAME,
      id: variantId,
      body: {
        doc: { price: parseFloat(price.toString()) }
      },
      refresh: true
    });

    logger.debug('Product price updated', { variantId, price });
    return true;
  } catch (err: any) {
    if (err.meta?.statusCode === 404) {
      return await indexProduct(variantId);
    }
    logger.error('Failed to update product price', { variantId, error: err });
    return false;
  }
}
