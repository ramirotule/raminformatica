-- =============================================================
-- SEED: Productos GCgroup → RAM Informática (Supabase)
-- Proveedor: GCgroup | Fecha referencia: 2026-02-23
-- Esquema: categories → brands → products → product_variants → prices
-- Los precios están en USD (campo currency = 'USD')
-- =============================================================

-- ──────────────────────────────────────────────
-- 1. CATEGORÍAS  (upsert por slug)
-- ──────────────────────────────────────────────
INSERT INTO categories (name, slug, description) VALUES
  ('iPhone',              'celulares-iphone',          'Smartphones Apple iPhone'),
  ('Samsung',             'celulares-samsung',         'Smartphones Samsung'),
  ('Motorola',            'celulares-motorola',        'Smartphones Motorola'),
  ('Infinix',             'celulares-infinix',         'Smartphones Infinix'),
  ('Xiaomi',              'celulares-xiaomi',          'Smartphones Xiaomi'),
  ('Audio JBL',           'jbl-parlantes-auriculares', 'Parlantes y Auriculares JBL'),
  ('Video Juegos',        'video-juegos',              'Consolas, joysticks y accesorios gaming'),
  ('AirPods',             'airpods',                   'Auriculares inalámbricos Apple AirPods'),
  ('Apple Watch',         'apple-watch',               'Smartwatches Apple Watch'),
  ('iPad',                'ipad',                      'Tablets Apple iPad'),
  ('MacBook',             'macbook',                   'Notebooks Apple MacBook'),
  ('Televisores',         'televisores',               'Smart TVs y televisores')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- ──────────────────────────────────────────────
-- 2. MARCAS  (upsert por slug)
-- ──────────────────────────────────────────────
INSERT INTO brands (name, slug) VALUES
  ('Apple',    'apple'),
  ('Samsung',  'samsung'),
  ('Motorola', 'motorola'),
  ('Infinix',  'infinix'),
  ('Xiaomi',   'xiaomi'),
  ('JBL',      'jbl'),
  ('Sony',     'sony'),
  ('Logitech', 'logitech'),
  ('LG',       'lg'),
  ('Microsoft', 'microsoft'),
  ('HP',       'hp'),
  ('Lenovo',   'lenovo'),
  ('Acer',     'acer'),
  ('Asus',     'asus'),
  ('Dell',     'dell'),

  ('Philips',  'philips'),
  ('TCL',      'tcl'),
  ('Admiral',  'admiral'),
  ('Philco',   'philco')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;

