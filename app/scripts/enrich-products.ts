#!/usr/bin/env tsx
/**
 * enrich-products.ts
 *
 * Enriquece productos en Supabase con:
 *   - short_description (visual, emojis, por categoría)
 *   - long_description  (texto profesional para e-commerce)
 *   - Imágenes desde MercadoLibre
 *
 * Características:
 *   - Idempotente: no duplica ni sobreescribe datos ya existentes
 *   - Logs detallados por producto
 *   - Maneja errores por producto sin detener el proceso
 *
 * Uso: npm run enrich-products
 */

import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import * as dotenv from 'dotenv'
import * as path from 'path'

// ─── Env setup ───────────────────────────────────────────────────────────────

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const GEMINI_KEY    = process.env.GOOGLE_GENERATIVE_AI_API_KEY
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_KEY en .env.local')
  process.exit(1)
}
if (!GEMINI_KEY) {
  console.error('❌ Falta GOOGLE_GENERATIVE_AI_API_KEY en .env.local')
  process.exit(1)
}
if (!GOOGLE_CSE_ID) {
  console.error('❌ Falta GOOGLE_CSE_ID en .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const genAI    = new GoogleGenerativeAI(GEMINI_KEY)
const gemini   = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductRow {
  id:                string
  name:              string
  slug:              string
  short_description: string | null
  long_description:  string | null
  condition:         string | null
  tags:              string[] | null
  categories:        { name: string; slug: string } | null
  brands:            { name: string } | null
  product_images:    { id: string }[]
}

// ─── Category detection ───────────────────────────────────────────────────────

function detectCategory(p: ProductRow): string {
  const src = [p.name, p.categories?.name, p.categories?.slug, ...(p.tags ?? [])]
    .filter(Boolean).join(' ').toLowerCase()

  if (/macbook|notebook|laptop|ultrabook/.test(src))     return 'notebook'
  if (/iphone|smartphone|galaxy|celular/.test(src))       return 'celular'
  if (/ipad|tablet/.test(src))                             return 'tablet'
  if (/apple watch|smartwatch/.test(src))                 return 'smartwatch'
  if (/airpod|auricular|headphone|earphone|earbud|headset/.test(src)) return 'auricular'
  if (/playstation|xbox|nintendo|consola/.test(src))      return 'consola'
  if (/monitor|pantalla display/.test(src))               return 'monitor'
  if (/impresora|printer/.test(src))                      return 'impresora'
  if (/\bssd\b|\bhdd\b|disco/.test(src))                  return 'storage'
  if (/\bram\b|memoria/.test(src))                        return 'memoria'
  if (/procesador|\bcpu\b|ryzen|intel core/.test(src))    return 'procesador'
  if (/placa de video|gpu|nvidia|radeon/.test(src))        return 'gpu'
  if (/router|\bwifi\b|access point/.test(src))           return 'networking'
  if (/teclado|keyboard/.test(src))                       return 'teclado'
  if (/\bmouse\b/.test(src))                              return 'mouse'
  if (/cargador|charger|power bank/.test(src))            return 'accesorios'
  return 'electronico'
}

// ─── AI descriptions ──────────────────────────────────────────────────────────

async function generateDescriptions(
  p: ProductRow,
  catType: string,
  force = false
): Promise<{ short: string | null; long: string | null }> {
  const needsShort = force || !p.short_description
  const needsLong  = force || !p.long_description
  if (!needsShort && !needsLong) return { short: null, long: null }

  const brandName = p.brands?.name ?? ''
  const catName   = p.categories?.name ?? ''

  // Specs relevantes por categoría para guiar a Gemini
  const specsGuide: Record<string, string> = {
    celular:    'pantalla (tamaño, tipo, resolución, Hz), procesador, RAM, almacenamiento, cámara principal (MP, apertura, sensor), cámara frontal, batería (mAh), carga rápida (W), conectividad (5G/4G, WiFi, BT), protección (IP, gorilla glass), SO',
    notebook:   'pantalla (tamaño, tipo, resolución), procesador (modelo, núcleos, GHz), RAM (GB, tipo), almacenamiento (GB/TB, tipo SSD/HDD), GPU, batería (Wh/horas), puertos, peso, SO',
    tablet:     'pantalla (tamaño, tipo, resolución, Hz), procesador, RAM, almacenamiento, cámara trasera y frontal, batería, conectividad (WiFi, celular), stylus/teclado compatible',
    smartwatch: 'pantalla (tamaño, tipo), salud (sensores: SpO2, ECG, frecuencia cardíaca), GPS, batería (días de autonomía), resistencia al agua (ATM/IP), conectividad, compatibilidad iOS/Android',
    auricular:  'tipo (in-ear/over-ear), cancelación de ruido activa (dB si disponible), batería (horas auricular + estuche), driver (mm), conectividad (BT versión, códecs), micrófono, resistencia al agua',
    consola:    'tipo (portátil/sobremesa), pantalla (si portátil: tamaño, Hz), almacenamiento, resolución máxima, conectividad, controles incluidos, autonomía (si portátil)',
    monitor:    'tamaño (pulgadas), panel (IPS/VA/OLED), resolución, frecuencia (Hz), tiempo de respuesta (ms), HDR, conectividad (HDMI, DP, USB)',
    storage:    'tipo (SSD/HDD/NVMe), capacidad, velocidad lectura/escritura (MB/s), interfaz (SATA/NVMe/USB), factor de forma',
    gpu:        'modelo exacto, VRAM (GB, tipo), arquitectura, puertos de salida, TDP (W), clock base/boost',
    procesador: 'modelo exacto, núcleos/hilos, frecuencia base/boost, caché, socket, TDP, litografía',
  }

  const specsHint = specsGuide[catType] ?? 'specs técnicas principales del producto'

  const prompt = `Sos un experto en tecnología y redactor de e-commerce.
Usá tu conocimiento entrenado sobre este producto para obtener sus especificaciones técnicas reales.

Producto:
  Nombre    : ${p.name}
  Marca     : ${brandName || '(no especificada)'}
  Categoría : ${catName} (tipo: ${catType})
  Condición : ${p.condition ?? 'nuevo'}

IMPORTANTE: Buscá en tu conocimiento las specs reales de este modelo exacto.
Incluí valores concretos y verificables: números, medidas, nombres de sensores, versiones.
No uses frases genéricas. Si no conocés una spec con certeza, omitila.

Specs a priorizar para este tipo de producto: ${specsHint}

${needsShort ? `## TAREA 1 — short_description
Generá una ficha técnica visual, una spec por línea, con emoji al inicio.
Formato exacto de cada línea: [emoji] [Nombre spec]: [valor concreto]
Entre 8 y 12 líneas. Sin intro, sin cierre comercial.

Ejemplo de línea correcta: 📱 Pantalla: 6.78" AMOLED 144 Hz
Ejemplo de línea INCORRECTA: 📱 Pantalla de alta resolución

Envolvé el resultado en: <short_description>…</short_description>
` : ''}

${needsLong ? `## TAREA 2 — long_description
Descripción profesional para ficha de producto en tienda online.
- Español neutro, tono comercial técnico y creíble
- Entre 150 y 280 palabras
- Incluir specs clave con valores reales
- Sin frases vacías como "excelente calidad"
- Sin HTML

Envolvé el resultado en: <long_description>…</long_description>
` : ''}`

  const maxRetries = 3
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await gemini.generateContent(prompt)
      const text   = result.response.text()

      const short = needsShort
        ? (text.match(/<short_description>([\s\S]*?)<\/short_description>/)?.[1]?.trim() ?? null)
        : null
      const long = needsLong
        ? (text.match(/<long_description>([\s\S]*?)<\/long_description>/)?.[1]?.trim() ?? null)
        : null

      return { short, long }
    } catch (err) {
      const msg = (err as Error).message
      // Parse retry delay from 429 response
      const retryMatch = msg.match(/Please retry in ([\d.]+)s/)
      const retrySec   = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 2 : attempt * 15

      if (attempt < maxRetries && msg.includes('429')) {
        console.log(`  ⏳ Rate limit, esperando ${retrySec}s antes de reintentar (intento ${attempt}/${maxRetries})...`)
        await new Promise(r => setTimeout(r, retrySec * 1000))
      } else {
        console.error(`  ⚠️  Error llamando a Gemini: ${msg.split('\n')[0]}`)
        return { short: null, long: null }
      }
    }
  }
  return { short: null, long: null }
}

