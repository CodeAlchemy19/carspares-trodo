/**
 * Input Validation Utilities
 * 
 * Provides validation functions for API inputs to prevent
 * malformed data and potential security issues.
 */

// Common regex patterns
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ValidationResult<T = any> {
  valid: boolean;
  error?: string;
  value?: T;
}

/**
 * Validate UUID format
 */
export function validateUUID(id: any): ValidationResult {
  if (!id) {
    return { valid: false, error: 'ID is required' };
  }
  if (typeof id !== 'string') {
    return { valid: false, error: 'ID must be a string' };
  }
  if (!UUID_REGEX.test(id)) {
    return { valid: false, error: 'Invalid ID format' };
  }
  return { valid: true };
}

/**
 * Validate email format
 */
export function validateEmail(email: any): ValidationResult<string> {
  if (!email) {
    return { valid: false, error: 'Email is required' };
  }
  if (typeof email !== 'string') {
    return { valid: false, error: 'Email must be a string' };
  }
  const trimmed = email.trim();
  if (trimmed.length > 254) {
    return { valid: false, error: 'Email is too long' };
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' };
  }
  return { valid: true, value: trimmed };
}

/**
 * Validate positive integer
 */
export function validatePositiveInteger(value: any, fieldName = 'Value', min = 1, max = 9999): ValidationResult<number> {
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    return { valid: false, error: `${fieldName} must be a number` };
  }
  if (num < min) {
    return { valid: false, error: `${fieldName} must be at least ${min}` };
  }
  if (num > max) {
    return { valid: false, error: `${fieldName} cannot exceed ${max}` };
  }
  return { valid: true, value: num };
}

/**
 * Validate shipping/billing address
 */
export function validateAddress(address: any): ValidationResult<any> {
  if (!address || typeof address !== 'object') {
    return { valid: false, error: 'Address is required' };
  }

  const required = ['first_name', 'last_name', 'address_1', 'city', 'country_code'];
  const missing = required.filter(field => !address[field]);
  
  if (missing.length > 0) {
    return { 
      valid: false, 
      error: `Missing required address fields: ${missing.join(', ')}` 
    };
  }

  // Sanitize address fields (trim strings, limit length)
  const sanitized: any = {};
  const stringFields = [
    'first_name', 'last_name', 'company', 'address_1', 'address_2',
    'city', 'province', 'postal_code', 'country_code', 'phone'
  ];

  for (const field of stringFields) {
    if (address[field] !== undefined && address[field] !== null) {
      const val = String(address[field]).trim().slice(0, 255);
      if (val) sanitized[field] = val;
    }
  }

  // Validate country code format (2 letter ISO)
  if (sanitized.country_code && !/^[A-Z]{2}$/i.test(sanitized.country_code)) {
    return { valid: false, error: 'Invalid country code format (use 2-letter ISO code)' };
  }
  
  // Normalize country code to uppercase
  if (sanitized.country_code) {
    sanitized.country_code = sanitized.country_code.toUpperCase();
  }

  return { valid: true, value: sanitized };
}

/**
 * Validate cart add/update request body
 */
export function validateCartBody(body: any): ValidationResult<any> {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const result: any = { cart_id: null, variant_id: null, quantity: 1 };

  // Validate cart_id if provided
  if (body.cart_id) {
    const cartValidation = validateUUID(body.cart_id);
    if (!cartValidation.valid) {
      return { valid: false, error: `cart_id: ${cartValidation.error}` };
    }
    result.cart_id = body.cart_id;
  }

  // Validate variant_id if provided
  if (body.variant_id) {
    const variantValidation = validateUUID(body.variant_id);
    if (!variantValidation.valid) {
      return { valid: false, error: `variant_id: ${variantValidation.error}` };
    }
    result.variant_id = body.variant_id;
  }

  // Validate quantity if provided
  if (body.quantity !== undefined) {
    const qtyValidation = validatePositiveInteger(body.quantity, 'quantity', 1, 100);
    if (!qtyValidation.valid) {
      return { valid: false, error: qtyValidation.error };
    }
    result.quantity = qtyValidation.value;
  }

  return { valid: true, value: result };
}

/**
 * Validate checkout request body
 */
export function validateCheckoutBody(body: any): ValidationResult<any> {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  // Validate email
  const emailValidation = validateEmail(body.email);
  if (!emailValidation.valid) {
    return { valid: false, error: emailValidation.error };
  }

  // Validate shipping address
  const shippingValidation = validateAddress(body.shipping_address);
  if (!shippingValidation.valid) {
    return { valid: false, error: `shipping_address: ${shippingValidation.error}` };
  }

  // Validate billing address if provided
  let billingAddress = shippingValidation.value;
  if (body.billing_address) {
    const billingValidation = validateAddress(body.billing_address);
    if (!billingValidation.valid) {
      return { valid: false, error: `billing_address: ${billingValidation.error}` };
    }
    billingAddress = billingValidation.value;
  }

  return {
    valid: true,
    value: {
      email: emailValidation.value,
      shipping_address: shippingValidation.value,
      billing_address: billingAddress
    }
  };
}

/**
 * Validate line item update body
 */
export function validateLineItemBody(body: any): ValidationResult<any> {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const result: any = {};

  // Validate quantity if provided
  if (body.quantity !== undefined) {
    const qtyValidation = validatePositiveInteger(body.quantity, 'quantity', 0, 100);
    if (!qtyValidation.valid) {
      return { valid: false, error: qtyValidation.error };
    }
    result.quantity = qtyValidation.value;
  }

  return { valid: true, value: result };
}

/**
 * Validate vehicle query parameters
 */
export function validateVehicleQuery(query: any): ValidationResult<any> {
    const allowed = ['manufacturer', 'model', 'manufacturer_slug', 'model_slug', 'type_slug', 'resolve_slugs'];
    const sanitized: any = {};
    
    if (query.resolve_slugs && query.resolve_slugs !== 'true' && query.resolve_slugs !== 'false') {
         return { valid: false, error: "resolve_slugs must be 'true' or 'false'" };
    }
    if (query.resolve_slugs) sanitized.resolve_slugs = query.resolve_slugs;

    const slugFields = ['manufacturer_slug', 'model_slug', 'type_slug'];
    for (const field of slugFields) {
        if (query[field]) {
            if (typeof query[field] !== 'string') return { valid: false, error: `${field} must be a string` };
            if (!/^[a-z0-9-_]+$/i.test(query[field])) {
                 return { valid: false, error: `${field} contains invalid characters` };
            }
            sanitized[field] = query[field];
        }
    }

    const idFields = ['manufacturer', 'model'];
    for (const field of idFields) {
        if (query[field]) {
             if (typeof query[field] !== 'string') return { valid: false, error: `${field} must be a string` };
             if (/[;'"\\]/.test(query[field])) {
                  return { valid: false, error: `${field} contains invalid characters` };
             }
             sanitized[field] = query[field];
        }
    }

    return { valid: true, value: sanitized };
}
