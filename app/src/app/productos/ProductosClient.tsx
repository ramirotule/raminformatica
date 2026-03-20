'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, SlidersHorizontal, X, ChevronLeft, ChevronRight } from 'lucide-react'
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
import { trackSearch, trackFilterApply } from '@/lib/analytics'

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
    const [visibleItems, setVisibleItems] = useState(20)
    const ITEMS_PER_STEP = 20

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
            const terms = search.toLowerCase().trim().split(/\s+/).filter(t => t !== '')
            list = list.filter(p => {
                const searchableText = [
                    p.name.toLowerCase(),
                    (p.brands?.name || '').toLowerCase(),
                    (p.categories?.name || '').toLowerCase(),
                    (p.short_description || '').toLowerCase(),
                    (p.long_description || '').toLowerCase(),
                    ...(p.tags || []).map(t => t.toLowerCase()),
                    p.product_variants?.[0]?.storage?.toLowerCase() || '',
                    p.product_variants?.[0]?.color?.toLowerCase() || '',
                    p.product_variants?.[0]?.connectivity?.toLowerCase() || ''
                ].join(' ')
                return terms.every(term => {
                    // Si el término es puramente numérico (ej: "8"), queremos evitar que coincida con "128"
                    if (/^\d+$/.test(term)) {
                        const regex = new RegExp(`(^|[^0-9])${term}([^0-9]|$)`, 'i')
                        return regex.test(searchableText)
                    }
                    return searchableText.includes(term)
                })
            })
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
        setVisibleItems(20)
    }

    // Reset visible items when filters change
    useEffect(() => {
        setVisibleItems(20)
    }, [search, selectedCategory, selectedBrand, selectedCondition, sortBy])

    const hasMore = visibleItems < filtered.length
    const paginatedProducts = useMemo(() => {
        return filtered.slice(0, visibleItems)
    }, [filtered, visibleItems])

    const handleShowMore = () => {
        setVisibleItems(prev => prev + ITEMS_PER_STEP)
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
                            onChange={(v) => { setSelectedCategory(v); if (v) trackFilterApply('categoria', v) }}
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
                            onChange={(v) => { setSelectedBrand(v); if (v) trackFilterApply('marca', v) }}
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
                            onChange={(v) => { setSelectedCondition(v); if (v) trackFilterApply('condicion', v) }}
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
                <>
                    <div className="products-grid">
                        {paginatedProducts.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>

                    {hasMore && (
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 48 }}>
                            <button
                                className="btn btn-secondary"
                                onClick={handleShowMore}
                                style={{
                                    paddingInline: 48,
                                    height: 54,
                                    fontSize: '1rem',
                                    borderRadius: 'var(--radius-lg)'
                                }}
                            >
                                Cargar más productos
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
