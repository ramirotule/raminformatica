-- 1. Create supplier_mappings table
CREATE TABLE IF NOT EXISTS supplier_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  provider_id uuid REFERENCES providers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(original_name, provider_id)
);

-- 2. Add indexes for faster matching
CREATE INDEX IF NOT EXISTS idx_supplier_mappings_original_name ON supplier_mappings(original_name);
CREATE INDEX IF NOT EXISTS idx_supplier_mappings_variant ON supplier_mappings(variant_id);

-- 3. Comments for documentation
COMMENT ON TABLE supplier_mappings IS 'Mapeo entre nombres nativos de proveedores y productos internos';
COMMENT ON COLUMN supplier_mappings.original_name IS 'El nombre tal cual viene en la lista de precios (WhatsApp/Excel)';
