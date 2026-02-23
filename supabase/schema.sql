-- =====================================================
-- RAM Informática — Schema completo para Supabase
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- =====================================================

-- 1. EXTENSIONES
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- 2. ENUM
do $$ begin
  create type product_condition as enum ('new','oem','refurbished','used');
exception when duplicate_object then null;
end $$;

-- 3. CATEGORÍAS
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now()
);

-- 4. MARCAS
create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- 5. PRODUCTOS
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category_id uuid not null references categories(id) on delete restrict,
  brand_id uuid not null references brands(id) on delete restrict,
  condition product_condition not null default 'new',
  short_description text,
  long_description text,
  key_highlights text[] not null default '{}',
  specs jsonb not null default '{}'::jsonb,
  key_specs jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_category on products(category_id);
create index if not exists idx_products_brand on products(brand_id);

-- 6. VARIANTES
create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  sku text unique,
  color text,
  storage text,
  connectivity text,
  model_code text,
  ean text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_variants_product on product_variants(product_id);

-- 7. PRECIOS
create table if not exists prices (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references product_variants(id) on delete cascade,
  currency text not null check (currency in ('ARS','USD')),
  amount numeric(12,2) not null check (amount >= 0),
  compare_at numeric(12,2),
  updated_at timestamptz not null default now(),
  unique (variant_id, currency)
);

create index if not exists idx_prices_variant on prices(variant_id);

-- 8. INVENTARIO
create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references product_variants(id) on delete cascade unique,
  qty_available int not null default 0 check (qty_available >= 0),
  qty_reserved int not null default 0 check (qty_reserved >= 0),
  low_stock_threshold int not null default 3 check (low_stock_threshold >= 0),
  updated_at timestamptz not null default now()
);

-- 9. IMÁGENES
create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  storage_path text not null,
  public_url text,
  alt text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_images_product on product_images(product_id);

-- 10. FUENTES DE ENRIQUECIMIENTO
create table if not exists enrichment_sources (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  source_name text not null,
  source_url text not null,
  fetched_at timestamptz not null default now(),
  verified_by text,
  verified_at timestamptz,
  notes text
);

create index if not exists idx_sources_product on enrichment_sources(product_id);

-- 11. SEARCH VECTOR
alter table products add column if not exists search_vector tsvector;

create or replace function products_search_vector_update()
returns trigger as $$
begin
  new.search_vector :=
    to_tsvector(
      'simple',
      unaccent(
        coalesce(new.name,'') || ' ' ||
        coalesce(new.short_description,'') || ' ' ||
        coalesce(new.long_description,'') || ' ' ||
        array_to_string(coalesce(new.key_highlights,'{}'), ' ')
      )
    );
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_products_search_vector on products;
create trigger trg_products_search_vector
before insert or update on products
for each row execute function products_search_vector_update();

create index if not exists idx_products_search on products using gin(search_vector);
create index if not exists idx_products_name_trgm on products using gin (name gin_trgm_ops);

-- =====================================================
-- FIN DEL SCHEMA
-- Después de ejecutar esto, ejecutar seed_gcgroup.sql
-- =====================================================
