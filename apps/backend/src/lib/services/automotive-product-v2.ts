/**
 * AutomotiveProductServiceV2
 * 
 * MEDUSA V2 COMPLIANT - Uses Remote Query and Medusa modules exclusively.
 * No SQL fallbacks to legacy automotive.* schema.
 */
export default class AutomotiveProductServiceV2 {
  protected remoteQuery_: any;
  protected logger_: any;

  constructor(container: any) {
    this.remoteQuery_ = container.resolve("remoteQuery");
    this.logger_ = container.resolve("logger");
  }

  /**
   * Retrieve a product by variant ID using Remote Query
   */
  async retrieve(id: string) {
    // Query product via variant ID
    const productQuery = {
      entryPoint: "product",
      fields: [
        "id", "title", "handle", "description", "subtitle", "thumbnail", "metadata", "images.*",
        "variants.*", 
        // Brand from Product Collection
        "collection.*",
        // Pricing from Price Module
        "variants.price_set.prices.amount",
        "variants.price_set.prices.currency_code",
        // Inventory from Inventory Module
        "variants.inventory_items.inventory.location_levels.stocked_quantity", 
        "variants.inventory_items.inventory.location_levels.reserved_quantity",
        // Fitment from Automotive Module (linked via product-variant-fitment)
        "variants.fitment.*",
        "variants.fitment.vehicle.*",
        "variants.fitment.vehicle.model.*", 
        "variants.fitment.vehicle.model.make.*",
        // Categories
        "categories.*"
      ],
      variables: {
        filters: {
          variants: { id: id }
        }
      }
    };

    const products = await this.remoteQuery_(productQuery);
    if (!products || products.length === 0) return null;

    const product = products[0];
    const variant = product.variants.find((v: any) => v.id === id);
    if (!variant) return null;

    // Brand comes from collection (primary) or subtitle (fallback)
    // This matches the indexer which uses collection_title
    const brandName = product.collection?.title || product.subtitle || "Unknown";
    const brandSlug = (product.collection?.handle || brandName.toLowerCase().replace(/\s+/g, '-'));

    // Resolve Stock & Price from V2 Modules
    let price = 0;
    let currency_code = 'egp';
    let stock_quantity = 0;
    let in_stock = false;
    
    // Price Logic: Find price in EGP (or first available)
    if (variant.price_set?.prices) {
      const prices: any[] = variant.price_set.prices;
      const egpPrice = prices.find((p: any) => p.currency_code?.toLowerCase() === 'egp');
      const anyPrice = prices[0];
      
      if (egpPrice) {
        price = egpPrice.amount / 100; // Convert from cents
        currency_code = 'egp';
      } else if (anyPrice) {
        price = anyPrice.amount / 100;
        currency_code = anyPrice.currency_code;
      }
    }

    // Stock Logic: Sum all location levels
    if (variant.inventory_items && Array.isArray(variant.inventory_items)) {
      for (const linkItem of variant.inventory_items) {
        const levels = linkItem.inventory?.location_levels || linkItem.location_levels;
        if (levels && Array.isArray(levels)) {
          for (const level of levels) {
            stock_quantity += (level.stocked_quantity || 0) - (level.reserved_quantity || 0);
          }
        }
      }
    }
    
    if (stock_quantity > 0) in_stock = true;

    // Category from linked categories
    let categoryName = "General";
    let categorySlug = "general";
    if (product.categories && product.categories.length > 0) {
      categoryName = product.categories[0].name;
      categorySlug = product.categories[0].handle;
    }

    // Fitment/Vehicle info
    const fitments = variant.fitment || [];
    const vehicleInfo = fitments.map((f: any) => ({
      position: f.position,
      vehicle: f.vehicle ? {
        id: f.vehicle.id,
        name: f.vehicle.name,
        model: f.vehicle.model?.name,
        make: f.vehicle.model?.make?.name
      } : null
    }));

    // Assemble Result - Matches OpenSearch indexer fields exactly
    return {
      id: variant.id,
      sku: variant.sku,
      title: product.title,
      handle: product.handle,
      slug: product.handle,
      description: product.description,
      brand: brandName,
      brand_slug: brandSlug,
      quality_tier: "Economy", 
      category: categoryName,
      category_slug: categorySlug,
      mpn: variant.metadata?.mpn || product.metadata?.mpn || variant.sku, 
      ean: variant.ean || variant.barcode || product.metadata?.ean || null,
      tecdoc_article_no: product.metadata?.tecdoc_article_no,
      condition: "New", 
      // Check both product and variant metadata for is_universal (matches indexer)
      is_universal: product.metadata?.is_universal === true || variant.metadata?.is_universal === true, 
      price: price,
      currency_code: currency_code,
      in_stock: in_stock,
      stock_quantity: stock_quantity,
      // Read lead_time from metadata (matches indexer)
      lead_time_days: product.metadata?.lead_time_days || variant.metadata?.lead_time_days || 2,
      core_charge: null,
      superseded_by_sku: null,
      is_hazardous: false,
      dimensions: {
        weight_kg: variant.weight ? variant.weight / 1000 : null, // Convert g to kg
        length_cm: variant.length,
        width_cm: variant.width,
        height_cm: variant.height
      },
      image_url: product.thumbnail,
      images: product.images?.map((img: any) => img.url) || [],
      // Add vehicle_type_ids for consistency with ProductList
      vehicle_type_ids: fitments.map((f: any) => f.vehicle?.id).filter(Boolean),
      fitments: vehicleInfo,
      metadata: {
        ...product.metadata,
        // Unified specifications path (matches indexer)
        specifications: (() => {
          const rawSpecs = variant.metadata?.specifications || product.metadata?.specifications || {};
          const cleanSpecs = { ...rawSpecs };
          // Clean specifications (remove identifier-type attributes) - Matches opensearchSync.ts
          const bannedKeys = ['EAN', 'MPN', 'SKU', 'Year', 'Start Year', 'End Year', 'Make', 'Model', 'Type', 'Brand', 'Manufacturer Part Number'];
          bannedKeys.forEach(key => {
            delete cleanSpecs[key];
            Object.keys(cleanSpecs).forEach(k => {
              if (k.toLowerCase() === key.toLowerCase()) delete cleanSpecs[k];
            });
          });
          return cleanSpecs;
        })()
      }
    };
  }

