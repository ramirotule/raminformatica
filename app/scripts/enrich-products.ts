#!/usr/bin/env tsx
/**
 * enrich-products.ts
 *
 * Versión sincronizada con enrichment.ts para asegurar coherencia en toda la app.
 */

import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const GEMINI_KEY    = process.env.GOOGLE_GENERATIVE_AI_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_KEY) {
  console.error('❌ Faltan variables de entorno en .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const genAI    = new GoogleGenerativeAI(GEMINI_KEY)
const gemini   = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

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
  if (/monopatin|scooter|kickboot/.test(src))             return 'monopatin'
  return 'electronico'
}

async function generateDescriptions(p: ProductRow, catType: string): Promise<any> {
  const brandName = p.brands?.name ?? ''
  const catName   = p.categories?.name ?? ''

  const specsGuide: Record<string, string> = {
    celular:    'pantalla, procesador, RAM, almacenamiento, cámaras, batería, carga, conectividad',
    notebook:   'pantalla, CPUs, RAM, SSD, GPU, batería, puertos, SO',
    monopatin:  'autonomía (km), velocidad (km/h), motor (W), batería, frenos, ruedas',
    smartwatch: 'pantalla, sensores salud, GPS, batería, resistencia agua, conectividad',
  }

  const specsHint = specsGuide[catType] ?? 'especificaciones técnicas principales'

  const prompt = `Sos un experto en tecnología y redactor de e-commerce. Generá datos reales del producto:
Producto: ${p.name}
Marca: ${brandName}
Categoría: ${catName} (tipo: ${catType})

## TAREA: Generar datos del producto
Generá un objeto JSON con los siguientes campos:
1. "long_description": Una ficha técnica visual, una spec por línea, con emoji al inicio. Entre 8 y 12 líneas. Formato: "[emoji] [Nombre]: [Valor]".
    - Úsalo para specs concretas (ej: 📱 Pantalla: 6.78").
2. "short_description": Descripción profesional tipo e-commerce, entre 150 y 250 palabras, tono comercial técnico. Sin HTML.
3. "tags": Array de strings con entre 5 y 10 palabras clave.

Responde ÚNICAMENTE con el objeto JSON puro.
Ejemplo: {"long_description": "...", "short_description": "...", "tags": ["...", "..."]}
`

  try {
    const result = await gemini.generateContent(prompt)
    const text   = result.response.text()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    return JSON.parse(jsonMatch[0])
  } catch (err) {
    console.error(`  ⚠️  Error en Gemini para ${p.name}:`, (err as Error).message)
    return null
  }
}

async function main() {
  const force = process.argv.includes('--force')
  console.log(`🚀 Iniciando enriquecimiento... (Modo force: ${force})\n`)

  const { data: products, error } = await supabase
    .from('products')
    .select('*, categories(name, slug), brands(name), product_images(id)')
    .eq('active', true)

  if (error || !products) { console.error('Error:', error); return }

  for (const raw of products) {
    const p = raw as unknown as ProductRow
    console.log(`🔍 [${p.id}] ${p.name}`)

    const needsDesc = force || !p.short_description || !p.long_description
    if (needsDesc) {
      const data = await generateDescriptions(p, detectCategory(p))
      if (data) {
        const updates: any = {}
        if (data.long_description) updates.long_description = data.long_description
        if (data.short_description) updates.short_description = data.short_description
        if (data.tags) updates.tags = data.tags

        await supabase.from('products').update(updates).eq('id', p.id)
        console.log('   ✅ Descripciones generadas')
      }
    } else {
      console.log('   ⏭️  Ya tiene descripciones')
    }
    
    // Pausa para evitar 429
    await new Promise(r => setTimeout(r, 800))
  }
}

main()
