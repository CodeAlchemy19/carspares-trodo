create schema if not exists catalog;
create schema if not exists fitment;

-- ====== BRAND / CATEGORY ======
create table if not exists catalog.brand (
  id uuid primary key,
  name text not null,
  slug text not null unique
);

create table if not exists catalog.category (
  id uuid primary key,
  parent_id uuid null references catalog.category(id),
  name text not null,
  slug text not null,
  path text not null,
  unique(path)
);

-- ====== PART / SKU (LINKS TO MEDUSA OPTIONAL) ======
create table if not exists catalog.part (
  id uuid primary key,
  brand_id uuid not null references catalog.brand(id),
  category_id uuid not null references catalog.category(id),
  title text not null,
  description text,
  status text not null default 'active',
  medusa_product_id uuid null unique
);

create table if not exists catalog.sku (
  id uuid primary key,
  part_id uuid not null references catalog.part(id) on delete cascade,
  mpn text,
  mpn_norm text,
  ean text,
  weight_grams int,
  dims_mm jsonb,
  medusa_variant_id uuid null unique
);

create index if not exists sku_part_id_idx on catalog.sku(part_id);
create index if not exists sku_mpn_norm_idx on catalog.sku(mpn_norm);

-- ====== PART NUMBERS ======
create table if not exists catalog.part_number (
  id uuid primary key,
  kind text not null,          -- 'OE','AFTERMARKET','EAN','SKU'
  value_raw text not null,
  value_norm text not null,
  brand_id uuid null references catalog.brand(id),
  unique(kind, value_norm, brand_id)
);

create table if not exists catalog.sku_part_number (
  sku_id uuid not null references catalog.sku(id) on delete cascade,
  part_number_id uuid not null references catalog.part_number(id) on delete cascade,
  primary key (sku_id, part_number_id)
);

create index if not exists part_number_lookup_idx
  on catalog.part_number(kind, value_norm);

create table if not exists catalog.part_number_link (
  from_part_number_id uuid not null references catalog.part_number(id),
  to_part_number_id uuid not null references catalog.part_number(id),
  relation text not null, -- 'equivalent','supersedes','replaced_by'
  confidence smallint not null default 100,
  primary key (from_part_number_id, to_part_number_id, relation)
);

-- ====== SUPPLIERS / OFFERS ======
create table if not exists catalog.supplier (
  id uuid primary key,
  name text not null,
  active boolean not null default true
);

create table if not exists catalog.offer (
  id uuid primary key,
  sku_id uuid not null references catalog.sku(id) on delete cascade,
  supplier_id uuid not null references catalog.supplier(id),
  region_code text not null,
  currency_code text not null,
  cost numeric(18,6) not null,
  stock_qty int not null,
  lead_time_days int not null,
  updated_at timestamptz not null default now(),
  unique(sku_id, supplier_id, region_code, currency_code)
);

create index if not exists offer_best_idx
  on catalog.offer(sku_id, region_code, currency_code, stock_qty desc, lead_time_days asc);

-- ====== VEHICLE DOMAIN ======
create table if not exists fitment.vehicle_make (
  id uuid primary key,
  name text not null,
  slug text not null unique
);

create table if not exists fitment.vehicle_model (
  id uuid primary key,
  make_id uuid not null references fitment.vehicle_make(id),
  name text not null,
  slug text not null,
  unique(make_id, slug)
);

create table if not exists fitment.vehicle_type (
  id uuid primary key,
  model_id uuid not null references fitment.vehicle_model(id),
  year_from int not null,
  year_to int not null,
  fuel text,
  engine_code text,
  engine_cc int,
  body text,
  power_kw int,
  extra jsonb
);

create index if not exists vehicle_type_model_idx on fitment.vehicle_type(model_id);
create index if not exists vehicle_type_year_idx on fitment.vehicle_type(year_from, year_to);

-- ====== FITMENT MANY-TO-MANY ======
create table if not exists fitment.sku_fitment (
  sku_id uuid not null references catalog.sku(id) on delete cascade,
  vehicle_type_id uuid not null references fitment.vehicle_type(id) on delete cascade,
  position text null,
  notes text null,
  restrictions jsonb null,
  primary key (sku_id, vehicle_type_id, position)
);

create index if not exists sku_fitment_vehicle_idx on fitment.sku_fitment(vehicle_type_id, sku_id);
create index if not exists sku_fitment_sku_idx on fitment.sku_fitment(sku_id, vehicle_type_id);
