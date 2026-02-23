-- Agregar columna tags (array de texto) a la tabla products
ALTER TABLE products ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Crear índice GIN para búsquedas rápidas en el array de tags
CREATE INDEX IF NOT EXISTS idx_products_tags ON products USING GIN (tags);

-- Ejemplo: actualizar un producto con tags
-- UPDATE products SET tags = ARRAY['playstation', 'playstation 5', 'play', 'ps5', 'consola', 'sony', 'gaming'] WHERE slug = 'ps5';

-- Algunos ejemplos de tags para productos comunes:
-- PS5: {'playstation', 'playstation 5', 'play', 'ps5', 'consola', 'sony', 'gaming', 'play 5'}
-- iPhone 15: {'iphone', 'iphone 15', 'apple', 'celular', 'telefono', 'smartphone'}
-- MacBook: {'macbook', 'mac', 'laptop', 'notebook', 'apple', 'portatil'}
-- AirPods: {'airpods', 'auriculares', 'audifonos', 'apple', 'bluetooth', 'wireless'}
