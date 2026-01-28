import { model } from "@medusajs/framework/utils"

/**
 * CategoryAttribute Model - Category-Attribute Mapping
 * 
 * Links categories to their relevant filterable attributes.
 * For example: "Brake Discs" category has "Diameter", "Thickness" attributes.
 */
export const CategoryAttribute = model.define("category_attribute", {
  id: model.id().primaryKey(),
  category_id: model.text(),
  attribute_id: model.text(),
  is_required: model.boolean().default(false),
  position: model.number().default(0),
})
