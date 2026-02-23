# CLAUDE.md — RAM Informática Agent Rules

## PRINCIPIOS

- Siempre usar cloud.db como source of truth.
- Nunca inventar tablas fuera del esquema.
- UI y rutas siempre en español.
- Priorizar arquitectura escalable.

## FRONTEND

- Next.js App Router.
- Componentes reutilizables.
- No hardcodear strings (crear diccionario ES).

## BACKEND

- Consultas siempre tipadas.
- Nunca usar mock data permanente.
- Leer productos desde Supabase.

## DISEÑO

- Ecommerce moderno tipo Apple Store.
- Animaciones sutiles (no exageradas).
- Mobile-first.

## CONSUMO REST API
- El ecommerce maneja los precios en dolares por lo tanto
la idea es que en el header de la pagina este actualizado cada 10 minutoos
la cotizacion del dolar blue venta por lo tanto la idea es consumir una rest api que me de esa cotizacion usar esta curl https://dolarapi.com/v1/dolares/blue  y mostrar el precio en dolares y en pesos argentinos.


## ADMIN PANEL

- Debe existir desde el inicio.
- CRUD completo.
- Control real de stock.

## REGLA CRÍTICA

Si algo no está definido:
- seguir estructura de cloud.db
- nunca asumir sin validar.