---
name: Estado del agente de precios
description: Arquitectura, estado actual y decisiones del sistema de actualización de precios multi-proveedor
type: project
---

Sistema de precios implementado para RAM Informática con 3 proveedores: GCGroup, Zentek, Kadabra.

**Why:** Automatizar la conversión de listas de WhatsApp a precios en Supabase, con deduplicación inteligente para siempre mantener activo el proveedor más barato cuando hay superposición.

**How to apply:** Al tocar cualquier parte del flujo de precios, leer `/.claude/agents/pricing/CLAUDE.md` primero para no romper decisiones ya tomadas.

## Estado actual (2026-03-18)

- ✅ `matcher.py` implementado con specs estructuradas + pesos (modelo 40%, storage 25%, RAM 15%, pantalla 10%, marca 10%)
- ✅ `procesar_gcgroup.py` — funciona, formato `► CATEGORIA` + `PRODUCTO - $ PRECIO`
- ✅ `procesar_zentek.py` — funciona, formato `▶️ MARCA ◀️` + `PRODUCTO $PRECIO`
- ✅ `procesar_kadabra.py` — reescrito para formato real: `EMOJI PRODUCTO` + `X1 $PRECIO / X3 / X5`
- ✅ `consolidar_precios.py` — actualizado para usar matcher.py (antes usaba normalización básica)
- ✅ `actions.ts` — matching Jaro-Winkler reemplazado por extractSpecs + getSpecsSimilarity
- ✅ `/.claude/agents/pricing/CLAUDE.md` — contexto del agente creado

## Decisiones técnicas

- **Kadabra X1**: Solo se usa el precio X1 (unitario), X3/X5 se ignoran
- **Threshold matching**: 0.75 para consolidado Python, 0.85 para sync Supabase (más conservador)
- **Marcas distintas → score 0**: Si las marcas son distintas, nunca son el mismo producto
- **Storage distinto → no suma**: Si el storage no coincide, no se suman los puntos de esa dimensión
- **Sin storage → mitad del puntaje**: Para no penalizar productos donde el nombre no incluye storage

## Fórmula de precio (todos los proveedores)
```
precio_venta = round((precio_costo / 0.90 + 25) / 5) * 5
```

## Pendiente / mejoras futuras
- ⚠️ Probar matcher con formato real de Kadabra una vez que Ramiro tenga el próximo listado
- ⚠️ Agregar soporte para Kadabra con precios inline vs. precio en línea siguiente
- 💡 Considerar agregar campo `proveedor_alternativo` en Supabase para mostrar en admin
