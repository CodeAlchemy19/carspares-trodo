// import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import AutomotiveProductServiceV2 from "../../../../../../lib/services/automotive-product-v2";

export async function GET(
  req: any,
  res: any
) {
  const { id } = req.params; // Next.js dynamic param [id]
  
  if (!id) {
      return res.status(400).json({ message: "Manufacturer ID or Slug is required" });
  }

  const service = new AutomotiveProductServiceV2(req.scope);
  
  try {
      const types = await service.retrieveVehicleTypesByManufacturer(id);
      
      // If none found, return empty array (Search API expects objects with id property)
      return res.json({ types: types.map((t: any) => ({ id: t.id })) }); 
  } catch (err: any) {
      console.error("[API] Error fetching vehicle types:", err);
      return res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
}

export async function OPTIONS(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", process.env.STORE_CORS || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return res.sendStatus(200);
}
