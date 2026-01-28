/**
 * POST /store/checkout
 * 
 * @deprecated This endpoint is DEPRECATED. Use the Medusa JS SDK instead:
 * - sdk.store.cart.update(cartId, { email, shipping_address, billing_address })
 * - sdk.store.cart.complete(cartId)
 * 
 * The frontend has been migrated to use the SDK pattern which triggers
 * proper Medusa workflows for payment, inventory, and order creation.
 * 
 * This route is kept for backwards compatibility but should not be used
 * for new integrations.
 * 
 * MEDUSA V2 COMPLIANT CHECKOUT (Legacy)
 * Flow:
 * 1. Retrieve & Update Cart (Cart Module)
 * 2. Validate Inventory (Inventory Module)
 * 3. Create Order (Order Module)
 */

import { Modules } from "@medusajs/framework/utils";
import { ALLOWED_ORIGIN } from "../../../lib/clients";
import { handleApiError, insufficientStockError, notFoundError, validationError } from "../../../lib/errorHandler";
import { validateCheckoutBody } from "../../../lib/validators";
import { v4 as uuidv4 } from "uuid";

function setCors(res: any) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-publishable-api-key, x-cart-id");
}

export async function OPTIONS(req: any, res: any) {
  setCors(res);
  res.sendStatus(200);
}

export async function POST(req: any, res: any) {
  setCors(res);
  const cartId = req.headers['x-cart-id'];

  try {
    // 1. Validate Input
    const validation = validateCheckoutBody(req.body);
    if (!validation.valid) {
      throw validationError(validation.error || 'Invalid input');
    }
    const { email, shipping_address, billing_address } = validation.value!;

    if (!cartId) {
      return res.status(400).json({ message: "Cart ID (x-cart-id) required" });
    }

    const container = req.scope;
    const remoteQuery = container.resolve("remoteQuery");
    
    // Resolve Modules
    const cartModule = container.resolve(Modules.CART);
    const orderModule = container.resolve(Modules.ORDER);
    const inventoryModule = container.resolve(Modules.INVENTORY);

    // 2. Retrieve Cart
    const cartQuery = {
      entryPoint: "cart",
      fields: [
        "id", 
        "currency_code", 
        "email", 
        "total",
        "items.*",
        "items.variant.*",
        "shipping_address.*",
        "billing_address.*"
      ],
      variables: { filters: { id: cartId } }
    };
    
    const [cart] = await remoteQuery(cartQuery);
    
    if (!cart) {
      throw notFoundError("Cart not found");
    }

    if (cart.completed_at) {
      // Check if order exists (via remote query on order)
      const [existingOrder] = await remoteQuery({
        entryPoint: "order",
        fields: ["id"],
        variables: { filters: { cart_id: cartId } }
      });
      
      if (existingOrder) {
        return res.status(200).json({ 
          success: true, 
          order_id: existingOrder.id,
          message: "Order already placed" 
        });
      }
    }

    // 3. Update Cart with Email & Addresses
    await cartModule.updateCarts(cartId, {
      email,
      shipping_address: {
        first_name: shipping_address.first_name,
        last_name: shipping_address.last_name,
        address_1: shipping_address.address_1,
        city: shipping_address.city,
        country_code: "eg", // Force EG
        phone: shipping_address.phone,
        province: shipping_address.province
      },
      billing_address: {
        first_name: billing_address.first_name,
        last_name: billing_address.last_name,
        address_1: billing_address.address_1,
        city: billing_address.city,
        country_code: "eg",
        phone: billing_address.phone
      }
    });

    // 4. Validate Inventory
    const items = cart.items || [];
    for (const item of items) {
      if (!item.variant_id) continue;

      // Check inventory via Remote Query (join inventory_items)
      // Since direct inventory check via module can be complex without location_id,
      // we check the view we migrated.
      
      const stockQuery = {
        entryPoint: "inventory_level",
        fields: ["stocked_quantity", "reserved_quantity"],
        variables: { 
          filters: { 
            inventory_item: { 
              variant_link: { variant_id: item.variant_id } 
            } 
          }
        }
      };
      
      const stockLevels = await remoteQuery(stockQuery);
      
      let totalAvailable = 0;
      for (const level of stockLevels) {
        totalAvailable += (level.stocked_quantity || 0) - (level.reserved_quantity || 0);
      }

      if (totalAvailable < item.quantity) {
        throw insufficientStockError(`Item ${item.title} is out of stock. Available: ${totalAvailable}`);
      }
    }

    // 5. Reserve Inventory (Simplified: We just assume success if check passed, 
    // real reservation requires creating ReservationItems via InventoryModule)
    // For now, let's create the Order which is the source of truth in V2.
    // Medusa Order Module doesn't auto-reserve inventory unless using workflows.
    // We will manually reserve if possible, or leave it to standard flow.
    // Since we want "Cash on Delivery", we proceed to Order Creation.

    // 6. Create Order
    // Calculate total (simple sum for now, Medusa handles taxes if region set)
    const subtotal = items.reduce((acc: number, item: any) => acc + (item.unit_price * item.quantity), 0);
    
    const order = await orderModule.createOrders({
      region_id: cart.region_id || "reg_eg",
      customer_id: cart.customer_id || null,
      email: email,
      currency_code: "egp",
      items: items.map((item: any) => ({
        title: item.title,
        quantity: item.quantity,
        unit_price: item.unit_price,
        variant_id: item.variant_id,
        product_id: item.variant?.product_id,
        thumbnail: item.thumbnail
      })),
      shipping_address: shipping_address,
      billing_address: billing_address,
      sales_channel_id: cart.sales_channel_id || "sc_01KEQPBZQ66AVNBFK8E84M3W70", // Default
      promo_codes: [],
      metadata: { cart_id: cartId } // Link back to cart
    });

    // 7. Mark Cart Complete (Optional but good practice)
    // cartModule.complete() might not exist directly, usually done via workflow.
    // We can update metadata or just leave it.

    return res.status(201).json({ 
      success: true, 
      order_id: order.id,
      message: "Order placed successfully" 
    });

  } catch (err) {
    return handleApiError(res, err, "Checkout process");
  }
}
