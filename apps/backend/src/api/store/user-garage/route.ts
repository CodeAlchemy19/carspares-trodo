import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ALLOWED_ORIGIN } from "../../../lib/clients"

function setCors(res: MedusaResponse) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN || "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-publishable-api-key, x-user-id")
}

export async function OPTIONS(req: MedusaRequest, res: MedusaResponse) {
  setCors(res)
  res.sendStatus(200)
}

/**
 * GET /store/user-garage
 * 
 * Get all saved vehicles for a user
 * MEDUSA V2 COMPLIANT - Uses automotive module service
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  setCors(res)
  
  const userId = req.headers['x-user-id'] as string || req.query.user_id as string

  if (!userId) {
    return res.status(400).json({ 
      message: "User ID required",
      code: "MISSING_USER_ID"
    })
  }

  try {
    const automotiveService = req.scope.resolve("automotive") as any

    const garageEntries = await automotiveService.getUserGarageVehicles(userId)

    const vehicles = garageEntries.map((entry: any) => ({
      id: entry.id,
      nickname: entry.nickname,
      vin: entry.vin,
      license_plate: entry.license_plate,
      vehicle_id: entry.vehicle_id,
      vehicle_name: entry.vehicle ? 
        `${entry.vehicle.model?.make?.name || ''} ${entry.vehicle.model?.name || ''} ${entry.vehicle.name || ''}`.trim() : 
        'Unknown Vehicle',
      specs: entry.vehicle ? {
        kw: entry.vehicle.kw,
        hp: entry.vehicle.hp,
        fuel_type: entry.vehicle.fuel_type,
        body_style: entry.vehicle.body_style
      } : {},
      created_at: entry.created_at
    }))

    return res.json({ vehicles, count: vehicles.length })

  } catch (err) {
    const error = err as Error
    console.error("[User Garage GET] Error:", error.message)
    
    return res.status(500).json({ 
      message: "Failed to fetch garage",
      code: "GARAGE_FETCH_ERROR",
      ...(process.env.NODE_ENV === "development" && { error: error.message })
    })
  }
}

/**
 * POST /store/user-garage
 * 
 * Add vehicle to user's garage
 * MEDUSA V2 COMPLIANT - Uses automotive module service
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  setCors(res)
  
  const { user_id, vehicle_id, nickname, vin, license_plate } = req.body as {
    user_id: string
    vehicle_id: string
    nickname?: string
    vin?: string
    license_plate?: string
  }

  if (!user_id || !vehicle_id) {
    return res.status(400).json({ 
      message: "user_id and vehicle_id required",
      code: "MISSING_FIELDS"
    })
  }

  try {
    const automotiveService = req.scope.resolve("automotive") as any

    const garageEntry = await automotiveService.addVehicleToGarage({
      user_id,
      vehicle_id,
      nickname,
      vin,
      license_plate
    })

    return res.status(201).json({ 
      garage_entry: garageEntry,
      message: "Vehicle added to garage"
    })

  } catch (err) {
    const error = err as Error
    console.error("[User Garage POST] Error:", error.message)
    
    if (error.message === "Vehicle type not found") {
      return res.status(404).json({ 
        message: "Vehicle type not found",
        code: "VEHICLE_NOT_FOUND"
      })
    }

    return res.status(500).json({ 
      message: "Failed to add vehicle",
      code: "GARAGE_ADD_ERROR",
      ...(process.env.NODE_ENV === "development" && { error: error.message })
    })
  }
}

/**
 * DELETE /store/user-garage?id={id}&user_id={user_id}
 * 
 * MEDUSA V2 COMPLIANT - Uses automotive module service
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  setCors(res)
  
  const id = req.query.id as string
  const user_id = req.query.user_id as string

  if (!id || !user_id) {
    return res.status(400).json({ 
      message: "id and user_id required",
      code: "MISSING_FIELDS"
    })
  }

  try {
    const automotiveService = req.scope.resolve("automotive") as any

    await automotiveService.removeVehicleFromGarage(id, user_id)

    return res.json({ 
      success: true,
      message: "Vehicle removed from garage"
    })

  } catch (err) {
    const error = err as Error
    console.error("[User Garage DELETE] Error:", error.message)
    
    if (error.message === "Garage entry not found or access denied") {
      return res.status(404).json({ 
        message: "Garage entry not found",
        code: "GARAGE_NOT_FOUND"
      })
    }

    return res.status(500).json({ 
      message: "Failed to remove vehicle",
      code: "GARAGE_DELETE_ERROR",
      ...(process.env.NODE_ENV === "development" && { error: error.message })
    })
  }
}