// ─── Google Image Search ──────────────────────────────────────────────────────

interface GoogleImageResult {
  items?: { link: string; image?: { thumbnailLink: string } }[]
}

async function fetchProductImages(query: string, maxImages = 5): Promise<string[]> {
  const urls: string[] = []
  try {
    const params = new URLSearchParams({
      key:        GEMINI_KEY!,   // reutilizamos la misma Google API key
      cx:         GOOGLE_CSE_ID!,
      q:          query,
      searchType: 'image',
      num:        String(maxImages),
      imgType:    'photo',
      imgSize:    'large',
      safe:       'active',
    })

    const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`)
    if (!res.ok) {
      const err = await res.json() as { error?: { message: string } }
      console.error(`  ⚠️  Google CSE error: ${err.error?.message ?? res.status}`)
      return urls
    }

    const data = await res.json() as GoogleImageResult
    for (const item of data.items ?? []) {
      if (urls.length >= maxImages) break
      if (item.link) urls.push(item.link)
    }
  } catch (err) {
    console.error(`  ⚠️  Error buscando imágenes: ${(err as Error).message}`)
  }
  return urls
}

// ─── Insert images ────────────────────────────────────────────────────────────

async function insertImages(
  productId: string,
  productName: string,
  urls: string[]
): Promise<number> {
  let inserted = 0
  for (let i = 0; i < urls.length; i++) {
    const { error } = await supabase.from('product_images').insert({
      product_id:   productId,
      storage_path: `external/${productId}/${i}`,
      public_url:   urls[i],
      alt:          productName,
      sort_order:   i + 1,
      is_primary:   i === 0,
    })
    if (error) {
      console.error(`  ⚠️  Error insertando imagen ${i + 1}: ${error.message}`)
    } else {
      inserted++
    }
  }
  return inserted
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const forceRegen = process.argv.includes('--force')
  if (forceRegen) console.log('⚡ Modo --force: se re-generan todas las descripciones\n')
  console.log('🚀 Iniciando enriquecimiento de productos...\n')

  const { data: products, error } = await supabase
    .from('products')
    .select(`
      id, name, slug, short_description, long_description, condition, tags,
      categories (name, slug),
      brands     (name),
      product_images (id)
    `)
    .eq('active', true)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('❌ Error al leer productos:', error.message)
    process.exit(1)
  }

  const total = products?.length ?? 0
  console.log(`📦 Productos activos encontrados: ${total}\n${'─'.repeat(60)}`)

  let processed = 0, skipped = 0, errors = 0

  for (const raw of products ?? []) {
    // Cast since Supabase returns joined objects
    const p = raw as unknown as ProductRow

    console.log(`\n🔍 [${processed + skipped + errors + 1}/${total}] ${p.name}`)

    try {
      const catType    = detectCategory(p)
      const needsShort = forceRegen || !p.short_description
      const needsLong  = forceRegen || !p.long_description
      const hasImages  = p.product_images?.length > 0

      console.log(`  📂 Categoría detectada : ${catType}`)
      console.log(`  📝 short_description   : ${!p.short_description ? 'falta' : forceRegen ? '🔄 re-generando' : '✅ ya tiene'}`)
      console.log(`  📄 long_description    : ${!p.long_description  ? 'falta' : forceRegen ? '🔄 re-generando' : '✅ ya tiene'}`)
      console.log(`  🖼️  imágenes            : ${hasImages  ? `✅ ya tiene (${p.product_images.length})` : 'falta'}`)

      if (!needsShort && !needsLong && hasImages) {
        console.log('  ⏭️  Todo completo, salteando')
        skipped++
        continue
      }

      // ── Descriptions ──
      if (needsShort || needsLong) {
        const { short, long } = await generateDescriptions(p, catType, forceRegen)
        const updates: Record<string, string> = {}

        if (short) { updates.short_description = short; console.log('  ✅ short_description generada') }
        else if (needsShort) console.log('  ⚠️  No se pudo generar short_description')

        if (long)  { updates.long_description  = long;  console.log('  ✅ long_description generada')  }
        else if (needsLong)  console.log('  ⚠️  No se pudo generar long_description')

        if (Object.keys(updates).length > 0) {
          const { error: ue } = await supabase.from('products').update(updates).eq('id', p.id)
          if (ue) console.error(`  ❌ Error guardando descripciones: ${ue.message}`)
        }
      }

      // ── Images ──
      if (!hasImages) {
        // Evitar duplicar la marca si el nombre del producto ya la incluye
        const brand = p.brands?.name ?? ''
        const nameAlreadyHasBrand = brand && p.name.toLowerCase().startsWith(brand.toLowerCase())
        const query = nameAlreadyHasBrand || !brand ? p.name : `${brand} ${p.name}`
        console.log(`  🔎 Buscando imágenes: "${query}"`)

        const urls = await fetchProductImages(query)
        console.log(`  🖼️  Imágenes encontradas: ${urls.length}`)

        if (urls.length > 0) {
          const n = await insertImages(p.id, p.name, urls)
          console.log(`  ✅ Imágenes insertadas: ${n}`)
        } else {
          console.log('  ⚠️  Sin imágenes disponibles en ML para este producto')
        }
      }

      processed++
    } catch (err) {
      console.error(`  ❌ Error inesperado: ${(err as Error).message}`)
      errors++
    }

    // Pausa entre productos para no saturar APIs
    await new Promise(r => setTimeout(r, 600))
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log('✅ Proceso completado')
  console.log(`  📦 Procesados con cambios : ${processed}`)
  console.log(`  ⏭️  Salteados (completos)  : ${skipped}`)
  console.log(`  ❌ Errores                : ${errors}`)
}

main().catch(err => {
  console.error('❌ Error fatal:', err)
  process.exit(1)
})
