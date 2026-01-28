-- =========================================================
-- CARSPARES UNIFIED SCHEMA (schema_final.sql)
-- Combined from schema_additive.sql and cart_schema.sql
-- Serves as the Single Source of Truth for the 'automotive' schema.
-- =========================================================

-- =========================================================
-- 1. SETUP & EXTENSIONS
-- =========================================================
CREATE SCHEMA IF NOT EXISTS automotive;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================
-- 2. ENUMS & TYPES
-- =========================================================
DO $$ BEGIN
    CREATE TYPE quality_tier_enum AS ENUM ('PREMIUM', 'ECONOMY', 'BUDGET');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE part_condition_enum AS ENUM ('NEW', 'REMANUFACTURED', 'USED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE return_reason_enum AS ENUM ('DOES_NOT_FIT', 'DAMAGED', 'CHANGED_MIND', 'WARRANTY');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE price_list_type_enum AS ENUM ('RETAIL', 'B2B', 'VIP');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =========================================================
-- 3. CORE CATALOGUE (Brand, Category, Product)
-- =========================================================

CREATE TABLE IF NOT EXISTS automotive.brand (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    quality_tier quality_tier_enum DEFAULT 'PREMIUM',
    is_house_brand BOOLEAN DEFAULT FALSE,
    tecdoc_brand_id INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automotive.category (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID REFERENCES automotive.category(id),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    level INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automotive.product (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID REFERENCES automotive.brand(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_universal BOOLEAN DEFAULT FALSE,
    tecdoc_article_no VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automotive.product_category (
    product_id UUID REFERENCES automotive.product(id) ON DELETE CASCADE,
    category_id UUID REFERENCES automotive.category(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (product_id, category_id)
);

-- =========================================================
-- 4. PRODUCT VARIANTS
-- =========================================================

CREATE TABLE IF NOT EXISTS automotive.product_variant (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES automotive.product(id) ON DELETE CASCADE,
    sku VARCHAR(100) UNIQUE NOT NULL,
    ean VARCHAR(50),
    mpn VARCHAR(100),
    weight_kg DECIMAL(10,3) DEFAULT 0.500,
    length_cm INT DEFAULT 10,
    width_cm INT DEFAULT 10,
    height_cm INT DEFAULT 10,
    is_hazardous BOOLEAN DEFAULT FALSE,
    condition part_condition_enum DEFAULT 'NEW',
    superseded_by_sku VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================
-- 5. INVENTORY & PRICING
-- =========================================================

CREATE TABLE IF NOT EXISTS automotive.warehouse (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    country_code VARCHAR(2) DEFAULT 'EG',
    avg_delivery_days INT DEFAULT 2
);

CREATE TABLE IF NOT EXISTS automotive.stock_level (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_variant_id UUID REFERENCES automotive.product_variant(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES automotive.warehouse(id),
    quantity INT DEFAULT 0,
    reserved_quantity INT DEFAULT 0,
    bin_location VARCHAR(50),
    UNIQUE(product_variant_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS automotive.price_list (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    type price_list_type_enum DEFAULT 'RETAIL',
    currency_code VARCHAR(3) DEFAULT 'EGP'
);

CREATE TABLE IF NOT EXISTS automotive.price (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_variant_id UUID REFERENCES automotive.product_variant(id) ON DELETE CASCADE,
    price_list_id UUID REFERENCES automotive.price_list(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    min_quantity INT DEFAULT 1,
    UNIQUE(product_variant_id, price_list_id, min_quantity)
);

-- =========================================================
-- 6. VEHICLE DATA
-- =========================================================

CREATE TABLE IF NOT EXISTS automotive.vehicle_manufacturer (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    tecdoc_mfr_id INT UNIQUE
);

CREATE TABLE IF NOT EXISTS automotive.vehicle_model (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manufacturer_id UUID REFERENCES automotive.vehicle_manufacturer(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    year_start INT,
    year_end INT
);

CREATE TABLE IF NOT EXISTS automotive.vehicle_type (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID REFERENCES automotive.vehicle_model(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    tecdoc_k_type_id INT UNIQUE,
    kw INT,
    hp INT,
    engine_code VARCHAR(50),
    fuel_type VARCHAR(50),
    body_style VARCHAR(50),
    construction_month_start INT DEFAULT 1,
    construction_year_start INT,
    construction_month_end INT DEFAULT 12,
    construction_year_end INT
);

-- =========================================================
-- 7. FITMENT RULES
-- =========================================================

CREATE TABLE IF NOT EXISTS automotive.fitment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_variant_id UUID REFERENCES automotive.product_variant(id) ON DELETE CASCADE,
    vehicle_type_id UUID REFERENCES automotive.vehicle_type(id) ON DELETE CASCADE,
    fitting_position VARCHAR(50),
    chassis_no_from VARCHAR(50),
    chassis_no_to VARCHAR(50),
    year_from INT,
    year_to INT,
    extra_criteria JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_fitment_vehicle ON automotive.fitment(vehicle_type_id);
CREATE INDEX IF NOT EXISTS idx_fitment_product ON automotive.fitment(product_variant_id);

-- =========================================================
-- 8. CART & ORDER (From cart_schema.sql)
-- =========================================================

CREATE TABLE IF NOT EXISTS automotive.cart (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID,
    email VARCHAR(255),
    currency_code VARCHAR(3) DEFAULT 'EGP',
    region VARCHAR(50) DEFAULT 'EG',
    subtotal DECIMAL(10,2) DEFAULT 0,
    shipping_total DECIMAL(10,2) DEFAULT 0,
    tax_total DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) DEFAULT 0,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automotive.cart_line_item (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id UUID REFERENCES automotive.cart(id) ON DELETE CASCADE,
    product_variant_id UUID REFERENCES automotive.product_variant(id),
    title VARCHAR(255) NOT NULL,
    brand VARCHAR(255),
    sku VARCHAR(100),
    unit_price DECIMAL(10,2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    subtotal DECIMAL(10,2) GENERATED ALWAYS AS (unit_price * quantity) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(cart_id, product_variant_id)
);

CREATE TABLE IF NOT EXISTS automotive.order (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    display_id SERIAL,
    cart_id UUID REFERENCES automotive.cart(id),
    customer_id UUID,
    email VARCHAR(255) NOT NULL,
    currency_code VARCHAR(3) DEFAULT 'EGP',
    region VARCHAR(50) DEFAULT 'EG',
    subtotal DECIMAL(10,2) NOT NULL,
    shipping_total DECIMAL(10,2) DEFAULT 0,
    tax_total DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    payment_status VARCHAR(50) DEFAULT 'awaiting',
    fulfillment_status VARCHAR(50) DEFAULT 'not_fulfilled',
    shipping_address JSONB,
    billing_address JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automotive.order_line_item (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES automotive.order(id) ON DELETE CASCADE,
    product_variant_id UUID REFERENCES automotive.product_variant(id),
    title VARCHAR(255) NOT NULL,
    brand VARCHAR(255),
    sku VARCHAR(100),
    unit_price DECIMAL(10,2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    subtotal DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cart/Order Indexes
CREATE INDEX IF NOT EXISTS idx_cart_customer ON automotive.cart(customer_id);
CREATE INDEX IF NOT EXISTS idx_cart_email ON automotive.cart(email);
CREATE INDEX IF NOT EXISTS idx_cart_line_cart ON automotive.cart_line_item(cart_id);
CREATE INDEX IF NOT EXISTS idx_order_customer ON automotive.order(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_email ON automotive.order(email);

-- =========================================================
-- 9. USER, CHARGES, RETURNS, REF
-- =========================================================

CREATE TABLE IF NOT EXISTS automotive.user_garage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255),
    nickname VARCHAR(100),
    vin VARCHAR(17),
    license_plate VARCHAR(20),
    vehicle_type_id UUID REFERENCES automotive.vehicle_type(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automotive.core_charge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_variant_id UUID REFERENCES automotive.product_variant(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EGP'
);

CREATE TABLE IF NOT EXISTS automotive.return_request (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(255) NOT NULL,
    product_variant_id UUID REFERENCES automotive.product_variant(id),
    reason return_reason_enum NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automotive.part_reference (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_variant_id UUID REFERENCES automotive.product_variant(id) ON DELETE CASCADE,
    ref_number VARCHAR(100) NOT NULL,
    ref_type VARCHAR(50) DEFAULT 'OEM',
    manufacturer VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_part_ref_number ON automotive.part_reference(ref_number);

-- =========================================================
-- 10. DEFAULT DATA
-- =========================================================

INSERT INTO automotive.warehouse (name, country_code, avg_delivery_days) 
VALUES ('Main Warehouse', 'EG', 2)
ON CONFLICT DO NOTHING;

INSERT INTO automotive.price_list (name, type, currency_code) 
VALUES ('Default Retail', 'RETAIL', 'EGP')
ON CONFLICT DO NOTHING;
