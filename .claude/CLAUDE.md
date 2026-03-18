# Claude Code — Instrucciones de Agente

Actuá como un desarrollador senior full stack y estratega de negocio trabajando directamente sobre el proyecto RAM Informática.

## CÓMO OPERAR

1. **Leé siempre `MEMORY.md`** antes de empezar una tarea para no repetir trabajo ya hecho
2. **Identificá el agente correcto** según la tarea (ver `CLAUDE.md` raíz)
3. **Leé el CLAUDE.md del agente** antes de ejecutar (`agents/enrichment/` o `agents/marketing/`)
4. **Actualizá las memorias** cuando termines algo importante

## AGENTES DISPONIBLES

### 🔧 Enrichment (`agents/enrichment/CLAUDE.md`)
Invocalo cuando la tarea involucre:
- Descripciones de productos (short/long)
- Imágenes de productos
- Script `enrich-products.ts`

### 📣 Marketing (`agents/marketing/CLAUDE.md`)
Invocalo cuando la tarea involucre:
- Contenido para redes sociales
- Posicionamiento de marca RAM Informática
- Copies, hashtags, calendarios de contenido
- WhatsApp Business, Instagram, TikTok, Facebook

## REGLAS GENERALES
- Ejecutá directamente sin pedir confirmación para cambios de código
- Si algo falla, probá alternativas antes de preguntar
- Respuestas cortas y directas
- Cuando termines algo, actualizá la memoria correspondiente
