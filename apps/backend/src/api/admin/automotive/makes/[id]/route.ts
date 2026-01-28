/**
 * Admin API - Vehicle Makes Individual CRUD
 * 
 * Provides admin endpoints for updating and deleting individual makes.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

// GET /admin/automotive/makes/:id - Get single make
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const automotiveService = req.scope.resolve("automotive");
    const { id } = req.params;
    
    const makes = await automotiveService.listVehicleManufacturers(
      { id },
      { 
        select: ["id", "name", "slug", "logo_url", "country", "created_at", "updated_at"],
        take: 1 
      }
    );
    
    if (!makes.length) {
      return res.status(404).json({ error: "Make not found" });
    }
    
    res.json({ make: makes[0] });
  } catch (error) {
    console.error("[Admin] Get make error:", error);
    res.status(500).json({ 
      error: "Failed to get make",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// PUT /admin/automotive/makes/:id - Update make
export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  try {
    const automotiveService = req.scope.resolve("automotive");
    const { id } = req.params;
    
    const { name, slug, logo_url, country } = req.body as {
      name?: string;
      slug?: string;
      logo_url?: string;
      country?: string;
    };
    
    // Check if exists
    const existing = await automotiveService.listVehicleManufacturers({ id }, { take: 1 });
    if (!existing.length) {
      return res.status(404).json({ error: "Make not found" });
    }
    
    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (logo_url !== undefined) updateData.logo_url = logo_url;
    if (country !== undefined) updateData.country = country;
    
    const updated = await automotiveService.updateVehicleManufacturers(id, updateData);
    
    res.json({ make: updated });
  } catch (error) {
    console.error("[Admin] Update make error:", error);
    res.status(500).json({ 
      error: "Failed to update make",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// DELETE /admin/automotive/makes/:id - Delete make
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  try {
    const automotiveService = req.scope.resolve("automotive");
    const { id } = req.params;
    
    // Check if exists
    const existing = await automotiveService.listVehicleManufacturers({ id }, { take: 1 });
    if (!existing.length) {
      return res.status(404).json({ error: "Make not found" });
    }
    
    // Check for related models
    const models = await automotiveService.listVehicleModels({ make_id: id }, { take: 1 });
    if (models.length > 0) {
      return res.status(409).json({ 
        error: "Cannot delete make with existing models",
        hint: "Delete all models for this make first"
      });
    }
    
    await automotiveService.deleteVehicleManufacturers(id);
    
    res.json({ success: true, id });
  } catch (error) {
    console.error("[Admin] Delete make error:", error);
    res.status(500).json({ 
      error: "Failed to delete make",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
