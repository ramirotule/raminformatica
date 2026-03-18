# Agente: Estadísticas & Analytics — RAM Informática

## OBJETIVO
Analizar el comportamiento de los usuarios en el ecommerce usando Google Analytics 4.
Interpretar métricas, detectar oportunidades y proponer mejoras basadas en datos reales.

## CONFIGURACIÓN GA4
- **Propiedad**: RAM Informática
- **Measurement ID**: `G-SL953TM4S3`
- **Implementación**: `app/src/app/layout.tsx` via `next/script` con `strategy="afterInteractive"`
- **Utilidades de tracking**: `app/src/lib/analytics.ts`
- **Init avanzado**: `app/src/components/AnalyticsInit.tsx` — IP/ISP detection, internal traffic, Google Signals

## CONFIGURACIONES MANUALES EN GA4 (no se pueden hacer por código)

### 1. Google Signals ⚠️ ACTIVAR MANUALMENTE
```
GA4 → Admin → Recopilación de datos → Google Signals → Activar
```
Permite cruzar datos de usuarios logueados en Google entre dispositivos.

### 2. Identidad del informe → Mezclada (Blended)
```
GA4 → Admin → Identidad del informe → Mezclada
```
Combina datos de User ID, Google Signals y anónimos para mejores atribuciones.

### 3. Filtro de Tráfico Interno
```
GA4 → Admin → Filtros de datos → Crear filtro
Tipo: Tráfico interno
Regla: traffic_type = internal
Modo: Activo
```
Este filtro elimina el tráfico con `traffic_type: 'internal'` (enviado automáticamente desde la IP del developer).

### 4. Dimensión Personalizada user_isp
```
GA4 → Admin → Definiciones personalizadas → Dimensiones → Crear
Nombre: ISP del usuario
Alcance: Usuario
Parámetro del evento: user_isp
```
Permite cruzar Ciudad (ej: Escobar) × ISP (ej: Telecom La Pampa) para identificar clientes locales.

## FILTRO DE TRÁFICO INTERNO

**Variable de entorno**: `NEXT_PUBLIC_DEVELOPER_IP` en `.env.local` y en Vercel
**Cómo obtener tu IP fija**: https://api.ipify.org
**Lógica**: `AnalyticsInit.tsx` detecta la IP del visitante via `ipapi.co`, compara con la env var y envía `traffic_type: 'internal'` si coincide.

```bash
# En .env.local:
NEXT_PUBLIC_DEVELOPER_IP=200.xxx.xxx.xxx

# En producción (Vercel Dashboard → Settings → Environment Variables):
# Agregar la misma variable
```

## ISP COMO DIMENSIÓN PERSONALIZADA

El componente `AnalyticsInit.tsx` extrae el ISP del campo `org` de `ipapi.co/json/` y lo envía como:
- **Event parameter**: `user_isp` en cada config de GA4
- **User property**: `user_isp` (persiste entre sesiones)

Ejemplo de valor: `"AS7303 Telecom Argentina S.A."`

Con esto podés crear en GA4 un reporte:
```
Dimensión 1: Ciudad = Escobar
Dimensión 2: ISP del usuario = Telecom Argentina
→ Confirma que son clientes de La Pampa con IP asignada por Telecom
```

## LOGGING DE DESARROLLO

En `NODE_ENV=development`, al cargar el sitio aparece en consola:
```
[GA4 Init] 🏠 INTERNO   ← si es tu IP
  IP detectada: 200.xxx.xxx.xxx
  Ciudad / Región: Santa Rosa, La Pampa
  ISP: AS7303 Telecom Argentina S.A.
  traffic_type: internal
  GA4 config enviada: { allow_google_signals: true, ... }

[GA4] view_item { currency: 'USD', value: 735, items: [...] }
[GA4] add_to_cart { ... }
```

## EVENTOS IMPLEMENTADOS

| Evento | Tipo | Dónde se dispara | Parámetros clave |
|--------|------|-----------------|-----------------|
| `view_item` | Estándar e-commerce | Al cargar página de producto | item_id, item_name, item_category, item_brand, price |
| `add_to_cart` | Estándar e-commerce | Click "Agregar al carrito" | item_id, price, quantity |
| `select_item` | Estándar e-commerce | Click en ProductCard del listado | item_id, index, item_list_name |
| `whatsapp_click` | Custom | Footer, PromoModal | event_label (source), product_name |
| `search` | Estándar | GlobalSearch con ≥3 chars (debounce) | search_term |
| `filter_apply` | Custom | Filtros del catálogo | filter_type, filter_value |
| `begin_checkout` | Estándar e-commerce | Inicio de checkout | currency, value, items[] |

