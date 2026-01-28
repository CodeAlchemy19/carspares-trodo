
import { ALLOWED_ORIGIN } from "../../../../lib/clients";
import { handleApiError, validationError } from "../../../../lib/errorHandler";

function setCors(res: any) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-publishable-api-key");
}

export async function OPTIONS(req: any, res: any) {
  setCors(res);
  res.sendStatus(200);
}

/**
 * GET /store/product/:slug
 * 
 * MEDUSA V2 COMPLIANT - Uses AutomotiveProductServiceV2 with Remote Query
 */
export async function GET(req: any, res: any) {
  setCors(res);
  const { slug } = req.params;

  if (!slug) {
    return handleApiError(res, validationError("Missing slug"), "Product API");
  }

  try {
    const automotiveProductService = req.scope.resolve("automotiveProductServiceV2");
    
    // Check if the 'slug' is actually a UUID (UUID v4 format)
    // If so, fetch by ID directly. This supports products that don't have a slug yet.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

    console.log(`[ProductAPI] Fetching slug: ${slug} (IsUUID: ${isUuid})`);

    let product;
    if (isUuid) {
        // It's an ID
        console.log(`[ProductAPI] Fetching by ID: ${slug}`);
        product = await automotiveProductService.retrieve(slug);
    } else {
        // It's a proper slug
        console.log(`[ProductAPI] Fetching by Slug: ${slug}`);
        product = await automotiveProductService.retrieveBySlug(slug);
    }
    
    if (product) {
       console.log(`[ProductAPI] Found product: ${product.id}`);
    } else {
       console.log(`[ProductAPI] Product NOT found!`);
    }

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json(product);

  } catch (err) {
    return handleApiError(res, err, "Product API");
  }
}
