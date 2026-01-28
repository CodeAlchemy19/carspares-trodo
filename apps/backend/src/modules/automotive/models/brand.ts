import { model } from "@medusajs/framework/utils"

/**
 * Brand Model - Part Manufacturers
 * 
 * Represents automotive part manufacturers/brands like Bosch, Brembo, etc.
 */
export const Brand = model.define("brand", {
  id: model.id().primaryKey(),
  name: model.text(),
  slug: model.text().unique(),
  logo_url: model.text().nullable(),
  website: model.text().nullable(),
})
