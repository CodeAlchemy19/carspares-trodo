import { MedusaService } from "@medusajs/framework/utils"
import * as AutomotiveModels from "./models"

/**
 * AutomotiveService - Medusa v2 Module Service
 * 
 * Extends base MedusaService with custom business logic for:
 * - Vehicle hierarchy navigation (Make → Model → Type)
 * - Fitment lookups (which products fit which vehicles)
 * - Search/filter operations for vehicle selection UI
 */
class AutomotiveService extends MedusaService({
  ...AutomotiveModels,
}) {
  
  /**
   * Get all makes with optional filtering
   */
  async listMakes(filters?: { name?: string }, config?: { select?: string[] }) {
    return this.listVehicleManufacturers(filters, config)
  }

  /**
   * Get models for a specific make
   */
  async listModelsByMake(makeId: string, config?: { select?: string[] }) {
    return this.listVehicleModels(
      { make_id: makeId },
      { 
        select: config?.select || ["id", "name", "slug"],
        order: { name: "ASC" }
      }
    )
  }

  /**
   * Get vehicle types for a specific model
   */
  async listTypesByModel(modelId: string, config?: { select?: string[] }) {
    return this.listVehicleTypes(
      { model_id: modelId },
      { 
        select: config?.select || ["id", "name", "slug", "year_from", "year_to", "fuel_type"],
        order: { year_from: "DESC", name: "ASC" }
      }
    )
  }

  /**
   * Get fitments for a specific vehicle type
   * Returns product variant IDs that are compatible with this vehicle
   */
  async listFitmentsByVehicleType(vehicleTypeId: string): Promise<{ variant_id: string; position: string | null }[]> {
    const fitments = await this.listFitments(
      { vehicle_id: vehicleTypeId },
      { select: ["id", "variant_id", "position"] }
    )
    return fitments.map(f => ({
      variant_id: f.variant_id,
      position: f.position
    }))
  }

  /**
   * Get all vehicle types that a product variant fits
   */
  async listVehicleTypesForVariant(variantId: string) {
    const fitments = await this.listFitments(
      { variant_id: variantId },
      { 
        select: ["id", "vehicle_id", "position"],
        relations: ["vehicle", "vehicle.model", "vehicle.model.make"]
      }
    )
    
    return fitments.map(f => ({
      fitment_id: f.id,
      position: f.position,
      vehicle_type: f.vehicle ? {
        id: f.vehicle.id,
        name: f.vehicle.name,
        slug: f.vehicle.slug,
        year_from: f.vehicle.year_from,
        year_to: f.vehicle.year_to,
        model: f.vehicle.model?.name,
        make: f.vehicle.model?.make?.name
      } : null
    }))
  }

  /**
   * Resolve vehicle hierarchy from slugs
   * Useful for URL-based vehicle selection
   */
  async resolveVehicleFromSlugs(
    makeSlug?: string,
    modelSlug?: string,
    typeSlug?: string
  ): Promise<{ make?: any; model?: any; type?: any }> {
    const result: { make?: any; model?: any; type?: any } = {}

    if (makeSlug) {
      const makes = await this.listVehicleManufacturers({ slug: makeSlug }, { take: 1 })
      if (makes[0]) result.make = makes[0]
    }

    if (modelSlug) {
      const models = await this.listVehicleModels(
        { slug: modelSlug },
        { take: 1, relations: ["make"] }
      )
      if (models[0]) {
        result.model = models[0]
        if (!result.make && models[0].make) {
          result.make = models[0].make
        }
      }
    }

    if (typeSlug) {
      const types = await this.listVehicleTypes(
        { slug: typeSlug },
        { take: 1, relations: ["model", "model.make"] }
      )
      if (types[0]) {
        result.type = types[0]
        if (!result.model && types[0].model) {
          result.model = types[0].model
        }
        if (!result.make && types[0].model?.make) {
          result.make = types[0].model.make
        }
      }
    }

    return result
  }

  /**
   * Get full vehicle display name
   * Format: "Make Model Type (Year-Year)"
   */
  async getVehicleDisplayName(typeId: string): Promise<string | null> {
    const types = await this.listVehicleTypes(
      { id: typeId },
      { take: 1, relations: ["model", "model.make"] }
    )
    
    if (!types[0]) return null
    
    const type = types[0]
    const make = type.model?.make?.name || ""
    const model = type.model?.name || ""
    const typeName = type.name || ""
    const years = type.year_from 
      ? `(${type.year_from}-${type.year_to || "present"})`
      : ""
    
    return `${make} ${model} ${typeName} ${years}`.trim()
  }

  /**
   * User Garage Management - Medusa v2 Compliant
   */
  
  /**
   * Get all vehicles in a user's garage
   */
  async getUserGarageVehicles(userId: string) {
    return this.listUserGarages(
      { user_id: userId },
      { 
        relations: ["vehicle", "vehicle.model", "vehicle.model.make"],
        order: { created_at: "DESC" }
      }
    )
  }

  /**
   * Add a vehicle to user's garage
   */
  async addVehicleToGarage(data: {
    user_id: string
    vehicle_id: string
    nickname?: string
    vin?: string
    license_plate?: string
  }) {
    const id = crypto.randomUUID()
    
    // Verify vehicle type exists
    const vehicleTypes = await this.listVehicleTypes({ id: data.vehicle_id }, { take: 1 })
    if (!vehicleTypes.length) {
      throw new Error("Vehicle type not found")
    }

    return this.createUserGarages({
      id,
      user_id: data.user_id,
      vehicle_id: data.vehicle_id,
      nickname: data.nickname || null,
      vin: data.vin || null,
      license_plate: data.license_plate || null
    })
  }

  /**
   * Remove a vehicle from user's garage
   */
  async removeVehicleFromGarage(garageId: string, userId: string) {
    // Verify ownership
    const entries = await this.listUserGarages({ id: garageId, user_id: userId }, { take: 1 })
    if (!entries.length) {
      throw new Error("Garage entry not found or access denied")
    }

    await this.deleteUserGarages(garageId)
    return { success: true }
  }
}

export default AutomotiveService


