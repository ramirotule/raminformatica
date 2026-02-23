import { Suspense } from 'react'
import { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import { dict } from '@/lib/dict'
import type { ProductWithDetails, Category, Brand } from '@/lib/database.types'
import ProductosClient from './ProductosClient'

export const metadata: Metadata = {
    title: 'Productos',
    description: 'Explorá nuestro catálogo completo de tecnología al mejor precio.',
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
            .limit(200),
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
                <div style={{ marginBottom: 48, textAlign: 'center' }}>
                    <h1 className="hero-title" style={{ fontSize: '3rem', marginBottom: 16 }}>
                        <span>{dict.nav.productos}</span>
                    </h1>
                    <p className="hero-desc" style={{ maxWidth: 600, marginInline: 'auto' }}>
                        {dict.productos.resultados(products.length)} disponibles
                    </p>
                </div>
                <Suspense fallback={<div>Cargando productos...</div>}>
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
