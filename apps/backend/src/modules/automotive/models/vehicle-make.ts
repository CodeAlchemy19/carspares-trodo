import { model } from "@medusajs/framework/utils"
import { VehicleModel } from "./vehicle-model"

// Named VehicleManufacturer to match table name for consistent service method generation
export const VehicleManufacturer = model.define("vehicle_manufacturer", {
  id: model.id().primaryKey(),
  name: model.text(),
  slug: model.text().unique(),
  logo_url: model.text().nullable(),
  country: model.text().nullable(),
  models: model.hasMany(() => VehicleModel, {
    mappedBy: "make",
  }),
})

// Alias for backward compatibility
export const VehicleMake = VehicleManufacturer

