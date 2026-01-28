import { model } from "@medusajs/framework/utils"

/**
 * Attribute Model - Filterable Product Attributes
 * 
 * Defines attributes that can be used for filtering products
 * (e.g., Diameter, Weight, Material, Color).
 */
export const Attribute = model.define("attribute", {
  id: model.id().primaryKey(),
  name: model.text(),
  code: model.text().unique(),
  type: model.text().default("string"), // string, number, boolean
  unit: model.text().nullable(),
  is_filterable: model.boolean().default(false),
  is_visible: model.boolean().default(true),
  position: model.number().default(0),
})
