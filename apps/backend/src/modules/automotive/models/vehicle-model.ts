import { model } from "@medusajs/framework/utils"
import { VehicleMake } from "./vehicle-make"
import { VehicleType } from "./vehicle-type"

export const VehicleModel = model.define("vehicle_model", {
  id: model.id().primaryKey(),
  name: model.text(),
  slug: model.text().unique(),
  make: model.belongsTo(() => VehicleMake, {
    mappedBy: "models",
  }),
  types: model.hasMany(() => VehicleType, {
    mappedBy: "model",
  }),
})
