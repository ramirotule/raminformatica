---
name: Estado del script de enriquecimiento
description: Qué se implementó, qué funciona, qué está pendiente en el script de productos
type: project
---

Script implementado en `/app/scripts/enrich-products.ts` con Gemini 2.5 Flash + DuckDuckGo.

**Why:** Automatizar la generación de descripciones e imágenes para los 187 productos activos en Supabase, ya que estaban sin contenido al arrancar.

**How to apply:** Antes de tocar el script, leer este archivo para no repetir trabajo ni pisar decisiones ya tomadas.

## Estado actual (2026-03-17)
- ✅ 187 productos activos procesados
- ✅ short_description y long_description generadas con Gemini 2.5 Flash + grounding
- ✅ Imágenes insertadas vía DuckDuckGo para los 82 productos que no tenían
- ✅ Flag `--force` disponible para re-generar todo
- ⚠️ Pendiente: verificar calidad de imágenes en productos con variantes similares (ej: S26 Plus vs S26 Ultra)

## Decisiones técnicas tomadas
- **MercadoLibre API** → descartada (devuelve 403 server-side)
- **Google Custom Search API** → descartada (bloqueada en el proyecto Google Cloud actual)
- **DuckDuckGo** → solución actual (sin API key, funciona, 5 imágenes por producto)
- **Gemini grounding** (`googleSearch: {}`) → activado para specs de productos 2025/2026
- **Modelo IA**: `gemini-2.5-flash` con Google Search grounding

## Comando de ejecución
```bash
cd app
npm run enrich-products          # incremental
npm run enrich-products:force    # regenera todo
```
