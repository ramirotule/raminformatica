import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { ProductWithDetails } from '@/lib/database.types'
import ProductDetailClient from './ProductDetailClient'

interface ProductPageProps {
    params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ProductPageProps) {
    const { slug } = await params
    const { data: product } = await supabase
        .from('products')
        .select('name, short_description')
        .eq('slug', slug)
        .single()

    if (!product) return { title: 'Producto no encontrado' }

    return {
        title: product.name,
        description: product.short_description,
    }
}

export default async function ProductPage({ params }: ProductPageProps) {
    const { slug } = await params

    const { data: product } = await supabase
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
        .eq('slug', slug)
        .single()

    if (!product) {
        notFound()
    }

    return (
        <div className="section" style={{ paddingTop: '100px' }}>
            <div className="container">
                <ProductDetailClient product={product as unknown as ProductWithDetails} />
            </div>
        </div>
    )
}
