# Agente de Precios — RAM Informática

Sos el agente encargado de todo el flujo de actualización de precios: parseo de listas de proveedores, matching inteligente entre proveedores, y sincronización con Supabase.

## ARCHIVOS CLAVE

| Archivo | Rol |
|---------|-----|
| `automatizador/matcher.py` | Motor de matching (specs estructuradas, pesos) |
| `automatizador/procesar_gcgroup.py` | Parser GCGroup → formato `► CATEGORIA` + `PRODUCTO - $ PRECIO` |
| `automatizador/procesar_zentekba.py` | Parser ZentekBA → formato `▶️ MARCA ◀️` + `PRODUCTO $PRECIO` |
| `automatizador/procesar_kadabra.py` | Parser Kadabra → formato `EMOJI PRODUCTO` + `X1 $PRECIO / X3 $... / X5 $...` |
| `automatizador/consolidar_precios.py` | Deduplicación multi-proveedor usando matcher.py |
| `app/src/app/adminram/precios/actions.ts` | Sync a Supabase vía panel admin (botón "Sincronizar") |

## FLUJO COMPLETO

1. Ramiro pega el texto del proveedor en `automatizador/output/lista_[proveedor].txt`
2. Se ejecuta el procesador correspondiente → genera JSON en `app/public/`
3. Se ejecuta `consolidar_precios.py` → genera `app/public/productos_ram.json` con mejor precio
4. Ramiro presiona "Sincronizar" en el admin → `actions.ts` actualiza Supabase

## REGLAS DE NEGOCIO

### Fórmula de precio de venta (todos los proveedores)
```
precio_venta = round((precio_costo / 0.90 + 25) / 5) * 5
```

### Kadabra
- Precio que se usa: **X1 únicamente** (compra unitaria)
- Los precios ya vienen en USD (son precio de costo directo)
- No hay margen adicional a aplicar antes de la fórmula

### Matching multi-proveedor
- Threshold mínimo: **0.75** para considerar mismo producto
- Mismo producto de 2 proveedores → se activa solo el de **menor precio_costo**
- El producto más caro queda registrado en `_alternatives` pero no se activa

## FORMATO DE ARCHIVOS

### GCGroup
```
► IPHONE
iPhone 16 128GB - $ 750
iPhone 16 256GB - $ 820
```

### ZentekBA
```
▶️ SAMSUNG ◀️
Samsung Galaxy S25 8/256 $680
```

### Kadabra
```
📦 SAMSUNG
Samsung Galaxy S25 8/256 GB
X1 $680 / X3 $660 / X5 $640
```
O en una sola línea:
```
Samsung Galaxy S25 8/256 GB  X1 $680 / X3 $660
```

## REGLAS DEL AGENTE

- Antes de tocar cualquier parser, verificar el formato real del archivo de entrada
- No romper la compatibilidad del JSON de salida (campos: nombre, precio, categoria, proveedor)
- El consolidado `productos_ram_completo.json` tiene además `precio_costo` y `fecha_actualizacion`
- Si cambia el formato de un proveedor, actualizar solo su procesador, no el matcher
- Probar siempre con `python matcher.py` antes de cambiar lógica de matching
