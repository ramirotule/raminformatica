'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { 
    Search, 
    SlidersHorizontal, 
    X, 
    ChevronLeft, 
    ChevronRight,
    Smartphone,
    Headphones,
    Gamepad2,
    Watch,
    Tablet,
    Laptop,
    Tv,
    Speaker,
    LayoutGrid,
    Package
} from 'lucide-react'
import ProductCard from '@/components/ProductCard'
import { dict } from '@/lib/dict'
import { getPriceUSD } from '@/lib/utils'
import type { ProductWithDetails, Category, Brand } from '@/lib/database.types'
import { SearchableSelect } from '@/components/SearchableSelect'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface ProductosClientProps {
    products: ProductWithDetails[]
    categories: Category[]
    brands: Brand[]
    title?: string
    description?: string
}

type SortOption = 'reciente' | 'precio-asc' | 'precio-desc' | 'nombre'

import { useSearch } from '@/context/SearchContext'
import { trackSearch, trackFilterApply } from '@/lib/analytics'

export default function ProductosClient({ 
    products, 
    categories, 
    brands,
    title,
    description 
}: ProductosClientProps) {
    const searchParams = useSearchParams()
    const pathname = usePathname()
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
            
            // Calculamos score y filtramos
            const listWithScores = list.map(p => {
                let score = 0
                const name = p.name.toLowerCase()
                const brand = (p.brands?.name || '').toLowerCase()
                const catName = (p.categories?.name || '').toLowerCase()
                const shortDesc = (p.short_description || '').toLowerCase()
                const longDesc = (p.long_description || '').toLowerCase()
                const tagsRaw = (p.tags || []).join(' ').toLowerCase()
                const variantSpecs = [
                    p.product_variants?.[0]?.storage,
                    p.product_variants?.[0]?.color,
                    p.product_variants?.[0]?.connectivity
                ].filter(Boolean).join(' ').toLowerCase()

                const primaryText = [name, brand, catName, tagsRaw, variantSpecs].join(' ')
                const allText = [primaryText, shortDesc].join(' ')

                // Estrategia de matching por tipo de término:
                // - Número puro ("17", "256"): word-boundary numérico
                // - Alfanumérico mixto ("04s", "g04s", "s26"): substring simple
                // - Letra pura ("pro", "iphone"): word-boundary alfanumérico
                const matchTerm = (term: string, text: string, isLast: boolean): boolean => {
                    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                    const isNumeric = /^\d+$/.test(term)
                    const isAlpha = /^[a-zA-Z]+$/.test(term)
                    const isMixed = !isNumeric && !isAlpha

                    if (isMixed) return text.includes(term)

                    if (isNumeric) {
                        const regex = isLast
                            ? new RegExp(`(^|[^0-9])${escapedTerm}`, 'i')
                            : new RegExp(`(^|[^0-9])${escapedTerm}([^0-9]|$)`, 'i')
                        return regex.test(text)
                    }

                    const regex = isLast
                        ? new RegExp(`(^|[^a-zA-Z0-9])${escapedTerm}`, 'i')
                        : new RegExp(`(^|[^a-zA-Z0-9])${escapedTerm}([^a-zA-Z0-9]|$)`, 'i')
                    return regex.test(text)
                }

                // Todos los términos deben estar presentes en el texto combinado
                const allTermsPresent = terms.every((term, i) =>
                    matchTerm(term, primaryText, i === terms.length - 1)
                )

                if (!allTermsPresent) return { product: p, score: -1 }

                // Calcular peso
                terms.forEach((term, i) => {
                    const isLast = i === terms.length - 1
                    const check = (text: string, weight: number) => {
                        if (matchTerm(term, text, isLast)) score += weight
                    }

                    check(name, 50)
                    check(brand, 30)
                    check(catName, 20)
                    check(tagsRaw, 15)
                    check(variantSpecs, 10)
                    check(shortDesc, 5)
                    check(longDesc, 1)
                })

                return { product: p, score }
            }).filter(item => item.score >= 0)

            // Ordenar por score descendente primariamente
            listWithScores.sort((a, b) => b.score - a.score)
            list = listWithScores.map(item => item.product)
        }

        if (selectedCategory) {
            const catList = selectedCategory.split(',')
            list = list.filter((p) => p.categories?.slug && catList.includes(p.categories.slug))
        }

        if (selectedBrand) {
            const brandList = selectedBrand.split(',')
            list = list.filter((p) => p.brands?.slug && brandList.includes(p.brands.slug))
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
            {/* ─── Encabezado Reactivo ─── */}
            <div style={{ marginBottom: 48, textAlign: 'center' }}>
                <h1 className="hero-title" style={{ fontSize: 'clamp(2.5rem, 8vw, 3.5rem)', marginBottom: 16 }}>
                    <span>{title || dict.nav.productos}</span>
                </h1>
                
                {hasFilters ? (
                    <p style={{ 
                        fontSize: '1.25rem', 
                        fontWeight: 700, 
                        color: 'var(--text-primary)',
                        marginInline: 'auto',
                        maxWidth: 700
                    }}>
                        {filtered.length} {filtered.length === 1 ? 'producto coincide' : 'productos coinciden'} con tu búsqueda
                    </p>
                ) : (
                    <div style={{ maxWidth: 600, marginInline: 'auto' }}>
                        {description && (
                            <p className="hero-desc" style={{ marginBottom: 8, opacity: 0.9 }}>
                                {description}
                            </p>
                        )}
                        <p className="hero-desc" style={{ opacity: 0.8 }}>
                            {dict.productos.resultados(products.length)} disponibles para vos
                        </p>
                    </div>
                )}
            </div>

            {/* ─── Pills de Categorías ─────────────────────── */}
            <div style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                justifyContent: 'center',
                marginBottom: 28,
            }}>
                <Link
                    href="/productos"
                    className="category-pill"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 22px',
                        borderRadius: 999,
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        border: '1px solid',
                        textDecoration: 'none',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        whiteSpace: 'nowrap',
                        borderColor: pathname === '/productos' && !selectedCategory ? 'var(--accent)' : 'var(--border)',
                        background: pathname === '/productos' && !selectedCategory ? 'var(--accent)' : 'var(--bg-card)',
                        color: pathname === '/productos' && !selectedCategory ? '#fff' : 'var(--text-secondary)',
                        boxShadow: pathname === '/productos' && !selectedCategory ? '0 4px 12px var(--accent-glow)' : 'none',
                    }}
                >
                    <LayoutGrid size={16} />
                    Todos
                </Link>
                {categories.map(cat => {
                    const isActive = pathname === `/productos/${cat.slug}` || selectedCategory === cat.slug
                    
                    const getIcon = () => {
                        // Priority 1: Custom icon_url from DB
                        if (cat.icon_url) {
                            if (cat.icon_url.startsWith('http')) {
                                return <img src={cat.icon_url} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
                            }
                            return <span style={{ fontSize: '1.1rem' }}>{cat.icon_url}</span>
                        }

                        // Priority 2: Lucide icons mapping
                        const iconMap: Record<string, any> = {
                            'celulares-iphone': Smartphone,
                            'celulares-samsung': Smartphone,
                            'celulares-motorola': Smartphone,
                            'celulares-infinix': Smartphone,
                            'celulares-xiaomi': Smartphone,
                            'jbl-parlantes-auriculares': Speaker,
                            'video-juegos': Gamepad2,
                            'airpods': Headphones,
                            'apple-watch': Watch,
                            'ipad': Tablet,
                            'macbook': Laptop,
                            'televisores': Tv,
                        }

                        const IconComp = iconMap[cat.slug] || Package
                        return <IconComp size={16} />
                    }

                    return (
                        <Link
                            key={cat.id}
                            href={`/productos/${cat.slug}`}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '10px 22px',
                                borderRadius: 999,
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                border: '1px solid',
                                textDecoration: 'none',
                                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                whiteSpace: 'nowrap',
                                borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                                background: isActive ? 'var(--accent)' : 'var(--bg-card)',
                                color: isActive ? '#fff' : 'var(--text-secondary)',
                                boxShadow: isActive ? '0 4px 12px var(--accent-glow)' : 'none',
                            }}
                            onMouseEnter={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.borderColor = 'var(--accent)'
                                    e.currentTarget.style.background = 'rgba(52, 199, 89, 0.05)'
                                    e.currentTarget.style.color = 'var(--text-primary)'
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.borderColor = 'var(--border)'
                                    e.currentTarget.style.background = 'var(--bg-card)'
                                    e.currentTarget.style.color = 'var(--text-secondary)'
                                }
                            }}
                        >
                            {getIcon()}
                            {cat.name}
                        </Link>
                    )
                })}
            </div>

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
                                { value: '', label: 'Todas las categorías', icon: <LayoutGrid size={14} /> },
                                ...categories.map(cat => {
                                    const iconMap: Record<string, any> = {
                                        'celulares-iphone': Smartphone,
                                        'celulares-samsung': Smartphone,
                                        'celulares-motorola': Smartphone,
                                        'celulares-infinix': Smartphone,
                                        'celulares-xiaomi': Smartphone,
                                        'jbl-parlantes-auriculares': Speaker,
                                        'video-juegos': Gamepad2,
                                        'airpods': Headphones,
                                        'apple-watch': Watch,
                                        'ipad': Tablet,
                                        'macbook': Laptop,
                                        'televisores': Tv,
                                    }
                                    const IconComp = iconMap[cat.slug] || Package
                                    
                                    let iconNode = <IconComp size={14} />
                                    if (cat.icon_url) {
                                        if (cat.icon_url.startsWith('http')) {
                                            iconNode = <img src={cat.icon_url} alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} />
                                        } else {
                                            iconNode = <span style={{ fontSize: '0.9rem' }}>{cat.icon_url}</span>
                                        }
                                    }

                                    return { 
                                        value: cat.slug, 
                                        label: cat.name,
                                        icon: iconNode
                                    }
                                })
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
