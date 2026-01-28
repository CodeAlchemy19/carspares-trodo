// import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import AutomotiveProductServiceV2 from "../../../../../../lib/services/automotive-product-v2";

export async function GET(
  req: any,
  res: any
) {
  const { slug } = req.params;
  
  if (!slug) {
      return res.status(400).json({ message: "Slug is required" });
  }

  const service = new AutomotiveProductServiceV2(req.scope);
  
  try {
      const result = await service.retrieveCategoryAttributes(slug);
      
      if (!result) {
          return res.status(404).json({ error: "Category not found", slug_searched: slug });
      }
      
      return res.json(result);
  } catch (err: any) {
      console.error("[API] Error fetching category attributes:", err);
      return res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
}

export async function OPTIONS(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", process.env.STORE_CORS || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return res.sendStatus(200);
}
