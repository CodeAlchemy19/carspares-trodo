import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ALLOWED_ORIGIN } from "../../../../lib/clients"

function setCors(res: MedusaResponse) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN || "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-publishable-api-key")
}

export async function OPTIONS(req: MedusaRequest, res: MedusaResponse) {
  setCors(res)
  res.sendStatus(200)
}

type Params = { id: string }

/**
 * GET /store/sku/:id
 * 
 * Retrieves a product by variant ID with automotive data
 */
export async function GET(req: MedusaRequest<{}, Params>, res: MedusaResponse) {
  setCors(res)
  const { id } = req.params

  if (!id || id.length < 10) {
    return res.status(400).json({ 
      message: "Invalid product ID format",
      code: "INVALID_ID"
    })
  }

  try {
    const automotiveProductService = req.scope.resolve("automotiveProductServiceV2")
    const product = await automotiveProductService.retrieve(id)

    if (!product) {
      return res.status(404).json({ 
        message: "Product not found",
        code: "NOT_FOUND"
      })
    }

    return res.json(product)

  } catch (err) {
    const error = err as Error
    console.error("[SKU API] Error:", error.message)
    return res.status(500).json({ 
      message: "Internal Server Error",
      code: "INTERNAL_ERROR",
      ...(process.env.NODE_ENV === "development" && { error: error.message })
    })
  }
}

