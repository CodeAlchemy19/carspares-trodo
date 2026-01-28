import { model } from "@medusajs/framework/utils"
import { VehicleType } from "./vehicle-type"

export const Fitment = model.define("fitment", {
  id: model.id().primaryKey(),
  vehicle: model.belongsTo(() => VehicleType, {
    mappedBy: "fitments",
  }),
  variant_id: model.text(),
  position: model.text().nullable(),
  notes: model.text().nullable(),
  criteria: model.json().nullable(),
})

