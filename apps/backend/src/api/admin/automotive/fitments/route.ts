/**
 * Admin API - Fitments CRUD
 * 
 * Provides admin endpoints for managing product-vehicle compatibility.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

// GET /admin/automotive/fitments - List fitments
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const automotiveService = req.scope.resolve("automotive");
    
    const { variant_id, vehicle_id, limit = 100, offset = 0 } = req.query as {
      variant_id?: string;
      vehicle_id?: string;
      limit?: number;
      offset?: number;
    };
    
    const filters: any = {};
    if (variant_id) filters.variant_id = variant_id;
    if (vehicle_id) filters.vehicle_id = vehicle_id;
    
    const fitments = await automotiveService.listFitments(
      filters,
      {
        select: ["id", "variant_id", "vehicle_id", "position", "notes", "created_at"],
        relations: ["vehicle", "vehicle.model", "vehicle.model.make"],
        order: { created_at: "DESC" },
        take: Number(limit),
        skip: Number(offset),
      }
    );
    
    res.json({
      fitments,
      count: fitments.length,
      offset: Number(offset),
      limit: Number(limit),
    });
  } catch (error) {
    console.error("[Admin] List fitments error:", error);
    res.status(500).json({ 
      error: "Failed to list fitments",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// POST /admin/automotive/fitments - Create a fitment
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const automotiveService = req.scope.resolve("automotive");
    
    const { variant_id, vehicle_id, position, notes } = req.body as {
      variant_id: string;
      vehicle_id: string;
      position?: string;
      notes?: string;
    };
    
    if (!variant_id || !vehicle_id) {
      return res.status(400).json({ error: "variant_id and vehicle_id are required" });
    }
    
    // Check for duplicate
    const existing = await automotiveService.listFitments(
      { variant_id, vehicle_id },
      { take: 1 }
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: "Fitment already exists for this variant and vehicle" });
    }
    
    const fitment = await automotiveService.createFitments({
      id: `fit_${Date.now()}`,
      variant_id,
      vehicle_id,
      position: position || null,
      notes: notes || null,
    });
    
    res.status(201).json({ fitment });
  } catch (error) {
    console.error("[Admin] Create fitment error:", error);
    res.status(500).json({ 
      error: "Failed to create fitment",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
