import AutomotiveModule from "../modules/automotive"
import ProductModule from "@medusajs/product"
import { defineLink } from "@medusajs/framework/utils"

/**
 * Module Link: ProductVariant <-> Fitment
 * 
 * Links Medusa native product variants to automotive fitment data.
 * This enables querying products with their vehicle compatibility info.
 */
export default defineLink(
  ProductModule.linkable.productVariant,
  AutomotiveModule.linkable.fitment
)

