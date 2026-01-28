
import { ALLOWED_ORIGIN } from "../../../lib/clients";
import { validateVehicleQuery } from "../../../lib/validators";
import { checkRateLimit } from "../../../lib/rateLimit";
import { logger } from "../../../lib/logger";

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
 * GET /store/vehicles
 * 
 * V2 Standardization (Pure):
 * Uses Medusa Remote Query (V2) exclusively.
 * REQUIRES: Docker or Linux/WSL environment to function correctly with DML Modules.
 */
export async function GET(req: any, res: any) {
  setCors(res);
  
  // Security: Rate Limiting
  try {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      const { success, limit, remaining, reset } = await checkRateLimit(ip, 60, 60);
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', reset);
      if (!success) return res.status(429).json({ message: "Too many requests" });
  } catch (err: any) {
      logger.error('[RateLimit Error]:', err);
  }

  const { manufacturer, model, manufacturer_slug, model_slug, type_slug, resolve_slugs } = req.query;
  const remoteQuery = req.scope.resolve("remoteQuery");

  // Validation
  try {
      const validation = validateVehicleQuery(req.query);
      if (!validation.valid) return res.status(400).json({ message: validation.error });
  } catch (err: any) {
      logger.error('[Validation Error]:', err);
      return res.status(500).json({ message: "Internal Validation Error" }); 
  }

  try {
    if (resolve_slugs === 'true') {
        const response: any = {};
        if (manufacturer_slug) {
            const mfrs = await remoteQuery({
                entryPoint: "vehicle_manufacturer",
                fields: ["id", "name", "slug"],
                variables: { filters: { slug: manufacturer_slug }, take: 1 }
            });
            if (mfrs?.[0]) response.manufacturer = mfrs[0];
        }
        if (model_slug) {
            const mods = await remoteQuery({
                entryPoint: "vehicle_model",
                fields: ["id", "name", "slug", "make.id", "make.name", "make.slug"],
                variables: { filters: { slug: model_slug }, take: 1 }
            });
            if (mods?.[0]) {
                 response.model = { id: mods[0].id, name: mods[0].name, slug: mods[0].slug };
                 if (!response.manufacturer && mods[0].make) response.manufacturer = mods[0].make;
            }
        }
        if (type_slug) {
            const typs = await remoteQuery({
                 entryPoint: "vehicle_type",
                 fields: [ "id", "name", "slug", "year_from", "year_to", "model.id", "model.name", "model.slug", "model.make.id", "model.make.name", "model.make.slug" ],
                 variables: { filters: { slug: type_slug }, take: 1 }
            });
             if (typs?.[0]) {
                 response.type = { id: typs[0].id, name: typs[0].name, slug: typs[0].slug, year_from: typs[0].year_from, year_to: typs[0].year_to };
                 if (!response.model && typs[0].model) response.model = { id: typs[0].model.id, name: typs[0].model.name, slug: typs[0].model.slug };
                 if (!response.manufacturer && typs[0].model?.make) response.manufacturer = typs[0].model.make;
            }
        }
        if (Object.keys(response).length === 0) return res.status(404).json({ message: "Vehicle not found" });
        return res.json(response);
    }

    if (model || model_slug) {
      let modelId = model;
      if (!modelId && model_slug) {
         const mRes = await remoteQuery({
             entryPoint: "vehicle_model",
             fields: ["id"],
             variables: { filters: { slug: model_slug }, take: 1 }
         });
         if (!mRes || mRes.length === 0) return res.json({ types: [] });
         modelId = mRes[0].id;
      }
      const types = await remoteQuery({
        entryPoint: "vehicle_type",
        fields: [ "id", "name", "slug", "power_kw", "power_hp", "fuel_type", "engine_displacement", "year_from", "year_to" ],
        variables: { filters: { model_id: modelId }, order: { year_from: "DESC", name: "ASC" } }
      });
      return res.json({ types: types.map((r: any) => ({
        id: r.id, name: r.name, slug: r.slug,
        display_name: `${r.year_from || '?'}-${r.year_to || 'present'} ${r.name} ${r.fuel_type || ''} (${r.power_kw || '?'}kW)`.trim(),
        specs: { kw: r.power_kw, hp: r.power_hp, fuel_type: r.fuel_type, engine_displacement: r.engine_displacement }
      }))});
    }

    if (manufacturer || manufacturer_slug) {
      let mfrId = manufacturer;
      if (!mfrId && manufacturer_slug) {
         const mRes = await remoteQuery({ entryPoint: "vehicle_manufacturer", fields: ["id"], variables: { filters: { slug: manufacturer_slug }, take: 1 } });
         if (!mRes || mRes.length === 0) return res.json({ models: [] });
         mfrId = mRes[0].id;
      }
      const models = await remoteQuery({
          entryPoint: "vehicle_model",
          fields: ["id", "name", "slug"],
          variables: { filters: { make_id: mfrId }, order: { name: "ASC" } }
      });
      return res.json({ models: models.map((r: any) => ({
        id: r.id, name: r.name, slug: r.slug,
        display_name: r.name
      }))});
    }

    // Default: List Manufacturers
    const mfrs = await remoteQuery({
        entryPoint: "vehicle_manufacturer",
        fields: ["id", "name", "slug"],
        variables: { order: { name: "ASC" } }
    });
    return res.json({ manufacturers: mfrs.map((r: any) => ({ id: r.id, name: r.name, slug: r.slug })) });

  } catch (err: any) {
    logger.error('[V2] Remote Query failed', err);
    return res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
}