  /**
   * Retrieve product by slug (handle) or ID
   */
  async retrieveBySlug(slug: string) {
    // Check if UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
    
    if (isUuid) {
      // Direct variant ID lookup
      return this.retrieve(slug);
    }

    // Handle lookup - find product by handle, get first variant
    let products = await this.remoteQuery_({
      entryPoint: "product",
      fields: ["id", "variants.id"],
      variables: { filters: { handle: slug }, take: 1 }
    });
    
    if (products && products.length > 0 && products[0].variants?.[0]?.id) {
      return this.retrieve(products[0].variants[0].id);
    }

    // 2. Try case-insensitive handle match (common browser/SEO issue)
    if (!products || products.length === 0) {
       products = await this.remoteQuery_({
          entryPoint: "product",
          fields: ["id", "variants.id"],
          variables: { filters: { handle: { $ilike: slug } }, take: 1 }
       });
    }

    // 3. Fallback: Check if slug is actually a PRODUCT ID (that failed UUID regex or is non-standard)
    // The "isUuid" check above is strict, but maybe ID is valid string but not UUID format?
    if (!products || products.length === 0) {
       products = await this.remoteQuery_({
          entryPoint: "product",
          fields: ["id", "variants.id"],
          variables: { filters: { id: slug }, take: 1 }
       });
    }

    if (products && products.length > 0 && products[0].variants?.[0]?.id) {
      return this.retrieve(products[0].variants[0].id);
    }
    
    // 4. Try to find variant by SKU pattern in handle
    const skuMatch = slug.match(/([A-Z]{2,5}-\d+)$/i);
    if (skuMatch) {
      const variantBySkuProducts = await this.remoteQuery_({
        entryPoint: "product",
        fields: ["id", "variants.id", "variants.sku"],
        variables: { 
          filters: { variants: { sku: { $like: `%${skuMatch[1]}%` } } },
          take: 1 
        }
      });
      
      if (variantBySkuProducts && variantBySkuProducts.length > 0) {
        const v = variantBySkuProducts[0].variants?.[0];
        if (v?.id) return this.retrieve(v.id);
      }
    }

    return null;
  }

