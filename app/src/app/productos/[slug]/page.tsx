import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { ProductWithDetails } from '@/lib/database.types'
import ProductDetailClient from './ProductDetailClient'
import { Metadata } from 'next'

interface ProductPageProps {
    params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
    const { slug } = await params
    const { data: product } = await (supabase as any)
        .from('products')
        .select('name, short_description, product_images(public_url)')
        .eq('slug', slug)
        .single()

    if (!product) return { title: 'Producto no encontrado' }

    const imageUrl = (product as any).product_images?.[0]?.public_url

    return {
        title: `${(product as any).name} | RAM Informática`,
        description: (product as any).short_description || `Comprar ${(product as any).name} al mejor precio en RAM Informática Argentina.`,
        openGraph: {
            title: (product as any).name,
            description: (product as any).short_description,
            images: imageUrl ? [{ url: imageUrl }] : [],
            type: 'article',
        },
        twitter: {
            card: 'summary_large_image',
            title: (product as any).name,
            description: (product as any).short_description,
            images: imageUrl ? [imageUrl] : [],
        },
    }
}

export default async function ProductPage({ params }: ProductPageProps) {
    const { slug } = await params

    const { data: product } = await (supabase as any)
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

    const typedProduct = product as unknown as ProductWithDetails
    const mainImage = typedProduct.product_images?.[0]?.public_url
    const variant = typedProduct.product_variants?.[0]
    const price = variant?.prices?.[0]?.amount

    // JSON-LD Structured Data
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: typedProduct.name,
        image: typedProduct.product_images?.map(img => img.public_url),
        description: typedProduct.short_description,
        brand: {
            '@type': 'Brand',
            name: typedProduct.brands?.name || 'Genérico',
        },
        offers: {
            '@type': 'Offer',
            price: price || 0,
            priceCurrency: 'USD',
            availability: (variant?.inventory?.[0]?.qty_available ?? 0) > 0
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
            url: `https://raminformatica.com.ar/productos/${slug}`,
        }
    }

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <div className="section" style={{ paddingTop: '100px' }}>
                <div className="container">
                    <ProductDetailClient product={typedProduct} />
                </div>
            </div>
        </>
    )
}

