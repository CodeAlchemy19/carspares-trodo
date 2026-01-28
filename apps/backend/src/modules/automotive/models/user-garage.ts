import { model } from "@medusajs/framework/utils"
import { VehicleType } from "./vehicle-type"

/**
 * UserGarage - Stores user's saved vehicles
 * 
 * Links a user to vehicles they own or are interested in,
 * enabling quick fitment searches and personalized product suggestions.
 */
export const UserGarage = model.define("user_garage", {
  id: model.id().primaryKey(),
  user_id: model.text().index("idx_user_garage_user"),
  nickname: model.text().nullable(), // "My Honda"
  vin: model.text().nullable(),
  license_plate: model.text().nullable(),
  vehicle: model.belongsTo(() => VehicleType, {
    mappedBy: "garages",
  }),
})
