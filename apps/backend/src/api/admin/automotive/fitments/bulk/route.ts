/**
 * Admin API - Bulk Fitment Import
 * 
 * Provides endpoint for bulk importing fitments from CSV/JSON.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

// POST /admin/automotive/fitments/bulk - Bulk create fitments
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const automotiveService = req.scope.resolve("automotive");
    
    const { fitments, skip_duplicates = true } = req.body as {
      fitments: Array<{
        variant_id: string;
        vehicle_id: string;
        position?: string;
        notes?: string;
      }>;
      skip_duplicates?: boolean;
    };
    
    if (!fitments || !Array.isArray(fitments)) {
      return res.status(400).json({ error: "fitments array is required" });
    }
    
    if (fitments.length > 1000) {
      return res.status(400).json({ error: "Maximum 1000 fitments per batch" });
    }
    
    const results = {
      created: 0,
      skipped: 0,
      errors: [] as Array<{ index: number; error: string }>,
    };
    
    for (let i = 0; i < fitments.length; i++) {
      const { variant_id, vehicle_id, position, notes } = fitments[i];
      
      if (!variant_id || !vehicle_id) {
        results.errors.push({ index: i, error: "variant_id and vehicle_id are required" });
        continue;
      }
      
      try {
        // Check for duplicate
        const existing = await automotiveService.listFitments(
          { variant_id, vehicle_id },
          { take: 1 }
        );
        
        if (existing.length > 0) {
          if (skip_duplicates) {
            results.skipped++;
            continue;
          } else {
            results.errors.push({ index: i, error: "Duplicate fitment" });
            continue;
          }
        }
        
        await automotiveService.createFitments({
          id: `fit_${Date.now()}_${i}`,
          variant_id,
          vehicle_id,
          position: position || null,
          notes: notes || null,
        });
        
        results.created++;
      } catch (err) {
        results.errors.push({ 
          index: i, 
          error: err instanceof Error ? err.message : "Unknown error" 
        });
      }
    }
    
    res.json({
      success: true,
      results,
      summary: `Created ${results.created}, skipped ${results.skipped}, errors ${results.errors.length}`,
    });
  } catch (error) {
    console.error("[Admin] Bulk create fitments error:", error);
    res.status(500).json({ 
      error: "Failed to bulk create fitments",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
