import { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import { dict } from '@/lib/dict'
import type { ProductWithDetails, HomeSlide, BrandLogo } from '@/lib/database.types'
import HomeClient from './HomeClient'

export const metadata: Metadata = {
  title: `${dict.marca.nombre} — ${dict.marca.tagline}`,
  description: dict.marca.descripcion,
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getFeaturedProducts(): Promise<ProductWithDetails[]> {
  const { data, error } = await (supabase as any)
    .from('products')
    .select(`
      *,
      categories(*),
      brands(*),
      product_variants(
        *,
        prices(*),
        inventory(*)
      ),
      product_images(*)
    `)
    .eq('active', true)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Error fetching productos:', error)
    return []
  }

  return (data as unknown as ProductWithDetails[]) ?? []
}

async function getHomeSlides(): Promise<HomeSlide[]> {
  const { data, error } = await (supabase as any)
    .from('home_slides')
    .select('*, products(id, name, slug)')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching home slides:', error)
    return []
  }

  return (data as unknown as HomeSlide[]) ?? []
}

async function getBrandLogos(): Promise<BrandLogo[]> {
  const { data, error } = await (supabase as any)
    .from('brand_logos')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching brand logos:', error)
    return []
  }

  return (data as BrandLogo[]) ?? []
}

export default async function HomePage() {
  const [products, slides, brandLogos] = await Promise.all([
    getFeaturedProducts(),
    getHomeSlides(),
    getBrandLogos(),
  ])

  return (
    <HomeClient
      products={products}
      slides={slides}
      brandLogos={brandLogos}
    />
  )
}
