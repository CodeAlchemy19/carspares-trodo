import { ALLOWED_ORIGIN } from "../../../../lib/clients";
import { withCache } from "../../../../lib/cache";
import { logger } from "../../../../lib/logger";

/* CORS Helper */
function setCors(res: any) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-publishable-api-key");
}

export async function OPTIONS(req: any, res: any) {
  setCors(res);
  res.sendStatus(200);
}

/* 
 * GET /store/categories/tree
 * Returns the full category hierarchy using Medusa v2 Remote Query.
 * Cached for 30 minutes via Redis.
 * 
 * MEDUSA V2 COMPLIANT - Uses Remote Query instead of raw SQL
 */
export async function GET(req: any, res: any) {
  setCors(res);

  try {
    const remoteQuery = req.scope.resolve("remoteQuery");

    // 1. Use Redis Cache Wrapper (Key: carspares:categories:full_tree)
    const tree = await withCache('categories', 'full_tree', async () => {
      
      // 2. Fetch All Categories via Remote Query
      // Medusa v2 Product Category module uses "product_category" entry point
      const categories = await remoteQuery({
        entryPoint: "product_category",
        fields: [
          "id",
          "name", 
          "handle",
          "parent_category_id",
          "category_children.id",
          "category_children.name",
          "category_children.handle",
          "metadata"
        ],
        variables: {
          filters: {},
          order: { name: "ASC" }
        }
      });

      // 3. Transform to expected format and build tree
      const map = new Map();
      const roots: any[] = [];

      // Pass 1: Initialize map with normalized data
      categories.forEach((cat: any) => {
        map.set(cat.id, {
          id: cat.id,
          name: cat.name,
          slug: cat.handle, // Medusa uses "handle" instead of "slug"
          parent_id: cat.parent_category_id,
          image_url: cat.metadata?.image_url || null,
          popularity_score: cat.metadata?.popularity_score || 0,
          children: []
        });
      });

      // Pass 2: Link parents
      categories.forEach((cat: any) => {
        const node = map.get(cat.id);
        if (cat.parent_category_id && map.has(cat.parent_category_id)) {
          map.get(cat.parent_category_id).children.push(node);
        } else {
          roots.push(node);
        }
      });

      // Sort by popularity_score descending, then name ascending
      const sortNodes = (nodes: any[]) => {
        nodes.sort((a, b) => (b.popularity_score || 0) - (a.popularity_score || 0) || a.name.localeCompare(b.name));
        nodes.forEach(node => {
          if (node.children?.length > 0) sortNodes(node.children);
        });
      };
      sortNodes(roots);

      return roots;
    });

    // 4. Return
    return res.status(200).json({ categories: tree });

  } catch (err: any) {
    logger.error('Category Tree Error:', err);
    return res.status(500).json({ message: "Failed to load categories" });
  }
}
