---
name: Estado de analytics GA4
description: Google Analytics 4 implementado en RAM Informática — eventos activos, pendientes y Measurement ID
type: project
---

GA4 integrado con Measurement ID `G-SL953TM4S3` via `next/script` en `layout.tsx`.

**Why:** El usuario quiere saber qué productos son más visitados, si clickean WhatsApp, si agregan al carrito y de dónde vienen las visitas.

**How to apply:** Antes de agregar nuevos eventos, revisar `analytics.ts` para no duplicar. Seguir nomenclatura estándar GA4 ecommerce cuando exista.

## Eventos activos (2026-03-18)
- `view_item` — ProductDetailClient.tsx (al montar)
- `add_to_cart` — ProductDetailClient.tsx (onClick)
- `whatsapp_click` — Footer.tsx + PromoModal.tsx
- `search` — GlobalSearch.tsx (debounce 300ms, mín 3 chars)
- `filter_apply` — ProductosClient.tsx (categoría, marca, condición)

## Pendientes
- `select_item` en ProductCard
- `begin_checkout` en flujo de confirmación
- `view_item_list` al cargar catálogo
