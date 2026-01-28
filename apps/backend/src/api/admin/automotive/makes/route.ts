/**
 * Admin API - Vehicle Makes CRUD
 * 
 * Provides admin endpoints for managing vehicle manufacturers.
 * Requires admin authentication.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";

// GET /admin/automotive/makes - List all makes
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const automotiveService = req.scope.resolve("automotive");
    
    // Parse query params
    const { search, limit = 50, offset = 0 } = req.query as {
      search?: string;
      limit?: number;
      offset?: number;
    };
    
    // Build filters
    const filters: any = {};
    if (search) {
      filters.name = { $like: `%${search}%` };
    }
    
    const makes = await automotiveService.listVehicleManufacturers(
      filters,
      {
        select: ["id", "name", "slug", "logo_url", "country", "created_at"],
        order: { name: "ASC" },
        take: Number(limit),
        skip: Number(offset),
      }
    );
    
    // Get total count
    const [allMakes] = await automotiveService.listAndCountVehicleManufacturers(filters, { take: 1 });
    
    res.json({
      makes,
      count: makes.length,
      offset: Number(offset),
      limit: Number(limit),
    });
  } catch (error) {
    console.error("[Admin] List makes error:", error);
    res.status(500).json({ 
      error: "Failed to list makes",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// POST /admin/automotive/makes - Create a new make
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const automotiveService = req.scope.resolve("automotive");
    
    const { name, slug, logo_url, country } = req.body as {
      name: string;
      slug?: string;
      logo_url?: string;
      country?: string;
    };
    
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    
    // Generate slug if not provided
    const makeSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // Check for duplicate
    const existing = await automotiveService.listVehicleManufacturers({ slug: makeSlug }, { take: 1 });
    if (existing.length > 0) {
      return res.status(409).json({ error: "Make with this slug already exists" });
    }
    
    const make = await automotiveService.createVehicleManufacturers({
      id: `vmake_${Date.now()}`,
      name,
      slug: makeSlug,
      logo_url: logo_url || null,
      country: country || null,
    });
    
    res.status(201).json({ make });
  } catch (error) {
    console.error("[Admin] Create make error:", error);
    res.status(500).json({ 
      error: "Failed to create make",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
