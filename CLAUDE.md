# RAM Informática — Orquestador Principal

## IDENTIDAD DEL PROYECTO
Ecommerce de tecnología. Marca: **RAM Informática**.
Stack: Next.js 16 App Router · TypeScript · Supabase · Tailwind CSS · Framer Motion.

## AGENTES DISPONIBLES
Antes de ejecutar cualquier tarea, identificá qué agente debe resolverla:

| Agente | Responsabilidad | Contexto |
|--------|----------------|----------|
| **enrichment** | Descripciones e imágenes de productos | `.claude/agents/enrichment/CLAUDE.md` |
| **marketing** | Redes sociales, posicionamiento, visibilidad de marca | `.claude/agents/marketing/CLAUDE.md` |

## REGLAS GLOBALES
- UI y rutas siempre en **español**
- Source of truth: **Supabase** (nunca mock data permanente)
- Arquitectura: escalable, modular, tipada
- Mobile-first · Animaciones sutiles
- No hardcodear strings (usar `dict.ts`)
- Nunca asumir columnas sin validar contra el schema real

## FRONTEND
- Componentes reutilizables en `/app/src/components/`
- Leer productos desde Supabase, nunca desde JSON local
- Dólar blue: consumir `https://dolarapi.com/v1/dolares/blue` cada 10 min

## BACKEND / SCRIPTS
- Cliente Supabase: `/app/src/lib/supabase.ts` (anon) y `/lib/supabase.ts` (admin)
- Scripts utilitarios: `/app/scripts/`
- Env vars: `/app/.env.local`

## DISEÑO
- Estilo: ecommerce moderno tipo Apple Store
- Panel admin: `/app/src/app/adminram/` — CRUD completo con control de stock
