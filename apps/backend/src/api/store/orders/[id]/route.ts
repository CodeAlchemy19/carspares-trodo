import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * GET /store/orders/:id
 * Retrieve order details using Medusa Query API
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const { id } = req.params

  try {
    const query = req.scope.resolve("query")
    
    const { data: [order] } = await query.graph({
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
        "items.*",
        "shipping_address.*",
        "billing_address.*",
      ],
      filters: { id },
    })

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    return res.json({ order })

  } catch (err: any) {
    console.error("[Order GET Error]:", err)
    if (err.type === "not_found" || err.message?.includes("not found")) {
      return res.status(404).json({ message: "Order not found" })
    }
    return res.status(500).json({ message: err.message || "Failed to retrieve order" })
  }
}
