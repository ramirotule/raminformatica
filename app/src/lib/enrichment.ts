import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { slugify, smartCapitalize } from './utils'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const GEMINI_KEY    = process.env.GOOGLE_GENERATIVE_AI_API_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const genAI    = new GoogleGenerativeAI(GEMINI_KEY)

const gemini = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
})

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

interface EnrichmentResult {
  short: string | null
  long: string | null
  tags: string[] | null
}

export function detectCategory(p: ProductRow): string {
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

export async function generateDescriptions(
  p: ProductRow,
  catType: string
): Promise<EnrichmentResult> {
  const brandName = p.brands?.name ?? ''
  const catName   = p.categories?.name ?? ''

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
    monopatin:  'autonomía (km), velocidad máxima (km/h), motor (W), batería (V/Ah), tiempo de carga, peso máximo soportado, frenos, ruedas (pulgadas), plegable',
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

## TAREA: Generar datos del producto
Generá un objeto JSON con los siguientes campos:
1. "long_description": Una ficha técnica visual, una spec por línea, con emoji al inicio. Entre 8 y 12 líneas. Formato: "[emoji] [Nombre]: [Valor]".
2. "short_description": Descripción profesional tipo e-commerce, entre 150 y 250 palabras, tono comercial técnico. Sin HTML.
3. "tags": Array de strings con entre 5 y 10 palabras clave (marca, modelo, variaciones).

Responde ÚNICAMENTE con el objeto JSON puro, sin bloques de código markdown ni texto adicional.
Ejemplo: {"long_description": "...", "short_description": "...", "tags": ["...", "..."]}
`

  try {
    const result = await gemini.generateContent(prompt)
    const text   = result.response.text()

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No se encontró un JSON válido en la respuesta de Gemini');
    
    const data = JSON.parse(jsonMatch[0])

    const short = data.short_description || data.short || null
    const long = data.long_description || data.long || null
    const tags = Array.isArray(data.tags) 
        ? data.tags.filter((t: any) => typeof t === 'string').map((t: string) => t.trim().toLowerCase()) 
        : null

    return { short, long, tags }
  } catch (err) {
    console.error('Error llamando a Gemini:', err)
    return { short: null, long: null, tags: null }
  }
}

async function fetchProductImages(query: string, maxImages = 5): Promise<string[]> {
  const urls: string[] = []
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Referer':    'https://duckduckgo.com/',
    }

    const initRes = await fetch(
      `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
      { headers }
    )
    const html = await initRes.text()
    const vqdMatch = html.match(/vqd=['"]([^'"]+)['"]/)
    if (!vqdMatch) return urls
    const vqd = vqdMatch[1]

    const imgRes = await fetch(
      `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&vqd=${vqd}&p=1&o=json&l=us-en`,
      { headers }
    )
    if (!imgRes.ok) return urls

    const data = await imgRes.json() as any
    for (const item of data.results ?? []) {
      if (urls.length >= maxImages) break
      if (item.image && (item.width ?? 0) >= 400) urls.push(item.image)
    }

    if (urls.length < maxImages) {
      for (const item of data.results ?? []) {
        if (urls.length >= maxImages) break
        if (item.image && !urls.includes(item.image)) urls.push(item.image)
      }
    }
  } catch (err) {
    console.error(`Error buscando imágenes: ${(err as Error).message}`)
  }
  return urls
}

export async function enrichSingleProduct(productId: string, force = true) {
  try {
    const { data: raw, error } = await supabase
      .from('products')
      .select(`
        id, name, slug, short_description, long_description, condition, tags,
        categories (name, slug),
        brands     (name),
        product_images (id)
      `)
      .eq('id', productId)
      .single()

    if (error || !raw) throw new Error('Producto no encontrado')
    const p = raw as unknown as ProductRow

    const catType = detectCategory(p)
    const needsDesc = force || !p.short_description || !p.long_description || !p.tags || p.tags.length === 0
    const needsImages = force || !p.product_images || p.product_images.length === 0

    const updates: any = {}

    if (needsDesc) {
      const { short, long, tags } = await generateDescriptions(p, catType)
      if (long) updates.long_description = long
      if (short) updates.short_description = short
      if (tags && tags.length > 0) updates.tags = tags
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from('products').update(updates).eq('id', p.id)
    }

    if (needsImages) {
      // Si forzamos, eliminamos las imágenes anteriores vinculadas a URLs externas para no duplicar
      if (force && p.product_images.length > 0) {
        await supabase.from('product_images').delete().eq('product_id', productId).ilike('storage_path', 'external/%')
      }

      const brand = p.brands?.name ?? ''
      const nameAlreadyHasBrand = brand && p.name.toLowerCase().startsWith(brand.toLowerCase())
      const baseName = nameAlreadyHasBrand || !brand ? p.name : `${brand} ${p.name}`
      const cleanName = baseName.replace(/\s+\d+\/\d+\s*(gb|tb)?/gi, '').replace(/\s+(esim|5g|4g)/gi, '').trim()
      const query = `${cleanName} official product photo`
      
      const urls = await fetchProductImages(query)
      if (urls.length > 0) {
        // Encontrar el sort_order actual más alto para no pisar imágenes locales si existen
        const { data: existingImgs } = await supabase.from('product_images').select('sort_order').eq('product_id', productId).order('sort_order', { ascending: false }).limit(1)
        let nextSort = ((existingImgs as any)?.[0]?.sort_order ?? 0) + 1

        for (let i = 0; i < urls.length; i++) {
          await supabase.from('product_images').insert({
            product_id: productId,
            storage_path: `external/${productId}/${i}`,
            public_url: urls[i],
            alt: p.name,
            sort_order: nextSort++,
            is_primary: i === 0 && p.product_images.length === 0,
          })
        }
      }
    }

    return { success: true }
  } catch (err: any) {
    console.error(`Error enriqueciendo producto ${productId}:`, err)
    return { success: false, error: err.message }
  }
}
