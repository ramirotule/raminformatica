import { Suspense } from 'react'
import { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import { dict } from '@/lib/dict'
import type { ProductWithDetails, Category, Brand } from '@/lib/database.types'
import ProductosClient from './ProductosClient'

export const metadata: Metadata = {
    title: 'Productos de Tecnología en Santa Rosa, La Pampa',
    description: 'Catálogo completo de tecnología en RAM Informática: iPhones, PlayStation, Samsung, Notebooks y más al mejor precio en Santa Rosa y envíos a toda Argentina.',
}

export const revalidate = 60

async function getData() {
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
            .order('created_at', { ascending: false })
            .order('sort_order', { foreignTable: 'product_images', ascending: true })
            .limit(1000),
        (supabase as any).from('categories').select('*').order('name'),
        (supabase as any).from('brands').select('*').order('name'),
    ])

    return {
        products: (productsRes.data as unknown as ProductWithDetails[]) ?? [],
        categories: categoriesRes.data ?? [],
        brands: brandsRes.data ?? [],
    }
}

export default async function ProductosPage() {
    const { products, categories, brands } = await getData()

    return (
        <div className="section">
            <div className="container">
                <Suspense fallback={<div style={{ textAlign: 'center', padding: '100px 0' }}>Cargando productos...</div>}>
                    <ProductosClient
                        products={products}
                        categories={categories as Category[]}
                        brands={brands as Brand[]}
                    />
                </Suspense>
            </div>
        </div>
    )
}
