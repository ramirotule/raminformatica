# Agente: Enrichment de Productos

## OBJETIVO
Enriquecer automáticamente los productos en Supabase con:
- `short_description` — ficha visual con emojis y specs reales
- `long_description` — texto profesional para ficha de producto
- Imágenes vinculadas en tabla `product_images`

## SCRIPT PRINCIPAL
`/app/scripts/enrich-products.ts`

### Comandos
```bash
cd app
npm run enrich-products          # Solo procesa productos incompletos (idempotente)
npm run enrich-products:force    # Re-genera TODO aunque ya tenga datos
```

## APIS EN USO
| API | Uso | Key en .env.local |
|-----|-----|-------------------|
| Gemini 2.5 Flash + Google Search grounding | Generar descripciones con specs reales de la web | `GOOGLE_GENERATIVE_AI_API_KEY` |
| DuckDuckGo Image Search | Buscar imágenes de productos (sin API key) | — |
| Supabase | Leer/escribir productos e imágenes | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

## REGLAS DE NEGOCIO
- Solo completar campos si están vacíos o null o bien la descripcion short_description no cumple con el formato que especifico para la misma.
- Solo insertar imágenes si el producto no tiene ninguna
- Nunca duplicar registros
- Idempotente: ejecutar N veces = mismo resultado
- Manejar errores por producto sin frenar el proceso
- Con `--force`: re-genera descripciones pero NO toca imágenes ya existentes

## SCHEMA RELEVANTE
```typescript
Product: { id, name, slug, short_description, long_description, condition, brand_id, category_id, tags, active }
ProductImage: { id, product_id, storage_path, public_url, alt, sort_order, is_primary }
```

## FORMATO short_description
Una spec por línea con emoji. Ejemplo:
```
📱 Pantalla: 6.7" Dynamic AMOLED 2X, 120Hz
🚀 Procesador: Snapdragon 8 Elite
🔋 Batería: 4900 mAh
⚡ Carga: 45W
```

## CATEGORÍAS DETECTADAS AUTOMÁTICAMENTE
notebook · celular · tablet · smartwatch · auricular · consola · monitor · storage · memoria · procesador · gpu · networking · teclado   · accesorios · electronico

## PROBLEMAS CONOCIDOS
- MercadoLibre API: devuelve 403 desde server-side → usar DuckDuckGo
- Google Custom Search API: bloqueada en el proyecto actual → usar DuckDuckGo
- Gemini sin grounding: specs inexactas para productos 2025/2026 → activar `googleSearch` tool

## MEJORAS PENDIENTES
- Filtrar imágenes que contengan el nombre del producto en la URL para mayor precisión
- Soporte para productos `active: false` bajo flag explícito
- Validación de URLs de imágenes antes de insertar (HEAD request)
