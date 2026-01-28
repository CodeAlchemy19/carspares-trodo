import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { logger } from "../lib/logger";

export default async function automotiveSyncSubscriber(
  data: { id: string },
  { container, event }: SubscriberArgs<{ id: string }>
) {
  const variantId = data.id
  if (!variantId) return

  try {
    // Resolve services
    const automotiveProductService = container.resolve("automotiveProductServiceV2") as any
    const searchService = container.resolve("searchService") as any

    const doc = await automotiveProductService.retrieveForIndexing(variantId);
    if (doc) {
        await searchService.indexDocument("products_v1", doc);
        logger.info(`[Sync] Indexed product variant`, { variantId });
    }
  } catch (err: any) {
    logger.error(`[Sync] Failed to index product variant`, { variantId, error: err.message });
  }
}

export const config: SubscriberConfig = {
  event: ["product-variant.updated", "product-variant.created"],
}