-- ──────────────────────────────────────────────
-- 3. HELPER: función temporal para insertar
--    producto + variante + precio en un solo paso
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION _gcgroup_insert(
  p_name        text,
  p_slug        text,
  p_cat_slug    text,
  p_brand_slug  text,
  p_price_usd   numeric,
  p_sku         text DEFAULT NULL,
  p_color       text DEFAULT NULL,
  p_storage     text DEFAULT NULL,
  p_connectivity text DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_cat_id  uuid;
  v_brand_id uuid;
  v_prod_id  uuid;
  v_var_id   uuid;
BEGIN
  SELECT id INTO v_cat_id   FROM categories WHERE slug = p_cat_slug;
  SELECT id INTO v_brand_id FROM brands     WHERE slug = p_brand_slug;

  -- Producto  (si ya existe por slug lo saltea)
  INSERT INTO products (name, slug, category_id, brand_id, condition, active)
  VALUES (p_name, p_slug, v_cat_id, v_brand_id, 'new', true)
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
  RETURNING id INTO v_prod_id;

  IF v_prod_id IS NULL THEN
    SELECT id INTO v_prod_id FROM products WHERE slug = p_slug;
  END IF;

  -- Variante principal
  INSERT INTO product_variants (product_id, sku, color, storage, connectivity, active)
  VALUES (v_prod_id, COALESCE(p_sku, p_slug || '-v1'), p_color, p_storage, p_connectivity, true)
  ON CONFLICT (sku) DO UPDATE SET color = EXCLUDED.color, storage = EXCLUDED.storage, updated_at = now()
  RETURNING id INTO v_var_id;

  IF v_var_id IS NULL THEN
    SELECT id INTO v_var_id FROM product_variants WHERE sku = COALESCE(p_sku, p_slug || '-v1');
  END IF;

  -- Precio USD  (upsert)
  INSERT INTO prices (variant_id, currency, amount)
  VALUES (v_var_id, 'USD', p_price_usd)
  ON CONFLICT (variant_id, currency) DO UPDATE SET amount = EXCLUDED.amount, updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- ──────────────────────────────────────────────
-- 4. INSERCIÓN DE PRODUCTOS
-- ──────────────────────────────────────────────

-- ============ CELULARES IPHONE NEW ============
SELECT _gcgroup_insert('iPhone 15 128 GB SIM/ESIM',        'iphone-15-128gb-sim-esim',        'celulares-iphone', 'apple', 705,  'iph15-128-simsim',  NULL, '128GB', 'SIM/ESIM');
SELECT _gcgroup_insert('iPhone 15 256 GB SIM/ESIM',        'iphone-15-256gb-sim-esim',        'celulares-iphone', 'apple', 840,  'iph15-256-simsim',  NULL, '256GB', 'SIM/ESIM');
SELECT _gcgroup_insert('iPhone 16 128 GB SIM/ESIM',        'iphone-16-128gb-sim-esim',        'celulares-iphone', 'apple', 840,  'iph16-128-simsim',  NULL, '128GB', 'SIM/ESIM');
SELECT _gcgroup_insert('iPhone 16 256 GB SIM/ESIM',        'iphone-16-256gb-sim-esim',        'celulares-iphone', 'apple', 955,  'iph16-256-simsim',  NULL, '256GB', 'SIM/ESIM');
SELECT _gcgroup_insert('iPhone 16 Pro 128 GB SIM',         'iphone-16-pro-128gb-sim',         'celulares-iphone', 'apple', 1170, 'iph16pro-128-sim',  NULL, '128GB', 'SIM');
SELECT _gcgroup_insert('iPhone 16 Pro Max 256 GB SIM',     'iphone-16-pro-max-256gb-sim',     'celulares-iphone', 'apple', 1390, 'iph16promax-256-sim', NULL, '256GB', 'SIM');
SELECT _gcgroup_insert('iPhone 17 256 GB SIM/ESIM',        'iphone-17-256gb-sim-esim',        'celulares-iphone', 'apple', 1005, 'iph17-256-simsim',  NULL, '256GB', 'SIM/ESIM');
SELECT _gcgroup_insert('iPhone 17 Pro 256 GB ESIM Orange', 'iphone-17-pro-256gb-esim-orange', 'celulares-iphone', 'apple', 1380, 'iph17pro-256-esim-org', 'Orange', '256GB', 'ESIM');
SELECT _gcgroup_insert('iPhone 17 Pro 256 GB ESIM Silver', 'iphone-17-pro-256gb-esim-silver', 'celulares-iphone', 'apple', 1415, 'iph17pro-256-esim-slv', 'Silver', '256GB', 'ESIM');
SELECT _gcgroup_insert('iPhone 17 Pro 512 GB ESIM Orange', 'iphone-17-pro-512gb-esim-orange', 'celulares-iphone', 'apple', 1635, 'iph17pro-512-esim-org', 'Orange', '512GB', 'ESIM');
SELECT _gcgroup_insert('iPhone 17 Pro Max 256 GB ESIM Orange','iphone-17-pro-max-256gb-esim-orange','celulares-iphone','apple',1515,'iph17promax-256-esim-org','Orange','256GB','ESIM');
SELECT _gcgroup_insert('iPhone 17 Pro Max 256 GB ESIM Blue',  'iphone-17-pro-max-256gb-esim-blue',  'celulares-iphone','apple',1535,'iph17promax-256-esim-blu','Blue',  '256GB','ESIM');
SELECT _gcgroup_insert('iPhone 17 Pro Max 256 GB ESIM Silver','iphone-17-pro-max-256gb-esim-silver','celulares-iphone','apple',1540,'iph17promax-256-esim-slv','Silver','256GB','ESIM');
SELECT _gcgroup_insert('iPhone 17 Pro Max 512 GB ESIM Orange/Blue','iphone-17-pro-max-512gb-esim-orange-blue','celulares-iphone','apple',1760,'iph17promax-512-esim-orgblu','Orange/Blue','512GB','ESIM');
SELECT _gcgroup_insert('iPhone 17 Pro Max 512 GB ESIM Silver',     'iphone-17-pro-max-512gb-esim-silver',     'celulares-iphone','apple',1770,'iph17promax-512-esim-slv','Silver','512GB','ESIM');

-- ============ CELULARES SAMSUNG ============
SELECT _gcgroup_insert('Samsung A06 4/64 GB',                'samsung-a06-4-64gb',               'celulares-samsung','samsung',135, 'sam-a06-4-64',    NULL,'64GB',  NULL);
SELECT _gcgroup_insert('Samsung A07 4/64 GB',                'samsung-a07-4-64gb',               'celulares-samsung','samsung',140, 'sam-a07-4-64',    NULL,'64GB',  NULL);
SELECT _gcgroup_insert('Samsung A07 4/128 GB',               'samsung-a07-4-128gb',              'celulares-samsung','samsung',160, 'sam-a07-4-128',   NULL,'128GB', NULL);
SELECT _gcgroup_insert('Samsung A07 8/256 GB',               'samsung-a07-8-256gb',              'celulares-samsung','samsung',190, 'sam-a07-8-256',   NULL,'256GB', NULL);
SELECT _gcgroup_insert('Samsung A16 4/128 GB',               'samsung-a16-4-128gb',              'celulares-samsung','samsung',165, 'sam-a16-4-128',   NULL,'128GB', NULL);
SELECT _gcgroup_insert('Samsung A36 5G 8/128 GB',            'samsung-a36-5g-8-128gb',           'celulares-samsung','samsung',320, 'sam-a36-5g-8-128',NULL,'128GB', '5G');
SELECT _gcgroup_insert('Samsung A36 5G 8/256 GB',            'samsung-a36-5g-8-256gb',           'celulares-samsung','samsung',335, 'sam-a36-5g-8-256',NULL,'256GB', '5G');
SELECT _gcgroup_insert('Samsung A36 5G 12/256 GB',           'samsung-a36-5g-12-256gb',          'celulares-samsung','samsung',385, 'sam-a36-5g-12-256',NULL,'256GB','5G');
SELECT _gcgroup_insert('Samsung A56 5G 8/128 GB',            'samsung-a56-5g-8-128gb',           'celulares-samsung','samsung',380, 'sam-a56-5g-8-128',NULL,'128GB', '5G');
SELECT _gcgroup_insert('Samsung A56 5G 12/256 GB',           'samsung-a56-5g-12-256gb',          'celulares-samsung','samsung',435, 'sam-a56-5g-12-256',NULL,'256GB','5G');
SELECT _gcgroup_insert('Samsung S24 FE 8/128 GB',            'samsung-s24-fe-8-128gb',           'celulares-samsung','samsung',490, 'sam-s24fe-8-128', NULL,'128GB', NULL);
SELECT _gcgroup_insert('Samsung S25 12/256 GB',              'samsung-s25-12-256gb',             'celulares-samsung','samsung',805, 'sam-s25-12-256',  NULL,'256GB', NULL);
SELECT _gcgroup_insert('Samsung S25 FE 8/128 GB',            'samsung-s25-fe-8-128gb',           'celulares-samsung','samsung',615, 'sam-s25fe-8-128', NULL,'128GB', NULL);
SELECT _gcgroup_insert('Samsung S25 FE 8/256 GB',            'samsung-s25-fe-8-256gb',           'celulares-samsung','samsung',690, 'sam-s25fe-8-256', NULL,'256GB', NULL);
SELECT _gcgroup_insert('Samsung S25 FE 8/512 GB',            'samsung-s25-fe-8-512gb',           'celulares-samsung','samsung',750, 'sam-s25fe-8-512', NULL,'512GB', NULL);
SELECT _gcgroup_insert('Samsung S25 Plus 12/256 GB',         'samsung-s25-plus-12-256gb',        'celulares-samsung','samsung',905, 'sam-s25p-12-256', NULL,'256GB', NULL);
SELECT _gcgroup_insert('Samsung S25 Ultra 12/256 GB',        'samsung-s25-ultra-12-256gb',       'celulares-samsung','samsung',1075,'sam-s25u-12-256', NULL,'256GB', NULL);
SELECT _gcgroup_insert('Samsung S25 Ultra 12/512 GB',        'samsung-s25-ultra-12-512gb',       'celulares-samsung','samsung',1175,'sam-s25u-12-512', NULL,'512GB', NULL);
SELECT _gcgroup_insert('Samsung Z Flip 7 12/512 GB',         'samsung-z-flip7-12-512gb',         'celulares-samsung','samsung',1110,'sam-zflip7-12-512',NULL,'512GB',NULL);
SELECT _gcgroup_insert('Tablet Samsung X110 A9 8.7" 4/64 GB Gris','tablet-samsung-x110-a9-4-64gb-gris','celulares-samsung','samsung',160,'sam-tab-x110-4-64-gris','Gris','64GB',NULL);
SELECT _gcgroup_insert('Tablet Samsung X210 A9+ 11" 4/64 GB Navy','tablet-samsung-x210-a9p-4-64gb-navy','celulares-samsung','samsung',240,'sam-tab-x210-4-64-navy','Navy','64GB',NULL);
SELECT _gcgroup_insert('Tablet Samsung X520 S10 FE 10.9" 8/128 GB Gray','tablet-samsung-x520-s10fe-8-128gb-gray','celulares-samsung','samsung',455,'sam-tab-x520-8-128-gray','Gray','128GB',NULL);

-- ============ CELULARES MOTOROLA ============
SELECT _gcgroup_insert('Motorola G05 4/128 GB',              'motorola-g05-4-128gb',             'celulares-motorola','motorola',155,'mot-g05-4-128',    NULL,'128GB',NULL);
SELECT _gcgroup_insert('Motorola G06 4/64 GB',               'motorola-g06-4-64gb',              'celulares-motorola','motorola',150,'mot-g06-4-64',     NULL,'64GB', NULL);
SELECT _gcgroup_insert('Motorola G06 4/128 GB',              'motorola-g06-4-128gb',             'celulares-motorola','motorola',155,'mot-g06-4-128',    NULL,'128GB',NULL);
SELECT _gcgroup_insert('Motorola G06 4/64 Power GB',         'motorola-g06-4-64gb-power',        'celulares-motorola','motorola',155,'mot-g06-4-64-pow', NULL,'64GB', NULL);
SELECT _gcgroup_insert('Motorola G15 4/512 GB',              'motorola-g15-4-512gb',             'celulares-motorola','motorola',190,'mot-g15-4-512',    NULL,'512GB',NULL);
SELECT _gcgroup_insert('Motorola G24 Power 8/256 GB',        'motorola-g24-power-8-256gb',       'celulares-motorola','motorola',210,'mot-g24pw-8-256',  NULL,'256GB',NULL);
SELECT _gcgroup_insert('Motorola G55 5G 8/256 GB',           'motorola-g55-5g-8-256gb',          'celulares-motorola','motorola',220,'mot-g55-5g-8-256', NULL,'256GB','5G');
SELECT _gcgroup_insert('Motorola G56 5G 12/256 GB',          'motorola-g56-5g-12-256gb',         'celulares-motorola','motorola',235,'mot-g56-5g-12-256',NULL,'256GB','5G');
SELECT _gcgroup_insert('Motorola G75 5G 8/256 GB',           'motorola-g75-5g-8-256gb',          'celulares-motorola','motorola',255,'mot-g75-5g-8-256', NULL,'256GB','5G');
SELECT _gcgroup_insert('Motorola ThinkPhone 5G 8/256 GB',    'motorola-thinkphone-5g-8-256gb',   'celulares-motorola','motorola',340,'mot-think-5g-8-256',NULL,'256GB','5G');
SELECT _gcgroup_insert('Motorola Edge 50 Fusion 5G 12/256 GB','motorola-edge-50-fusion-5g-12-256gb','celulares-motorola','motorola',300,'mot-e50fu-5g-12-256',NULL,'256GB','5G');
SELECT _gcgroup_insert('Motorola Edge 60 Fusion 5G 8/256 GB', 'motorola-edge-60-fusion-5g-8-256gb','celulares-motorola','motorola',335,'mot-e60fu-5g-8-256', NULL,'256GB','5G');
SELECT _gcgroup_insert('Motorola Edge 60 Pro 5G 16/512 GB',  'motorola-edge-60-pro-5g-16-512gb', 'celulares-motorola','motorola',510,'mot-e60pro-5g-16-512',NULL,'512GB','5G');
SELECT _gcgroup_insert('Motorola Edge 70 5G 12/512 GB',      'motorola-edge-70-5g-12-512gb',     'celulares-motorola','motorola',540,'mot-e70-5g-12-512',  NULL,'512GB','5G');

-- ============ CELULARES INFINIX ============
SELECT _gcgroup_insert('Infinix Smart 10 3/64 GB',           'infinix-smart10-3-64gb',           'celulares-infinix','infinix',130,'inf-s10-3-64',     NULL,'64GB', NULL);
SELECT _gcgroup_insert('Infinix Smart 10 4/128 GB',          'infinix-smart10-4-128gb',          'celulares-infinix','infinix',135,'inf-s10-4-128',    NULL,'128GB',NULL);
SELECT _gcgroup_insert('Infinix Hot 50i 4/256 GB',           'infinix-hot50i-4-256gb',           'celulares-infinix','infinix',140,'inf-h50i-4-256',   NULL,'256GB',NULL);
SELECT _gcgroup_insert('Infinix Hot 60i 8/256 GB',           'infinix-hot60i-8-256gb',           'celulares-infinix','infinix',215,'inf-h60i-8-256',   NULL,'256GB',NULL);
SELECT _gcgroup_insert('Infinix Hot 60 Pro 8/256 GB',        'infinix-hot60-pro-8-256gb',        'celulares-infinix','infinix',220,'inf-h60pro-8-256', NULL,'256GB',NULL);
SELECT _gcgroup_insert('Infinix Hot 60 Pro Plus 8/256 GB',   'infinix-hot60-pro-plus-8-256gb',   'celulares-infinix','infinix',275,'inf-h60proplus-8-256',NULL,'256GB',NULL);
SELECT _gcgroup_insert('Infinix Note 50X 5G 8/256 GB',       'infinix-note50x-5g-8-256gb',       'celulares-infinix','infinix',235,'inf-n50x-5g-8-256',NULL,'256GB','5G');

-- ============ CELULARES XIAOMI ============
SELECT _gcgroup_insert('Xiaomi Redmi A5 3/64 GB',            'xiaomi-redmi-a5-3-64gb',           'celulares-xiaomi','xiaomi',130,'xia-ra5-3-64',      NULL,'64GB', NULL);
SELECT _gcgroup_insert('Xiaomi Redmi A5 4/128 GB',           'xiaomi-redmi-a5-4-128gb',          'celulares-xiaomi','xiaomi',150,'xia-ra5-4-128',     NULL,'128GB',NULL);
SELECT _gcgroup_insert('Xiaomi Redmi 15 6/128 GB',           'xiaomi-redmi-15-6-128gb',          'celulares-xiaomi','xiaomi',185,'xia-r15-6-128',     NULL,'128GB',NULL);
SELECT _gcgroup_insert('Xiaomi Redmi 15 8/256 GB',           'xiaomi-redmi-15-8-256gb',          'celulares-xiaomi','xiaomi',210,'xia-r15-8-256',     NULL,'256GB',NULL);
SELECT _gcgroup_insert('Xiaomi Redmi 15C 4/128 GB',          'xiaomi-redmi-15c-4-128gb',         'celulares-xiaomi','xiaomi',160,'xia-r15c-4-128',    NULL,'128GB',NULL);
SELECT _gcgroup_insert('Xiaomi Redmi 15C 4/256 GB',          'xiaomi-redmi-15c-4-256gb',         'celulares-xiaomi','xiaomi',170,'xia-r15c-4-256',    NULL,'256GB',NULL);
SELECT _gcgroup_insert('Xiaomi Note 13 Pro 5G 12/512 GB',    'xiaomi-note-13-pro-5g-12-512gb',   'celulares-xiaomi','xiaomi',335,'xia-n13pro-5g-12-512',NULL,'512GB','5G');
SELECT _gcgroup_insert('Xiaomi Note 14 6/128 GB',            'xiaomi-note-14-6-128gb',           'celulares-xiaomi','xiaomi',200,'xia-n14-6-128',     NULL,'128GB',NULL);
SELECT _gcgroup_insert('Xiaomi Note 14 8/256 GB',            'xiaomi-note-14-8-256gb',           'celulares-xiaomi','xiaomi',230,'xia-n14-8-256',     NULL,'256GB',NULL);
SELECT _gcgroup_insert('Xiaomi Note 14 5G 8/256 GB',         'xiaomi-note-14-5g-8-256gb',        'celulares-xiaomi','xiaomi',265,'xia-n14-5g-8-256',  NULL,'256GB','5G');
SELECT _gcgroup_insert('Xiaomi Note 14S 8/256 GB',           'xiaomi-note-14s-8-256gb',          'celulares-xiaomi','xiaomi',265,'xia-n14s-8-256',    NULL,'256GB',NULL);
SELECT _gcgroup_insert('Xiaomi Note 14 Pro 5G 8/256 GB',     'xiaomi-note-14-pro-5g-8-256gb',    'celulares-xiaomi','xiaomi',340,'xia-n14pro-5g-8-256',NULL,'256GB','5G');
SELECT _gcgroup_insert('Xiaomi Note 14 Pro 5G 12/512 GB',    'xiaomi-note-14-pro-5g-12-512gb',   'celulares-xiaomi','xiaomi',405,'xia-n14pro-5g-12-512',NULL,'512GB','5G');
SELECT _gcgroup_insert('Xiaomi Note 14 Pro+ 8/256 GB',       'xiaomi-note-14-pro-plus-8-256gb',  'celulares-xiaomi','xiaomi',415,'xia-n14proplus-8-256',NULL,'256GB',NULL);
SELECT _gcgroup_insert('Xiaomi Note 14 Pro+ 12/512 GB',      'xiaomi-note-14-pro-plus-12-512gb', 'celulares-xiaomi','xiaomi',505,'xia-n14proplus-12-512',NULL,'512GB',NULL);
SELECT _gcgroup_insert('Xiaomi Note 15 6/128 GB',            'xiaomi-note-15-6-128gb',           'celulares-xiaomi','xiaomi',230,'xia-n15-6-128',     NULL,'128GB',NULL);
SELECT _gcgroup_insert('Xiaomi Note 15 8/256 GB',            'xiaomi-note-15-8-256gb',           'celulares-xiaomi','xiaomi',265,'xia-n15-8-256',     NULL,'256GB',NULL);
SELECT _gcgroup_insert('Xiaomi Note 15 Pro 5G 8/256 GB',     'xiaomi-note-15-pro-5g-8-256gb',    'celulares-xiaomi','xiaomi',385,'xia-n15pro-5g-8-256',NULL,'256GB','5G');
SELECT _gcgroup_insert('Xiaomi Note 15 Pro+ 8/256 GB',       'xiaomi-note-15-pro-plus-8-256gb',  'celulares-xiaomi','xiaomi',460,'xia-n15proplus-8-256',NULL,'256GB',NULL);
SELECT _gcgroup_insert('Xiaomi Note 15 Pro+ 12/512 GB',      'xiaomi-note-15-pro-plus-12-512gb', 'celulares-xiaomi','xiaomi',520,'xia-n15proplus-12-512',NULL,'512GB',NULL);
SELECT _gcgroup_insert('Xiaomi Poco C71 3/64 GB',            'xiaomi-poco-c71-3-64gb',           'celulares-xiaomi','xiaomi',125,'xia-poc71-3-64',    NULL,'64GB', NULL);
SELECT _gcgroup_insert('Xiaomi Poco C71 4/128 GB',           'xiaomi-poco-c71-4-128gb',          'celulares-xiaomi','xiaomi',140,'xia-poc71-4-128',   NULL,'128GB',NULL);
SELECT _gcgroup_insert('Xiaomi Poco C85 6/128 GB',           'xiaomi-poco-c85-6-128gb',          'celulares-xiaomi','xiaomi',160,'xia-poc85-6-128',   NULL,'128GB',NULL);
SELECT _gcgroup_insert('Xiaomi Poco C85 8/256 GB',           'xiaomi-poco-c85-8-256gb',          'celulares-xiaomi','xiaomi',185,'xia-poc85-8-256',   NULL,'256GB',NULL);
SELECT _gcgroup_insert('Xiaomi Poco M7 6/128 GB',            'xiaomi-poco-m7-6-128gb',           'celulares-xiaomi','xiaomi',175,'xia-pocm7-6-128',   NULL,'128GB',NULL);
SELECT _gcgroup_insert('Xiaomi Poco M7 Pro 5G 8/256 GB',     'xiaomi-poco-m7-pro-5g-8-256gb',    'celulares-xiaomi','xiaomi',275,'xia-pocm7pro-5g-8-256',NULL,'256GB','5G');
SELECT _gcgroup_insert('Xiaomi Poco M8 5G 8/256 GB',         'xiaomi-poco-m8-5g-8-256gb',        'celulares-xiaomi','xiaomi',280,'xia-pocm8-5g-8-256',NULL,'256GB','5G');
SELECT _gcgroup_insert('Xiaomi Poco M8 Pro 5G 8/256 GB',     'xiaomi-poco-m8-pro-5g-8-256gb',    'celulares-xiaomi','xiaomi',390,'xia-pocm8pro-5g-8-256',NULL,'256GB','5G');
SELECT _gcgroup_insert('Xiaomi Poco M8 Pro 5G 12/512 GB',    'xiaomi-poco-m8-pro-5g-12-512gb',   'celulares-xiaomi','xiaomi',475,'xia-pocm8pro-5g-12-512',NULL,'512GB','5G');
SELECT _gcgroup_insert('Xiaomi Poco X7 5G 8/256 GB',         'xiaomi-poco-x7-5g-8-256gb',        'celulares-xiaomi','xiaomi',315,'xia-pocx7-5g-8-256',NULL,'256GB','5G');
SELECT _gcgroup_insert('Xiaomi Poco F7 5G 12/512 GB',        'xiaomi-poco-f7-5g-12-512gb',       'celulares-xiaomi','xiaomi',535,'xia-pocf7-5g-12-512',NULL,'512GB','5G');
SELECT _gcgroup_insert('Xiaomi Poco F7 Pro 5G 12/512 GB',    'xiaomi-poco-f7-pro-5g-12-512gb',   'celulares-xiaomi','xiaomi',635,'xia-pocf7pro-5g-12-512',NULL,'512GB','5G');
SELECT _gcgroup_insert('Xiaomi Poco F7 Ultra 5G 12/256 GB',  'xiaomi-poco-f7-ultra-5g-12-256gb', 'celulares-xiaomi','xiaomi',725,'xia-pocf7ult-5g-12-256',NULL,'256GB','5G');
SELECT _gcgroup_insert('Xiaomi Poco F8 Pro 5G 12/512 GB',    'xiaomi-poco-f8-pro-5g-12-512gb',   'celulares-xiaomi','xiaomi',740,'xia-pocf8pro-5g-12-512',NULL,'512GB','5G');
SELECT _gcgroup_insert('Xiaomi 14T Pro 5G 12/512 GB',        'xiaomi-14t-pro-5g-12-512gb',       'celulares-xiaomi','xiaomi',680,'xia-14tpro-5g-12-512',NULL,'512GB','5G');
SELECT _gcgroup_insert('Xiaomi 15 5G 12/512 GB',             'xiaomi-15-5g-12-512gb',            'celulares-xiaomi','xiaomi',890,'xia-15-5g-12-512',  NULL,'512GB','5G');
SELECT _gcgroup_insert('Xiaomi 15T 5G 12/256 GB',            'xiaomi-15t-5g-12-256gb',           'celulares-xiaomi','xiaomi',560,'xia-15t-5g-12-256', NULL,'256GB','5G');
SELECT _gcgroup_insert('Xiaomi 15T Pro 5G 12/512 GB',        'xiaomi-15t-pro-5g-12-512gb',       'celulares-xiaomi','xiaomi',885,'xia-15tpro-5g-12-512',NULL,'512GB','5G');
SELECT _gcgroup_insert('Xiaomi 15T Pro 5G 12/1 TB',          'xiaomi-15t-pro-5g-12-1tb',         'celulares-xiaomi','xiaomi',1025,'xia-15tpro-5g-12-1tb',NULL,'1TB','5G');

-- ============ JBL PARLANTES / AURICULARES ============
SELECT _gcgroup_insert('Auricular JBL Tune T520BT White',    'jbl-tune-t520bt-white',            'jbl-parlantes-auriculares','jbl',65, 'jbl-t520bt-wht','White',NULL,NULL);
SELECT _gcgroup_insert('Auricular JBL Tune T720BT Black/White','jbl-tune-t720bt-black-white',    'jbl-parlantes-auriculares','jbl',80, 'jbl-t720bt-bkwt','Black/White',NULL,NULL);
SELECT _gcgroup_insert('JBL Go 4 Bluetooth 4.2W',             'jbl-go-4-bluetooth',              'jbl-parlantes-auriculares','jbl',65, 'jbl-go4-4w',    NULL,NULL,'Bluetooth');
SELECT _gcgroup_insert('JBL Clip 5 Bluetooth 7W Black',       'jbl-clip-5-bluetooth-7w-black',   'jbl-parlantes-auriculares','jbl',75, 'jbl-clip5-7w-blk','Black',NULL,'Bluetooth');
SELECT _gcgroup_insert('JBL Flip 7 35W',                      'jbl-flip-7-35w',                  'jbl-parlantes-auriculares','jbl',135,'jbl-flip7-35w', NULL,NULL,'Bluetooth');
SELECT _gcgroup_insert('JBL Charge 6 45W',                    'jbl-charge-6-45w',                'jbl-parlantes-auriculares','jbl',180,'jbl-charge6-45w',NULL,NULL,'Bluetooth');
SELECT _gcgroup_insert('JBL Xtreme 4 100W',                   'jbl-xtreme-4-100w',               'jbl-parlantes-auriculares','jbl',310,'jbl-xtreme4-100w',NULL,NULL,'Bluetooth');
SELECT _gcgroup_insert('JBL Boombox 4 210W',                  'jbl-boombox-4-210w',              'jbl-parlantes-auriculares','jbl',575,'jbl-boombox4-210w',NULL,NULL,'Bluetooth');
SELECT _gcgroup_insert('JBL Barra de Sonido SB580 3.1 440W',  'jbl-soundbar-sb580-440w',         'jbl-parlantes-auriculares','jbl',340,'jbl-sb580-440w',NULL,NULL,'USB/Bluetooth');

-- ============ VIDEO JUEGOS ============
SELECT _gcgroup_insert('Joystick PS5 Black',               'joystick-ps5-black',               'video-juegos','sony',105,'ps5-joy-blk',       'Black',   NULL,NULL);
SELECT _gcgroup_insert('Joystick PS5 Camuflado',           'joystick-ps5-camuflado',           'video-juegos','sony',105,'ps5-joy-cam',       'Camuflado',NULL,NULL);
SELECT _gcgroup_insert('Joystick PS5 Starlight Blue',      'joystick-ps5-starlight-blue',      'video-juegos','sony',105,'ps5-joy-starblu',   'Starlight Blue',NULL,NULL);
SELECT _gcgroup_insert('Joystick PS5 Cobalt Blue',         'joystick-ps5-cobalt-blue',         'video-juegos','sony',105,'ps5-joy-cobaltblu', 'Cobalt Blue',NULL,NULL);
SELECT _gcgroup_insert('Joystick PS5 Sterling Silver',     'joystick-ps5-sterling-silver',     'video-juegos','sony',105,'ps5-joy-sterlslv',  'Sterling Silver',NULL,NULL);
SELECT _gcgroup_insert('Joystick PS5 Chroma Pearl',        'joystick-ps5-chroma-pearl',        'video-juegos','sony',105,'ps5-joy-chromaprl', 'Chroma Pearl',NULL,NULL);
SELECT _gcgroup_insert('PS5 con Lectora 1TB Returnal + Ratchet','ps5-lectora-1tb-returnal-ratchet','video-juegos','sony',660,'ps5-1tb-ret-rat',NULL,NULL,NULL);
SELECT _gcgroup_insert('PS5 Pro Digital 2TB',              'ps5-pro-digital-2tb',              'video-juegos','sony',940,'ps5-pro-dig-2tb',  NULL,NULL,NULL);
SELECT _gcgroup_insert('Volante Logitech G29 PS5/PS4/PC',  'volante-logitech-g29',             'video-juegos','logitech',340,'log-g29',       NULL,NULL,NULL);
SELECT _gcgroup_insert('Sony VR2 Horizon Bundle',          'sony-vr2-horizon-bundle',          'video-juegos','sony',590,'sony-vr2-horizon', NULL,NULL,NULL);

-- ============ AIRPODS ============
SELECT _gcgroup_insert('AirPods Pro 3ra Gen USB-C',        'airpods-pro-3ra-usbc',             'airpods','apple',300,'airpods-pro3-usbc',NULL,NULL,NULL);

-- ============ APPLE WATCH ============
SELECT _gcgroup_insert('Watch SE 3 40mm GPS',              'watch-se3-40mm-gps',               'apple-watch','apple',340,'watch-se3-40-gps',NULL,NULL,'GPS');
SELECT _gcgroup_insert('Watch 11 42mm',                    'watch-11-42mm',                    'apple-watch','apple',455,'watch-11-42mm',  NULL,NULL,NULL);
SELECT _gcgroup_insert('Watch 11 46mm',                    'watch-11-46mm',                    'apple-watch','apple',485,'watch-11-46mm',  NULL,NULL,NULL);
SELECT _gcgroup_insert('Watch Ultra 3 GPS Cell 49mm',      'watch-ultra-3-gps-cell-49mm',      'apple-watch','apple',920,'watch-ultra3-49',NULL,NULL,'GPS/Cell');

-- ============ IPAD ============
SELECT _gcgroup_insert('iPad Air 7ma 11" M3 128 GB',       'ipad-air-7ma-11-m3-128gb',         'ipad','apple',730,'ipad-air7-11-m3-128',NULL,'128GB',NULL);
SELECT _gcgroup_insert('iPad Air 7ma 11" M3 256 GB',       'ipad-air-7ma-11-m3-256gb',         'ipad','apple',865,'ipad-air7-11-m3-256',NULL,'256GB',NULL);
SELECT _gcgroup_insert('iPad Pro 11" M5 256 GB',           'ipad-pro-11-m5-256gb',             'ipad','apple',1165,'ipad-pro11-m5-256',NULL,'256GB',NULL);

-- ============ MACBOOK ============
SELECT _gcgroup_insert('MacBook Pro M5 14.2" 16/512 GB',   'macbook-pro-m5-14-16-512gb',       'macbook','apple',1940,'mbpro-m5-14-16-512',NULL,'512GB',NULL);

-- ============ TELEVISORES ============
SELECT _gcgroup_insert('85" Smart TV Samsung 4K QLED Q70D',              'tv-85-samsung-qled-q70d',           'televisores','samsung',2130,'tv-85-sam-qled-q70d',    NULL,NULL,NULL);
SELECT _gcgroup_insert('75" Smart TV UHD 4K Samsung U8000F',             'tv-75-samsung-uhd-u8000f',          'televisores','samsung',1220,'tv-75-sam-uhd-u8000f',   NULL,NULL,NULL);
SELECT _gcgroup_insert('65" Smart TV Samsung QLED 4K Q7 Tizen IA',       'tv-65-samsung-qled-q7-tizen',       'televisores','samsung',1040,'tv-65-sam-qled-q7',      NULL,NULL,NULL);
SELECT _gcgroup_insert('65" Smart TV Samsung LED 4K Crystal UHD DU7000', 'tv-65-samsung-led-du7000',          'televisores','samsung',800, 'tv-65-sam-led-du7000',   NULL,NULL,NULL);
SELECT _gcgroup_insert('65" Smart TV LG UHD 4K Alpha 7 65UA8050PSA',     'tv-65-lg-uhd-ua8050psa',           'televisores','lg',785,      'tv-65-lg-ua8050',        NULL,NULL,NULL);
SELECT _gcgroup_insert('65" Smart TV Philips LED 4K Ambilight 65PUD8100','tv-65-philips-ambilight-pud8100',   'televisores','philips',730, 'tv-65-phi-pud8100',      NULL,NULL,NULL);
SELECT _gcgroup_insert('60" Smart TV 4K UHD Admiral AD60G3FN',           'tv-60-admiral-ad60g3fn',            'televisores','admiral',515, 'tv-60-adm-ad60g3fn',     NULL,NULL,NULL);
SELECT _gcgroup_insert('55" Smart TV Samsung QLED 4K Q7 Tizen',          'tv-55-samsung-qled-q7',             'televisores','samsung',650, 'tv-55-sam-qled-q7',      NULL,NULL,NULL);
SELECT _gcgroup_insert('55" Smart TV Samsung 4K QLED Q65D',              'tv-55-samsung-qled-q65d',           'televisores','samsung',630, 'tv-55-sam-qled-q65d',    NULL,NULL,NULL);
SELECT _gcgroup_insert('55" Smart TV Samsung LED 4K U8000 Crystal UHD',  'tv-55-samsung-led-u8000',           'televisores','samsung',505, 'tv-55-sam-led-u8000',    NULL,NULL,NULL);
SELECT _gcgroup_insert('55" TV LED Philips UHD 55PUD7309',               'tv-55-philips-led-pud7309',         'televisores','philips',465, 'tv-55-phi-pud7309',      NULL,NULL,NULL);
SELECT _gcgroup_insert('55" Smart TV TCL 4K UHD 55V6C Google TV',        'tv-55-tcl-v6c-google',              'televisores','tcl',465,     'tv-55-tcl-v6c',          NULL,NULL,NULL);
SELECT _gcgroup_insert('50" Smart TV UHD 4K Samsung UN50DU7000',         'tv-50-samsung-du7000',              'televisores','samsung',465, 'tv-50-sam-du7000',       NULL,NULL,NULL);
SELECT _gcgroup_insert('50" Smart TV Admiral QLED 4K UHD',               'tv-50-admiral-qled',                'televisores','admiral',365, 'tv-50-adm-qled',         NULL,NULL,NULL);
SELECT _gcgroup_insert('43" Smart TV Full HD Samsung UN43T5300A',        'tv-43-samsung-t5300a',              'televisores','samsung',355, 'tv-43-sam-t5300a',       NULL,NULL,NULL);
SELECT _gcgroup_insert('43" Smart TV LED Philips 43PFD6910',             'tv-43-philips-pfd6910',             'televisores','philips',300, 'tv-43-phi-pfd6910',      NULL,NULL,NULL);
SELECT _gcgroup_insert('32" Smart TV Samsung HD UN32T4300A',             'tv-32-samsung-t4300a',              'televisores','samsung',230, 'tv-32-sam-t4300a',       NULL,NULL,NULL);
SELECT _gcgroup_insert('32" Smart TV TCL QLED FHD 32S5K Google TV',      'tv-32-tcl-s5k-google',              'televisores','tcl',225,     'tv-32-tcl-s5k',          NULL,NULL,NULL);
SELECT _gcgroup_insert('32" Smart TV Philco/Admiral',                    'tv-32-philco-admiral',              'televisores','philco',200,  'tv-32-phi-adm',          NULL,NULL,NULL);

-- ──────────────────────────────────────────────
-- 5. LIMPIEZA: eliminar función temporal
-- ──────────────────────────────────────────────
DROP FUNCTION IF EXISTS _gcgroup_insert(text,text,text,text,numeric,text,text,text,text);
