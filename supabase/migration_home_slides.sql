-- ─── Home Slides (Carousel del Home) ─────────────────────────────
CREATE TABLE IF NOT EXISTS home_slides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    subtitle TEXT,
    image_url TEXT NOT NULL,
    storage_path TEXT,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    link_url TEXT,
    sort_order INT DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Brand Logos (Ticker de marcas) ──────────────────────────────
CREATE TABLE IF NOT EXISTS brand_logos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    logo_url TEXT NOT NULL,
    storage_path TEXT,
    sort_order INT DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS (Row Level Security) — Permitir lectura pública
ALTER TABLE home_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_logos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read home_slides" ON home_slides FOR SELECT USING (true);
CREATE POLICY "Public read brand_logos" ON brand_logos FOR SELECT USING (true);

-- Autenticados pueden hacer todo
CREATE POLICY "Authenticated full access home_slides" ON home_slides FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated full access brand_logos" ON brand_logos FOR ALL USING (auth.role() = 'authenticated');
