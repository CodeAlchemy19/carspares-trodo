import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * GET /store/orders?email=...
 * Get orders for a user by email using Medusa v2 Query API
 * 
 * MEDUSA V2 COMPLIANT - Uses Query API
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const { email } = req.query

  if (!email) {
    return res.status(400).json({ message: "Email required" })
  }

  try {
    const query = req.scope.resolve("query")
    
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "status",
        "email",
        "currency_code",
        "subtotal",
        "shipping_total",
        "tax_total",
        "total",
        "created_at",
        "items.id",
        "items.title",
        "items.quantity",
        "items.unit_price",
        "items.thumbnail",
      ],
      filters: { email: email as string },
      pagination: { order: { created_at: "DESC" } }
    })

    return res.json({ orders })

  } catch (err: any) {
    console.error("[Orders List Error]:", err)
    return res.status(500).json({ message: err.message || "Failed to retrieve orders" })
  }
}

export async function OPTIONS(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader("Access-Control-Allow-Origin", process.env.STORE_CORS || "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-publishable-api-key, x-user-id")
  res.sendStatus(200)
}
