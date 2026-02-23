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
        supabase
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
        supabase.from('categories').select('*').order('name'),
        supabase.from('brands').select('*').order('name'),
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
                <div style={{ marginBottom: 32 }}>
                    <h1 className="section-title">{dict.nav.productos}</h1>
                    <p className="section-subtitle">
                        {dict.productos.resultados(products.length)} disponibles
                    </p>
                </div>
                <ProductosClient
                    products={products}
                    categories={categories as Category[]}
                    brands={brands as Brand[]}
                />
            </div>
        </div>
    )
}
