/**
 * Stock Level Subscriber
 * 
 * Updates product stock status in OpenSearch when inventory changes.
 * Uses Medusa v2 native inventory_level table.
 */
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";

import { updateProductStock } from "../lib/opensearchSync";
import { logger } from "../lib/logger";
import { invalidateCache } from "../lib/cache";
import { getPgClient } from "../lib/clients";

/**
 * Handler for inventory/stock level changes
 * Updated to use Medusa v2 native tables
 */
export default async function stockLevelHandler({
  event,
  container,
}: SubscriberArgs<any>) {
  const eventName = event.name;
  const data = event.data;
  
  logger.info("Stock sync event received", { 
    eventName,
    data 
  });

  try {
    const pgClient = getPgClient();
    const variantIdsToSync = new Set<string>();

    // 1. Handle Order Events (Fetch items to sync)
    if (eventName === "order.placed" || eventName === "order.completed" || eventName === "order.canceled") {
      const orderId = data.id;
      if (orderId) {
        // Use Remote Query to get line items
        const remoteQuery = container.resolve("remoteQuery");
        const query = {
          entryPoint: "order",
          fields: ["items.variant_id"],
          variables: { id: orderId }
        };
        
        const result = await remoteQuery(query);
        
        // Handling result as Array (Medusa v2 remoteQuery behavior)
        const order = Array.isArray(result) ? result[0] : result;

        logger.info("Stock Sync: Order Fetched", { 
          orderId,
          orderFound: !!order,
          itemCount: order?.items?.length || 0
        });

        if (order?.items) {
          order.items.forEach((item: any) => {
            if (item.variant_id) variantIdsToSync.add(item.variant_id);
          });
        }
      }
    } 
    // 2. Handle Inventory/Reservation Events
    else {
      // Direct Variant ID?
      if (data.variant_id || data.product_variant_id) {
        variantIdsToSync.add(data.variant_id || data.product_variant_id);
      }
      
      // Inventory Item ID?
      const inventoryItemId = data.inventory_item_id || (eventName.includes("inventory-item") ? data.id : null);
      
      if (inventoryItemId) {
        // Resolve Variant ID from Inventory Item
        const linkResult = await pgClient.query(`
          SELECT variant_id 
          FROM product_variant_inventory_item 
          WHERE inventory_item_id = $1
          LIMIT 1
        `, [inventoryItemId]);
        
        if (linkResult.rows[0]?.variant_id) {
          variantIdsToSync.add(linkResult.rows[0].variant_id);
        }
      }
    }

    if (variantIdsToSync.size === 0) {
      logger.debug("No variants identified for stock sync", { eventName, data });
      return;
    }

    // Sync each identified variant
    for (const variantId of variantIdsToSync) {
      // Get current stock from Medusa's native inventory_level table
      const result = await pgClient.query(`
        SELECT COALESCE(SUM(il.stocked_quantity - il.reserved_quantity), 0) as available
        FROM inventory_level il
        JOIN inventory_item ii ON il.inventory_item_id = ii.id
        JOIN product_variant_inventory_item pvii ON pvii.inventory_item_id = ii.id
        WHERE pvii.variant_id = $1
      `, [variantId]);
      
      const available = parseInt(result.rows[0]?.available || '0');
      const inStock = available > 0;
      
      // Update OpenSearch
      await updateProductStock(variantId, inStock, available);
      
      // Invalidate cache
      await invalidateCache("sku", variantId);
      
      logger.info("Stock synced to OpenSearch", { 
        variantId, 
        inStock, 
        available,
        trigger: eventName 
      });
    }

  } catch (err) {
    logger.error("Stock sync failed", { 
      eventName, 
      error: err 
    });
  }
}

export const config: SubscriberConfig = {
  event: [
    // Inventory events
    "inventory-level.updated",
    "inventory-level.created",
    "inventory-level.deleted",
    "inventory-item.created",
    "inventory-item.updated",
    // Reservation events
    "reservation-item.created",
    "reservation-item.updated",
    "reservation-item.deleted",
    // Order events
    "order.placed",
    "order.completed",
    "order.canceled"
  ],
};

