---
name: APIs y credenciales del proyecto
description: Qué APIs están configuradas, cuáles funcionan y dónde están las keys
type: reference
---

Todas las keys están en `/app/.env.local`.

| Variable | Servicio | Estado |
|----------|---------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | ✅ activo |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon | ✅ activo |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin | ⚠️ no configurado aún |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini 2.5 Flash | ✅ activo, billing habilitado |
| `GOOGLE_CSE_ID` | Google Custom Search | ❌ bloqueado en el proyecto |
| `DATABASE_URL` | Postgres directo | ⚠️ password placeholder |

## Supabase
- URL: `https://vkbnxmmpxrxsjmjabqcy.supabase.co`
- RLS: estado desconocido — si hay errores de escritura con anon key, agregar SERVICE_ROLE_KEY

## Google Cloud
- Proyecto ID: `1075203392874`
- Gemini API: habilitada y funcionando
- Custom Search API: habilitada pero bloqueada (restricción de proyecto)
- Billing: habilitado

## DuckDuckGo Image Search
- No requiere API key
- Endpoint: `https://duckduckgo.com/i.js`
- Requiere token `vqd` obtenido de la página de búsqueda
- Funciona correctamente desde scripts Node.js

## Dólar blue
- API: `https://dolarapi.com/v1/dolares/blue`
- Sin auth, pública
- Usada en el frontend cada 10 minutos
