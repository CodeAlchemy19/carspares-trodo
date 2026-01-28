import AutomotiveService from "./service"
import { Module } from "@medusajs/framework/utils"
import { 
  VehicleManufacturer, 
  VehicleModel, 
  VehicleType, 
  Fitment,
  UserGarage,
  Brand,
  Category,
  Attribute,
  CategoryAttribute,
  PartReference,
} from "./models"

export const AUTOMOTIVE_MODULE = "automotive"

/**
 * Automotive Module - Full Medusa v2 Native
 * 
 * Complete automotive parts e-commerce module:
 * 
 * Vehicle Data:
 * - VehicleManufacturer: Makes (e.g., Toyota, BMW)
 * - VehicleModel: Model series (e.g., Camry, 3 Series) 
 * - VehicleType: Specific variant (e.g., 2020 Camry 2.5L)
 * - Fitment: Links products to compatible vehicles
 * - UserGarage: Saved user vehicles
 * 
 * Catalog Data:
 * - Brand: Part manufacturers (Bosch, Brembo, etc.)
 * - Category: Parts category tree
 * - Attribute: Filterable product attributes
 * - CategoryAttribute: Category-attribute mapping
 * - PartReference: OE cross-reference numbers
 */
export default Module(AUTOMOTIVE_MODULE, {
  service: AutomotiveService,
})

// Re-export all models
export { 
  VehicleManufacturer,
  VehicleModel, 
  VehicleType, 
  Fitment,
  UserGarage,
  Brand,
  Category,
  Attribute,
  CategoryAttribute,
  PartReference,
} from "./models"

// Backward compatibility alias
export { VehicleManufacturer as VehicleMake } from "./models"
