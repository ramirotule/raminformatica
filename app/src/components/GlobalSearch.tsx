'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { useSearch } from '@/context/SearchContext'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { ProductWithDetails } from '@/lib/database.types'
import { dict } from '@/lib/dict'
import { getPriceUSD, formatUSD, getPriceARS, formatARS } from '@/lib/utils'
import { trackSearch } from '@/lib/analytics'
import { useDolar } from '@/context/DolarContext'

export default function GlobalSearch() {
    const { searchQuery, setSearchQuery } = useSearch()
    const { dolar } = useDolar()
    const [results, setResults] = useState<ProductWithDetails[]>([])
    const [loading, setLoading] = useState(false)
    const [showDropdown, setShowDropdown] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const router = useRouter()
    const pathname = usePathname()

    const isProductsPage = pathname === '/productos'

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        const query = searchQuery.trim().toLowerCase()

        // Si hay menos de 3 letras o estamos en la página de productos, no hacemos fetch
        if (query.length < 3 || isProductsPage) {
            setResults([])
            setLoading(false)
            return
        }

        const timer = setTimeout(async () => {
            trackSearch(query)
            setLoading(true)
            try {
                const terms = query.split(/\s+/).filter(t => t.length > 0)
                let queryBuilder = supabase
                    .from('products')
                    .select('*, brands(*), categories(*), product_images(*), product_variants(*, prices(*))')
                    .eq('active', true)
                    // .limit(8) // Initial limit removed as it's applied later

                // Aplicamos un .or() por cada término para que todos deban estar presentes en algún campo
                terms.forEach(term => {
                    queryBuilder = queryBuilder.or(`name.ilike.%${term}%,short_description.ilike.%${term}%,long_description.ilike.%${term}%`)
                })

                const { data, error } = await queryBuilder.limit(50)
                if (error) throw error

                // Scoring Local para relevancia y Filtrado Estricto
                const scored = (data as ProductWithDetails[]).map(p => {
                    let score = 0
                    const name = p.name.toLowerCase()
                    const brand = (p as any).brands?.name?.toLowerCase() || ''
                    const catName = (p.categories?.name || '').toLowerCase()
                    const shortDesc = (p.short_description || '').toLowerCase()
                    const longDesc = (p.long_description || '').toLowerCase()
                    const tags = (p as any).tags_index?.toLowerCase() || ''
                    const variantSpecs = [
                        p.product_variants?.[0]?.storage,
                        p.product_variants?.[0]?.color,
                        p.product_variants?.[0]?.connectivity
                    ].filter(Boolean).join(' ').toLowerCase()

                    const allText = [name, brand, catName, shortDesc, longDesc, tags, variantSpecs].join(' ')

                    // Todos los términos deben estar presentes como palabras completas
                    const allTermsPresent = terms.every(term => {
                        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regex = new RegExp(`(^|[^a-zA-Z0-9])${escapedTerm}([^a-zA-Z0-9]|$)`, 'i');
                        return regex.test(allText);
                    })

                    if (!allTermsPresent) return { product: p, score: -1 }

                    terms.forEach(term => {
                        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regex = new RegExp(`(^|[^a-zA-Z0-9])${escapedTerm}([^a-zA-Z0-9]|$)`, 'i');

                        if (regex.test(name)) score += 50
                        if (regex.test(brand)) score += 30
                        if (regex.test(tags)) score += 15
                        if (regex.test(shortDesc)) score += 5
                        if (regex.test(longDesc)) score += 1
                    })
                    return { product: p, score }
                })

                // Filtrar los que no pasaron el filtro estricto, ordenar por score y tomar los 8 mejores
                const filteredResults = scored
                    .filter(s => s.score >= 0)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 8)
                    .map(s => s.product)

                setResults(filteredResults)
            } catch (err) {
                console.error('Fatal search error:', err)
            } finally {
                setLoading(false)
                setShowDropdown(true)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [searchQuery, isProductsPage])

    const handleSelect = (slug: string) => {
        setSearchQuery('')
        setShowDropdown(false)
        router.push(`/productos/${slug}`)
    }

    return (
        <div className="global-search-container" ref={containerRef}>
            <div className="search-wrap header-search">
                <Search size={18} className="search-icon" />
                <input
                    type="text"
                    className="search-input"
                    placeholder={dict.productos.buscar}
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value)
                        if (!isProductsPage) setShowDropdown(true)
                    }}
                    onFocus={() => {
                        if (searchQuery && !isProductsPage) setShowDropdown(true)
                    }}
                />
                {searchQuery && (
                    <button
                        className="search-clear"
                        onClick={() => {
                            setSearchQuery('')
                            setResults([])
                            setShowDropdown(false)
                        }}
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            {!isProductsPage && showDropdown && (searchQuery.trim() !== '') && (
                <div className="search-dropdown animate-fade-in">
                    {loading ? (
                        <div className="dropdown-loading">
                            <Loader2 size={20} className="animate-spin" />
                            <span>Buscando...</span>
                        </div>
                    ) : results.length > 0 ? (
                        <div className="dropdown-results">
                            {results.map((product) => {
                                const variant = product.product_variants?.[0]
                                const priceUSD = getPriceUSD(variant?.prices, product.price_usd)
                                const image = product.product_images?.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))[0]?.public_url

                                return (
                                    <button
                                        key={product.id}
                                        className="dropdown-item"
                                        onClick={() => handleSelect(product.slug)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px' }}
                                    >
                                        <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--bg-secondary)', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)' }}>
                                            {image ? (
                                                <img src={image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                            ) : (
                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>📦</div>
                                            )}
                                        </div>
                                        <div className="item-info" style={{ flex: 1, textAlign: 'left' }}>
                                            <p className="item-name" style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 2 }}>{product.name}</p>
                                            <p className="item-cat" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{product.categories?.name}</p>
                                        </div>
                                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                            <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.1 }}>
                                                {priceUSD && dolar ? formatARS(getPriceARS(priceUSD, dolar.venta)) : priceUSD ? `${formatUSD(priceUSD)} USD` : '—'}
                                            </p>
                                            {priceUSD && dolar && (
                                                <p style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '0.75rem', marginTop: 1 }}>
                                                    {formatUSD(priceUSD)} USD
                                                </p>
                                            )}
                                        </div>
                                    </button>
                                )
                            })}
                            <button
                                className="dropdown-footer"
                                onClick={() => {
                                    setShowDropdown(false)
                                    router.push(`/productos?q=${searchQuery}`)
                                }}
                            >
                                Ver todos los resultados
                            </button>
                        </div>
                    ) : (
                        <div className="dropdown-empty">
                            No se encontraron productos
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
