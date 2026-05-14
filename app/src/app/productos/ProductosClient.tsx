'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import ProductCard from '@/components/ProductCard'
import { dict } from '@/lib/dict'
import { getPriceUSD } from '@/lib/utils'
import { calculatePriceRanges, type PriceBracket } from '@/lib/price-utils'
import type { ProductWithDetails, Category, Brand } from '@/lib/database.types'

// New Components
import { FilterSidebar } from './components/FilterSidebar'
import { SortControls, type SortOption } from './components/SortControls'
import { MobileFilters } from './components/MobileFilters'

import { useSearch } from '@/context/SearchContext'
import { useDolarBlue } from '@/hooks/useDolarBlue'
import { trackFilterApply } from '@/lib/analytics'

interface ProductosClientProps {
    products: ProductWithDetails[]
    categories: Category[]
    brands: Brand[]
    title?: string
    description?: string
}

export default function ProductosClient({ 
    products, 
    categories, 
    brands,
    title,
    description 
}: ProductosClientProps) {
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const router = useRouter()
    const { dolar } = useDolarBlue()
    
    const {
        searchQuery: search,
        setSearchQuery: setSearch,
        category: selectedCategory,
        setCategory: setSelectedCategory,
        sortBy,
        setSortBy,
        showFilters
    } = useSearch()

    // Filter State
    const [selectedBrands, setSelectedBrands] = useState<string[]>(
        searchParams.get('marca')?.split(',').filter(Boolean) ?? []
    )
    const [minPrice, setMinPrice] = useState('')
    const [maxPrice, setMaxPrice] = useState('')
    const [priceCurrency, setPriceCurrency] = useState<'ARS' | 'USD'>('ARS')
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
    const [visibleItems, setVisibleItems] = useState(20)
    const ITEMS_PER_STEP = 20

    // Sync URL params for Category and Search Query
    useEffect(() => {
        const cat = searchParams.get('categoria')
        const q = searchParams.get('q')
        
        if (cat) setSelectedCategory(cat)
        if (q) setSearch(q)
    }, [searchParams, setSelectedCategory, setSearch])

    const handleBrandToggle = (slug: string) => {
        if (!slug) {
            setSelectedBrands([])
            return
        }
        setSelectedBrands(prev => {
            const next = prev.includes(slug) 
                ? prev.filter(s => s !== slug) 
                : [...prev, slug]
            return next
        })
        trackFilterApply('marca', slug)
    }

    const resetFilters = () => {
        setSearch('')
        setSelectedCategory('')
        setSelectedBrands([])
        setMinPrice('')
        setMaxPrice('')
        setPriceCurrency('ARS')
        setSortBy('mas-vendidos')
        setVisibleItems(20)
        router.push(pathname, { scroll: false })
    }

    // Filter available brands based on selected category
    const availableBrands = useMemo(() => {
        if (!selectedCategory) return brands
        const brandIdsInCat = new Set(
            products
                .filter(p => p.categories?.slug === selectedCategory)
                .map(p => p.brands?.id)
                .filter(Boolean)
        )
        return brands.filter(b => brandIdsInCat.has(b.id))
    }, [selectedCategory, brands, products])

    const filtered = useMemo(() => {
        let list = [...products]

        // 1. Search Query (Scoring Logic)
        if (search.trim()) {
            const terms = search.toLowerCase().trim().split(/\s+/).filter(t => t !== '')
            const listWithScores = list.map(p => {
                let score = 0
                const name = p.name.toLowerCase()
                const brand = (p.brands?.name || '').toLowerCase()
                const catName = (p.categories?.name || '').toLowerCase()
                
                const matchTerm = (term: string, text: string): boolean => text.includes(term)

                const allTermsPresent = terms.every(term => 
                    matchTerm(term, [name, brand, catName, p.short_description].join(' ').toLowerCase())
                )

                if (!allTermsPresent) return { product: p, score: -1 }

                terms.forEach(term => {
                    if (name.includes(term)) score += 50
                    if (brand.includes(term)) score += 30
                    if (catName.includes(term)) score += 20
                })
                return { product: p, score }
            }).filter(item => item.score >= 0)

            listWithScores.sort((a, b) => b.score - a.score)
            list = listWithScores.map(item => item.product)
        }

        // 2. Category Filter
        if (selectedCategory) {
            list = list.filter((p) => p.categories?.slug === selectedCategory)
        }

        // 3. Brand Filter (Multi-select)
        if (selectedBrands.length > 0) {
            list = list.filter((p) => p.brands?.slug && selectedBrands.includes(p.brands.slug))
        }

        // 4. Price Range Filter (ARS/USD)
        if (minPrice || maxPrice) {
            let minUSD = 0
            let maxUSD = Infinity

            if (priceCurrency === 'ARS' && dolar?.venta) {
                minUSD = minPrice ? Number(minPrice) / dolar.venta : 0
                maxUSD = maxPrice ? Number(maxPrice) / dolar.venta : Infinity
            } else if (priceCurrency === 'USD') {
                minUSD = minPrice ? Number(minPrice) : 0
                maxUSD = maxPrice ? Number(maxPrice) : Infinity
            }

            list = list.filter(p => {
                const price = getPriceUSD(p.product_variants?.[0]?.prices, p.price_usd)
                if (price === null || price === undefined) return false
                return price >= minUSD && price <= maxUSD
            })
        }

        // 5. Sorting
        list.sort((a, b) => {
            const pa = getPriceUSD(a.product_variants?.[0]?.prices, a.price_usd) ?? 0
            const pb = getPriceUSD(b.product_variants?.[0]?.prices, b.price_usd) ?? 0

            switch (sortBy) {
                case 'precio-asc': return pa - pb
                case 'precio-desc': return pb - pa
                case 'nombre-asc': return a.name.localeCompare(b.name, 'es')
                case 'nombre-desc': return b.name.localeCompare(a.name, 'es')
                case 'mas-vendidos':
                    if (a.is_featured && !b.is_featured) return -1
                    if (!a.is_featured && b.is_featured) return 1
                    return (b.created_at || '').localeCompare(a.created_at || '')
                default: return (b.created_at || '').localeCompare(a.created_at || '')
            }
        })

        return list
    }, [products, search, selectedCategory, selectedBrands, minPrice, maxPrice, priceCurrency, sortBy, dolar?.venta])

    const paginatedProducts = useMemo(() => filtered.slice(0, visibleItems), [filtered, visibleItems])
    const hasMore = visibleItems < filtered.length
    const hasFilters = !!(search || selectedCategory || selectedBrands.length > 0 || minPrice || maxPrice)

    return (
        <div style={{ paddingBottom: 80 }}>
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(12, 1fr)', 
                gap: 32,
                marginTop: 20
            }}>
                {/* Desktop Sidebar */}
                {showFilters && (
                    <div className="hide-on-mobile" style={{ gridColumn: 'span 3' }}>
                        <FilterSidebar 
                            brands={availableBrands}
                            selectedBrands={selectedBrands}
                            onBrandToggle={handleBrandToggle}
                            minPrice={minPrice}
                            maxPrice={maxPrice}
                            currency={priceCurrency}
                            onCurrencyChange={setPriceCurrency}
                            onMinPriceChange={setMinPrice}
                            onMaxPriceChange={setMaxPrice}
                            onReset={resetFilters}
                            hasFilters={hasFilters}
                        />
                    </div>
                )}

                {/* Main Content */}
                <main style={{ gridColumn: showFilters ? 'span 9' : 'span 12' } as any}>
                    <SortControls 
                        sortBy={sortBy as SortOption} 
                        onSortChange={(opt) => setSortBy(opt)}
                        onToggleFilters={() => setMobileFiltersOpen(true)}
                    />

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
                                        onClick={() => setVisibleItems(prev => prev + ITEMS_PER_STEP)}
                                        style={{ paddingInline: 48, height: 54, borderRadius: 12 }}
                                    >
                                        Cargar más productos
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>

            {/* Mobile Drawer */}
            <MobileFilters 
                isOpen={mobileFiltersOpen}
                onClose={() => setMobileFiltersOpen(false)}
                brands={availableBrands}
                selectedBrands={selectedBrands}
                onBrandToggle={handleBrandToggle}
                minPrice={minPrice}
                maxPrice={maxPrice}
                currency={priceCurrency}
                onCurrencyChange={setPriceCurrency}
                onMinPriceChange={setMinPrice}
                onMaxPriceChange={setMaxPrice}
                onReset={resetFilters}
                hasFilters={hasFilters}
                resultCount={filtered.length}
            />

            {/* Global Styles for Layout */}
            <style jsx global>{`
                .products-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
                    gap: 24px;
                }
                @media (max-width: 1024px) {
                    .hide-on-mobile { display: none !important; }
                    main { grid-column: span 12 !important; }
                }
            `}</style>
        </div>
    )
}
