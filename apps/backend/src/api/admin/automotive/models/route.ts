/**
 * Admin API - Vehicle Models CRUD
 * 
 * Provides admin endpoints for managing vehicle models.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

// GET /admin/automotive/models - List all models
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const automotiveService = req.scope.resolve("automotive");
    
    const { search, make_id, limit = 50, offset = 0 } = req.query as {
      search?: string;
      make_id?: string;
      limit?: number;
      offset?: number;
    };
    
    const filters: any = {};
    if (search) {
      filters.name = { $like: `%${search}%` };
    }
    if (make_id) {
      filters.make_id = make_id;
    }
    
    const models = await automotiveService.listVehicleModels(
      filters,
      {
        select: ["id", "name", "slug", "make_id", "created_at"],
        relations: ["make"],
        order: { name: "ASC" },
        take: Number(limit),
        skip: Number(offset),
      }
    );
    
    res.json({
      models,
      count: models.length,
      offset: Number(offset),
      limit: Number(limit),
    });
  } catch (error) {
    console.error("[Admin] List models error:", error);
    res.status(500).json({ 
      error: "Failed to list models",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// POST /admin/automotive/models - Create a new model
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const automotiveService = req.scope.resolve("automotive");
    
    const { name, slug, make_id } = req.body as {
      name: string;
      slug?: string;
      make_id: string;
    };
    
    if (!name || !make_id) {
      return res.status(400).json({ error: "Name and make_id are required" });
    }
    
    // Verify make exists
    const makes = await automotiveService.listVehicleManufacturers({ id: make_id }, { take: 1 });
    if (!makes.length) {
      return res.status(404).json({ error: "Make not found" });
    }
    
    const modelSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    const model = await automotiveService.createVehicleModels({
      id: `vmodel_${Date.now()}`,
      name,
      slug: modelSlug,
      make_id,
    });
    
    res.status(201).json({ model });
  } catch (error) {
    console.error("[Admin] Create model error:", error);
    res.status(500).json({ 
      error: "Failed to create model",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
