
import { ALLOWED_ORIGIN } from "../../../../../lib/clients";
import { logger } from "../../../../../lib/logger";

function setCors(res: any) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-publishable-api-key");
}

export async function OPTIONS(req: any, res: any) {
  setCors(res);
  res.sendStatus(200);
}

/**
 * GET /store/sku/:id/compatibility
 * 
 * V2 Standardization (Pure):
 * Uses Medusa Remote Query (V2) via 'fitment' entry point.
 * REQUIRES: Docker or Linux/WSL environment to function correctly with DML Modules.
 */
export async function GET(req: any, res: any) {
  setCors(res);
  const { id } = req.params;
  
  // Defensive check for remoteQuery availability
  let remoteQuery;
  try {
    remoteQuery = req.scope.resolve("remoteQuery");
  } catch (err: any) {
    logger.error('[Compatibility] Failed to resolve remoteQuery:', err.message);
    return res.status(503).json({ 
      message: "Service temporarily unavailable", 
      error: "Backend modules not fully loaded. Please restart the backend." 
    });
  }

  if (!remoteQuery) {
    return res.status(503).json({ 
      message: "Service temporarily unavailable", 
      error: "Remote query service not available" 
    });
  }

  if (!id) return res.status(400).json({ message: "Missing SKU ID" });

  logger.info(`[Compatibility] Checking fitment for SKU: ${id}`);

  try {
    // Query 1: Fitment Data - Critical
    let fitments: any[] = [];
    try {
        fitments = await remoteQuery({
            entryPoint: "fitment",
            fields: [
                "id", "fitting_position", "year_from", "year_to", "extra_criteria", "chassis_no_from", "chassis_no_to",
                "vehicle.id", "vehicle.name", "vehicle.tecdoc_k_type_id", "vehicle.kw", "vehicle.hp", "vehicle.fuel_type", "vehicle.body_style", "vehicle.engine_code", "vehicle.construction_year_start", "vehicle.construction_year_end",
                "vehicle.model.name", "vehicle.model.year_start", "vehicle.model.year_end",
                "vehicle.model.make.id", "vehicle.model.make.name"
            ],
            variables: { filters: { variant_id: id } }
        });
    } catch (e: any) {
        logger.error(`[Compatibility] Link Query Failed: ${e.message}`, e);
        throw new Error(`Fitment Query Failed: ${e.message}`);
    }

    // Query 2: Product Variant Data (for is_universal) - Safe Fallback
    let isUniversal = false;
    try {
        const variant = await remoteQuery({
            entryPoint: "product_variant",
            fields: ["product.metadata"],
            variables: { id: id }
        });
        isUniversal = variant?.[0]?.product?.metadata?.is_universal === true;
    } catch (e: any) {
        logger.warn(`[Compatibility] Variant metadata check failed: ${e.message}`);
        // Default to false, do not crash
    }

    const groupedByMake: Record<string, any> = {};
    const vehicleList: any[] = [];
    
    for (const f of fitments) {
         const vt = f.vehicle;
         if (!vt) continue;
         const mod = vt.model;
         if (!mod) continue;
         const mfr = mod.make;
         if (!mfr) continue;
         
         const makeKey = mfr.name;
         const modelKey = mod.name;
         
         if (!groupedByMake[makeKey]) groupedByMake[makeKey] = { manufacturer: makeKey, models: {} };
         if (!groupedByMake[makeKey].models[modelKey]) groupedByMake[makeKey].models[modelKey] = { name: modelKey, year_range: `${mod.year_start || '?'}-${mod.year_end || 'present'}`, types: [] };
         
         groupedByMake[makeKey].models[modelKey].types.push({
            id: vt.id, name: vt.name, ktype_id: vt.tecdoc_k_type_id,
            year_range: `${vt.construction_year_start || '?'}-${vt.construction_year_end || 'present'}`,
            power: vt.kw ? `${vt.kw}kW / ${vt.hp || '?'}HP` : null,
            fuel_type: vt.fuel_type, body_style: vt.body_style, engine_code: vt.engine_code,
            fitting_position: f.fitting_position,
            restrictions: f.chassis_no_from || f.year_from ? { chassis_from: f.chassis_no_from, chassis_to: f.chassis_no_to, year_from: f.year_from, year_to: f.year_to } : null
         });

         vehicleList.push({
            id: vt.id, make: makeKey, make_id: mfr.id, model: modelKey, type: vt.name,
            year_range: `${vt.construction_year_start || '?'}-${vt.construction_year_end || 'present'}`,
            details: `${vt.fuel_type || ''} ${vt.kw ? vt.kw + 'kW' : ''} ${vt.engine_code || ''}`.trim(),
            engine_code: vt.engine_code, body_type: vt.body_style, position: f.fitting_position,
            description: `${makeKey} ${modelKey} ${vt.construction_year_start || ''}-${vt.construction_year_end || ''} (${vt.fuel_type || ''})`
         });
    }
    
    const manufacturers = Object.values(groupedByMake).map((make: any) => ({ manufacturer: make.manufacturer, models: Object.values(make.models) }));
    manufacturers.sort((a: any, b: any) => a.manufacturer.localeCompare(b.manufacturer));
    vehicleList.sort((a: any, b: any) => a.make.localeCompare(b.make));

    return res.json({ sku_id: id, is_universal: isUniversal, count: fitments.length, manufacturers, vehicles: vehicleList });

  } catch (err: any) {
    logger.error('[V2] Remote Query failed for Compatibility', err);
    return res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
}
