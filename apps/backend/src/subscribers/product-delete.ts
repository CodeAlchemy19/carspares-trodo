/**
 * Product Delete Subscriber
 * 
 * Removes products from OpenSearch when they are deleted.
 */
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";

import { deleteProduct } from "../lib/opensearchSync";
import { logger } from "../lib/logger";
import { invalidateCache } from "../lib/cache";

/**
 * Handler for product delete events
 */
export default async function productDeleteHandler({
  event,
}: SubscriberArgs<{ id: string }>) {
  const productId = event.data.id;
  
  try {
    logger.info("Product delete triggered", { productId });
    
    // Remove from OpenSearch
    await deleteProduct(productId);
    
    // Invalidate caches
    await invalidateCache("products", productId);
    await invalidateCache("sku", productId);
    
    logger.info("Product removed from OpenSearch", { productId });
  } catch (err) {
    logger.error("Product delete sync failed", { productId, error: err });
  }
}

export const config: SubscriberConfig = {
  event: [
    "product.deleted",
    "product-variant.deleted"
  ],
};
