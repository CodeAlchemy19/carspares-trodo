/**
 * Product Sync Subscriber
 * 
 * Auto-syncs products to OpenSearch when they are created, updated, or deleted.
 * Listens to Medusa product events and triggers index updates.
 */
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";

// Import sync service
import { indexProduct, deleteProduct } from "../lib/opensearchSync";
import { logger } from "../lib/logger";
import { invalidateCache } from "../lib/cache";

/**
 * Handler for product create/update events
 * Indexes the product in OpenSearch
 */
export default async function productSyncHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const productId = event.data.id;
  
  try {
    logger.info("Product sync triggered", { 
      productId, 
      eventName: event.name 
    });
    
    // Index in OpenSearch
    const success = await indexProduct(productId);
    
    if (success) {
      // Invalidate related caches
      await invalidateCache("products", productId);
      await invalidateCache("sku", productId);
      
      logger.info("Product synced to OpenSearch", { productId });
    }
  } catch (err) {
    logger.error("Product sync failed", { 
      productId, 
      error: err 
    });
  }
}

// Subscribe to product events
export const config: SubscriberConfig = {
  event: [
    "product.created",
    "product.updated",
    "product-variant.created",
    "product-variant.updated"
  ],
};
