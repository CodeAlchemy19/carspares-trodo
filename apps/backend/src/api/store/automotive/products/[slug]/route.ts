import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import AutomotiveProductServiceV2 from "../../../../../lib/services/automotive-product-v2"

type Params = { slug: string }

/**
 * GET /store/automotive/products/:slug
 * 
 * Retrieves a product by slug with automotive-specific data
 * including fitments, pricing, and inventory.
 */
export async function GET(
  req: MedusaRequest<{}, Params>,
  res: MedusaResponse
) {
  const { slug } = req.params
  
  if (!slug) {
    return res.status(400).json({ 
      message: "Slug is required",
      code: "MISSING_SLUG"
    })
  }

  try {
    const service = new AutomotiveProductServiceV2(req.scope)
    const product = await service.retrieveBySlug(slug)
    
    if (!product) {
      return res.status(404).json({ 
        message: "Product not found",
        code: "PRODUCT_NOT_FOUND"
      })
    }
    
    return res.json({ product })
  } catch (err) {
    const error = err as Error
    console.error("[API] Error fetching product by slug:", error.message)
    return res.status(500).json({ 
      message: "Internal Server Error", 
      code: "INTERNAL_ERROR",
      ...(process.env.NODE_ENV === "development" && { error: error.message })
    })
  }
}

export async function OPTIONS(
  req: MedusaRequest,
  res: MedusaResponse
) {
  res.setHeader("Access-Control-Allow-Origin", process.env.STORE_CORS || "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-publishable-api-key")
  return res.sendStatus(200)
}

