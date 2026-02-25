'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import ProductCard from '@/components/ProductCard'
import { dict } from '@/lib/dict'
import { getPriceUSD } from '@/lib/utils'
import type { ProductWithDetails, Category, Brand } from '@/lib/database.types'
import { SearchableSelect } from '@/components/SearchableSelect'

interface ProductosClientProps {
    products: ProductWithDetails[]
    categories: Category[]
    brands: Brand[]
}

type SortOption = 'reciente' | 'precio-asc' | 'precio-desc' | 'nombre'

import { useSearch } from '@/context/SearchContext'

export default function ProductosClient({ products, categories, brands }: ProductosClientProps) {
    const searchParams = useSearchParams()
    const {
        searchQuery: search,
        setSearchQuery: setSearch,
        showFilters,
        setShowFilters,
        sortBy,
        setSortBy
    } = useSearch()
    const [selectedCategory, setSelectedCategory] = useState<string>(searchParams.get('categoria') ?? '')
    const [selectedBrand, setSelectedBrand] = useState<string>('')
    const [selectedCondition, setSelectedCondition] = useState<string>('')

    // Sync URL params
    useEffect(() => {
        const cat = searchParams.get('categoria')
        if (cat) setSelectedCategory(cat)

        const marca = searchParams.get('marca')
        if (marca) setSelectedBrand(marca)

        const q = searchParams.get('q')
        if (q) setSearch(q)

        // Auto-show filters if a brand or category came from the URL
        if (cat || marca) setShowFilters(true)
    }, [searchParams, setSearch, setShowFilters])

    const filtered = useMemo(() => {
        let list = [...products]

        if (search.trim()) {
            const q = search.toLowerCase()
            list = list.filter(
                (p) =>
                    p.name.toLowerCase().includes(q) ||
                    (p.brands?.name || '').toLowerCase().includes(q) ||
                    p.short_description?.toLowerCase().includes(q) ||
                    p.tags?.some(tag => tag.toLowerCase().includes(q))
            )
        }

        if (selectedCategory) {
            list = list.filter((p) => p.categories?.slug === selectedCategory)
        }

        if (selectedBrand) {
            list = list.filter((p) => p.brands?.slug === selectedBrand)
        }

        if (selectedCondition) {
            list = list.filter((p) => p.condition === selectedCondition)
        }

        // Ordenar
        list.sort((a, b) => {
            if (sortBy === 'nombre') {
                return a.name.localeCompare(b.name, 'es')
            }
            if (sortBy === 'precio-asc' || sortBy === 'precio-desc') {
                const pa = getPriceUSD(a.product_variants?.[0]?.prices, a.price_usd) ?? Infinity
                const pb = getPriceUSD(b.product_variants?.[0]?.prices, b.price_usd) ?? Infinity
                return sortBy === 'precio-asc' ? pa - pb : pb - pa
            }
            // reciente (default: ya vienen ordenados por created_at desc)
            return 0
        })

        return list
    }, [products, search, selectedCategory, selectedBrand, selectedCondition, sortBy])

    const resetFilters = () => {
        setSearch('')
        setSelectedCategory('')
        setSelectedBrand('')
        setSelectedCondition('')
        setSortBy('reciente')
    }

    const hasFilters = !!(search || selectedCategory || selectedBrand || selectedCondition)

    return (
        <div>
            {/* Resultados count */}
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 20 }}>
                {dict.productos.resultados(filtered.length)}
            </p>

            {/* ─── Filtros expandidos ─────────────────────────── */}
            {showFilters && (
                <div
                    className="animate-fade-in"
                    style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 20,
                        marginBottom: 24,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: 16,
                        position: 'relative',
                        zIndex: 50
                    }}
                >
                    {/* Categoría */}
                    <div className="form-group" style={{ zIndex: 19, position: 'relative' }}>
                        <label className="form-label" htmlFor="filter-category">Categoría</label>
                        <SearchableSelect
                            id="filter-category"
                            value={selectedCategory}
                            onChange={(v) => setSelectedCategory(v)}
                            options={[
                                { value: '', label: 'Todas las categorías' },
                                ...categories.map(cat => ({ value: cat.slug, label: cat.name }))
                            ]}
                            placeholder="Todas las categorías"
                        />
                    </div>

                    {/* Marca */}
                    <div className="form-group" style={{ zIndex: 18, position: 'relative' }}>
                        <label className="form-label" htmlFor="filter-brand">Marca</label>
                        <SearchableSelect
                            id="filter-brand"
                            value={selectedBrand}
                            onChange={(v) => setSelectedBrand(v)}
                            options={[
                                { value: '', label: 'Todas las marcas' },
                                ...brands.map(brand => ({ value: brand.slug, label: brand.name }))
                            ]}
                            placeholder="Todas las marcas"
                        />
                    </div>

                    {/* Condición */}
                    <div className="form-group" style={{ zIndex: 17, position: 'relative' }}>
                        <label className="form-label" htmlFor="filter-condition">Condición</label>
                        <SearchableSelect
                            id="filter-condition"
                            value={selectedCondition}
                            onChange={(v) => setSelectedCondition(v)}
                            options={[
                                { value: '', label: 'Todas' },
                                { value: 'new', label: 'Nuevo' },
                                { value: 'oem', label: 'OEM' },
                                { value: 'refurbished', label: 'Reacondicionado' },
                                { value: 'used', label: 'Usado' },
                            ]}
                            placeholder="Todas"
                        />
                    </div>

                    {/* Reset */}
                    {hasFilters && (
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <button
                                id="reset-filters"
                                className="btn btn-ghost"
                                onClick={resetFilters}
                                style={{ width: '100%' }}
                            >
                                <X size={14} />
                                Limpiar filtros
                            </button>
                        </div>
                    )}
                </div>
            )}



            {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
                    <p style={{ fontSize: '3rem', marginBottom: 16 }}>🔍</p>
                    <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Sin resultados</p>
                    <button className="btn btn-secondary" style={{ marginTop: 24 }} onClick={resetFilters}>
                        Ver todos
                    </button>
                </div>
            ) : (
                <div className="products-grid">
                    {filtered.map((product) => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
            )}
        </div>
    )
}