## MÉTRICAS CLAVE A MONITOREAR

### Adquisición (¿de dónde vienen?)
- **Canales**: Organic Search, Direct, Social (Instagram/Facebook), Referral
- **Geografía**: Ciudad/provincia — verificar % Santa Rosa vs resto de Argentina
- **Dispositivos**: Mobile vs Desktop (el sitio es mobile-first)

### Comportamiento de producto
- **Productos más vistos**: Reporte `view_item` ordenado por conteo → identifica demanda
- **Tasa add_to_cart / view_item**: Si es baja (<5%) → el precio o la ficha necesita mejora
- **Productos buscados**: Reporte `search_term` → detecta productos no listados que la gente busca

### Conversión WhatsApp
- **whatsapp_click por source**: comparar footer vs promo_modal → qué convierte más
- **whatsapp_click / sesión**: tasa de contacto general del sitio

### Filtros y UX
- **filter_apply más usados**: qué categorías y marcas filtran más → priorizar en home
- **Bounce rate por página**: si es alta en producto → mejorar imágenes/descripción

## REPORTES RECOMENDADOS EN GA4

### 1. Productos más visitados
```
Explorar → Forma libre
Dimensión: item_name
Métrica: Número de eventos (filtrar event_name = view_item)
```

### 2. Embudo de conversión
```
Explorar → Embudo
Pasos: view_item → add_to_cart → begin_checkout
→ Detecta dónde se pierden los usuarios
```

### 3. Búsquedas sin resultado
```
Explorar → Forma libre
Dimensión: search_term
Métrica: conteo de eventos
→ Términos que no matchean con ningún producto = oportunidades de catálogo
```

### 4. Mapa geográfico
```
Informes → Datos demográficos → Visión general
→ Ver ciudades y provincias de origen
```

### 5. WhatsApp conversion path
```
Explorar → Recorrido del usuario
Evento inicial: whatsapp_click
→ Ver qué página/producto generó el contacto
```

## ACCIONES SUGERIDAS SEGÚN DATOS

| Si ves esto... | Acción recomendada |
|---------------|-------------------|
| `view_item` alto pero `add_to_cart` bajo | Revisar precio, descripción, imágenes |
| Búsquedas frecuentes de producto no listado | Agregar al catálogo |
| Alto tráfico mobile con bounce alto | Revisar UX mobile de esa página |
| `filter_apply` "iPhone" es el más usado | Destacar iPhone en home/navbar |
| `whatsapp_click` bajo | Hacer el botón más visible en ficha de producto |

## ARCHIVOS RELEVANTES

| Archivo | Rol |
|---------|-----|
| `app/src/lib/analytics.ts` | Todas las funciones de tracking — agregar nuevos eventos aquí |
| `app/src/app/layout.tsx` | Script de carga de GA4 |
| `app/src/app/productos/[slug]/ProductDetailClient.tsx` | `view_item`, `add_to_cart` |
| `app/src/components/GlobalSearch.tsx` | `search` |
| `app/src/app/productos/ProductosClient.tsx` | `filter_apply` |
| `app/src/components/Footer.tsx` | `whatsapp_click` (footer) |
| `app/src/components/PromoModal.tsx` | `whatsapp_click` (promo_modal) |

## EVENTOS PENDIENTES DE IMPLEMENTAR

- `select_item` en ProductCard (click desde el listado) — agregar en `ProductCard.tsx`
- `begin_checkout` — agregar cuando el usuario confirma el pedido en el carrito
- `view_item_list` — trackear cuando carga el catálogo (útil para remarketing)
- `view_promotion` — para las promos del modal
- Tiempo de permanencia en ficha de producto (scroll depth)

## REGLAS DEL AGENTE

- Nunca modificar el Measurement ID hardcodeado — está en `layout.tsx` como `GA_ID`
- Todos los eventos custom deben ir en `analytics.ts` con tipado estricto
- Usar siempre los nombres de eventos estándar GA4 cuando existan (no inventar nombres)
- Al agregar un evento nuevo, actualizar la tabla "EVENTOS IMPLEMENTADOS" de este CLAUDE.md
