import { model } from "@medusajs/framework/utils"

/**
 * Category Model - Automotive Parts Categories
 * 
 * Hierarchical category tree for organizing auto parts.
 * Uses parent_id for tree structure.
 */
export const Category = model.define("automotive_category", {
  id: model.id().primaryKey(),
  name: model.text(),
  slug: model.text().unique(),
  parent_id: model.text().nullable(),
  image_url: model.text().nullable(),
  description: model.text().nullable(),
  position: model.number().default(0),
  is_active: model.boolean().default(true),
})
