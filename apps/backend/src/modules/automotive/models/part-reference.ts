import { model } from "@medusajs/framework/utils"

/**
 * PartReference Model - OE Cross-Reference Numbers
 * 
 * Stores original equipment (OE) and cross-reference part numbers
 * for product variants. Enables lookup by OE number.
 */
export const PartReference = model.define("part_reference", {
  id: model.id().primaryKey(),
  variant_id: model.text(),
  reference_type: model.text(), // OE, OEM, CROSS, AFTERMARKET
  reference_number: model.text(),
  brand_id: model.text().nullable(),
})
