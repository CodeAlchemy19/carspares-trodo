import { model } from "@medusajs/framework/utils"
import { VehicleModel } from "./vehicle-model"
import { Fitment } from "./fitment"

export const VehicleType = model.define("vehicle_type", {
  id: model.id().primaryKey(),
  name: model.text(),
  slug: model.text().unique(),
  model: model.belongsTo(() => VehicleModel, {
    mappedBy: "types",
  }),
  year_from: model.number().nullable(),
  year_to: model.number().nullable(),
  power_kw: model.number().nullable(),
  power_hp: model.number().nullable(),
  engine_displacement: model.number().nullable(),
  fuel_type: model.text().nullable(),
  engine: model.text().nullable(),
  body_type: model.text().nullable(),
  ktype_id: model.text().nullable(),
  fitments: model.hasMany(() => Fitment, {
    mappedBy: "vehicle",
  }),
  // Note: garages relationship is defined in UserGarage model with belongsTo
})
