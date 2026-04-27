import { Suspense } from 'react'
import { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import type { ProductWithDetails, Category, Brand } from '@/lib/database.types'
import ProductosClient from '../ProductosClient'
import { notFound } from 'next/navigation'

interface Props {
    params: Promise<{ categoria: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { categoria } = await params
    const { data: category } = await (supabase as any)
        .from('categories')
        .select('name, description')
        .eq('slug', categoria)
        .single()

    if (!category) return { title: 'Categoría no encontrada' }

    return {
        title: `${category.name} en Santa Rosa, La Pampa | RAM Informática`,
        description: category.description || `Comprá ${category.name} al mejor precio en Santa Rosa, La Pampa. RAM Informática — Tu tienda de tecnología de confianza.`,
        keywords: [`${category.name} Santa Rosa`, `${category.name} La Pampa`, category.name, 'RAM Informática', 'comprar', 'precio'],
        alternates: {
            canonical: `https://raminformatica.com.ar/productos/${categoria}`,
        },
    }
}

async function getCategoryData(slug: string) {
    const { data: category } = await (supabase as any)
        .from('categories')
        .select('*')
        .eq('slug', slug)
        .single()

    if (!category) return null

    const [productsRes, categoriesRes, brandsRes] = await Promise.all([
        (supabase as any)
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
            .eq('category_id', category.id)
            .order('created_at', { ascending: false })
            .order('sort_order', { foreignTable: 'product_images', ascending: true })
            .limit(200),
        (supabase as any).from('categories').select('*').order('name'),
        (supabase as any).from('brands').select('*').order('name'),
    ])

    return {
        category,
        products: (productsRes.data as unknown as ProductWithDetails[]) ?? [],
        categories: categoriesRes.data ?? [],
        brands: brandsRes.data ?? [],
    }
}

export default async function ProductosPorCategoriaPage({ params }: Props) {
    const { categoria } = await params
    const data = await getCategoryData(categoria)

    if (!data) notFound()

    const { category, products, categories, brands } = data

    return (
        <div className="section">
            <div className="container">
                <Suspense fallback={<div style={{ textAlign: 'center', padding: '100px 0' }}>Cargando productos...</div>}>
                    <ProductosClient
                        products={products}
                        categories={categories as Category[]}
                        brands={brands as Brand[]}
                        title={category.name}
                        description={category.description || ''}
                    />
                </Suspense>
            </div>
        </div>
    )
}
