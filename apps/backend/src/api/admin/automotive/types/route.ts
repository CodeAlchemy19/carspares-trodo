/**
 * Admin API - Vehicle Types CRUD
 * 
 * Provides admin endpoints for managing vehicle types (year/engine variants).
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

// GET /admin/automotive/types - List all vehicle types
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const automotiveService = req.scope.resolve("automotive");
    
    const { search, model_id, make_id, year, limit = 50, offset = 0 } = req.query as {
      search?: string;
      model_id?: string;
      make_id?: string;
      year?: string;
      limit?: number;
      offset?: number;
    };
    
    const filters: any = {};
    if (search) {
      filters.name = { $like: `%${search}%` };
    }
    if (model_id) {
      filters.model_id = model_id;
    }
    
    const types = await automotiveService.listVehicleTypes(
      filters,
      {
        select: ["id", "name", "slug", "model_id", "year_from", "year_to", "fuel_type", "engine", "body_type", "created_at"],
        relations: ["model", "model.make"],
        order: { year_from: "DESC", name: "ASC" },
        take: Number(limit),
        skip: Number(offset),
      }
    );
    
    // Filter by year if provided (post-query filter for range)
    let filteredTypes = types;
    if (year) {
      const targetYear = parseInt(year);
      filteredTypes = types.filter((t: any) => 
        t.year_from <= targetYear && (!t.year_to || t.year_to >= targetYear)
      );
    }
    
    res.json({
      types: filteredTypes,
      count: filteredTypes.length,
      offset: Number(offset),
      limit: Number(limit),
    });
  } catch (error) {
    console.error("[Admin] List types error:", error);
    res.status(500).json({ 
      error: "Failed to list types",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// POST /admin/automotive/types - Create a new vehicle type
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const automotiveService = req.scope.resolve("automotive");
    
    const { 
      name, 
      slug, 
      model_id, 
      year_from, 
      year_to, 
      fuel_type, 
      engine, 
      body_type,
      ktype_id 
    } = req.body as {
      name: string;
      slug?: string;
      model_id: string;
      year_from: number;
      year_to?: number;
      fuel_type?: string;
      engine?: string;
      body_type?: string;
      ktype_id?: string;
    };
    
    if (!name || !model_id || !year_from) {
      return res.status(400).json({ error: "Name, model_id, and year_from are required" });
    }
    
    // Verify model exists
    const models = await automotiveService.listVehicleModels({ id: model_id }, { take: 1 });
    if (!models.length) {
      return res.status(404).json({ error: "Model not found" });
    }
    
    const typeSlug = slug || `${name}-${year_from}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    const type = await automotiveService.createVehicleTypes({
      id: `vtype_${Date.now()}`,
      name,
      slug: typeSlug,
      model_id,
      year_from,
      year_to: year_to || null,
      fuel_type: fuel_type || null,
      engine: engine || null,
      body_type: body_type || null,
      ktype_id: ktype_id || null,
    });
    
    res.status(201).json({ type });
  } catch (error) {
    console.error("[Admin] Create type error:", error);
    res.status(500).json({ 
      error: "Failed to create type",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