  /**
   * Retrieve category attributes for filtering
   * Uses raw SQL to JOIN category_attribute (junction) with attribute table
   */
  async retrieveCategoryAttributes(slug: string) {
    // Find category by handle using Remote Query
    let categories = await this.remoteQuery_({
      entryPoint: "product_category",
      fields: ["id", "name", "handle"],
      variables: { filters: { handle: slug }, take: 1 }
    });

    // Try suffix match if not found
    if (!categories || categories.length === 0) {
      categories = await this.remoteQuery_({
        entryPoint: "product_category",
        fields: ["id", "name", "handle"],
        variables: { filters: { handle: { $like: `%${slug}` } }, take: 1 }
      });
    }

    if (!categories || categories.length === 0) return null;

    const category = categories[0];
    
    // Use raw SQL to JOIN category_attribute with attribute table
    // category_attribute is a junction table with attribute_id
    try {
      const { Client } = require('pg');
      const client = new Client({
        connectionString: process.env.DATABASE_URL || 'postgres://carspares:carspares@127.0.0.1:5433/carspares'
      });
      await client.connect();

      const result = await client.query(`
        SELECT 
          a.name,
          a.type as data_type,
          a.unit,
          a.is_filterable,
          a.code
        FROM category_attribute ca
        JOIN attribute a ON a.id = ca.attribute_id
        WHERE ca.category_id = $1 AND ca.deleted_at IS NULL AND a.deleted_at IS NULL
        ORDER BY ca.position ASC
      `, [category.id]);

      await client.end();

      // Filter to only filterable attributes
      const filterableAttributes = (result.rows || [])
        .filter((a: any) => a.is_filterable !== false)
        .map((a: any) => ({
          name: a.name,
          code: a.code,
          data_type: a.data_type,
          unit: a.unit
        }));

      return {
        category: category.name,
        attributes: filterableAttributes
      };
    } catch (err: any) {
      this.logger_?.error("Error querying category attributes:", err.message);
      return {
        category: category.name,
        attributes: []
      };
    }
  }

  /**
   * Retrieve vehicle types by manufacturer ID or slug
   * Uses raw SQL with correct table names: vehicle_manufacturer, vehicle_model, vehicle_type
   */
  async retrieveVehicleTypesByManufacturer(idOrSlug: string) {
    try {
      const { Client } = require('pg');
      const client = new Client({
        connectionString: process.env.DATABASE_URL || 'postgres://carspares:carspares@127.0.0.1:5433/carspares'
      });
      await client.connect();

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
      
      let manufacturerId = idOrSlug;
      
      // If not UUID, look up by slug or name
      if (!isUuid) {
        const manuLookup = await client.query(`
          SELECT id FROM vehicle_manufacturer 
          WHERE slug = $1 OR name ILIKE $1 OR name ILIKE $2
          LIMIT 1
        `, [idOrSlug, idOrSlug.replace(/-/g, ' ')]);
        
        if (manuLookup.rows.length === 0) {
          await client.end();
          return [];
        }
        manufacturerId = manuLookup.rows[0].id;
      }

      // Get all vehicle types for this manufacturer via model hierarchy
      const result = await client.query(`
        SELECT 
          vt.id,
          vt.name,
          vt.slug,
          vm.name as model_name,
          vman.name as manufacturer_name
        FROM vehicle_type vt
        JOIN vehicle_model vm ON vm.id = vt.model_id
        JOIN vehicle_manufacturer vman ON vman.id = vm.make_id
        WHERE vman.id = $1 AND vt.deleted_at IS NULL
        ORDER BY vm.name, vt.name
      `, [manufacturerId]);

      await client.end();
      return result.rows;
    } catch (err: any) {
      this.logger_?.error("Error querying vehicle types:", err.message);
      return [];
    }
  }

  /**
   * Used by Search Indexer - Returns document ready for OpenSearch
   */
  async retrieveForIndexing(id: string) {
    const product = await this.retrieve(id);
    if (!product) return null;

    return {
      id: product.id,
      title: product.title,
      sku: product.sku,
      mpn: product.mpn,
      ean: product.ean,
      brand: product.brand,
      description: product.description,
      specs: product.metadata?.specs || {},
      image_url: product.image_url,
      price: product.price,
      currency: product.currency_code,
      in_stock: product.in_stock,
      vehicle_ids: product.fitments?.map((f: any) => f.vehicle?.id).filter(Boolean) || []
    };
  }
}
