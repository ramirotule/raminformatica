'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { useSearch } from '@/context/SearchContext'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { ProductWithDetails } from '@/lib/database.types'
import { dict } from '@/lib/dict'

export default function GlobalSearch() {
    const { searchQuery, setSearchQuery } = useSearch()
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
        if (!searchQuery.trim() || isProductsPage) {
            setResults([])
            return
        }

        const timer = setTimeout(async () => {
            setLoading(true)
            try {
                const { data, error } = await supabase
                    .from('products')
                    .select('*, brands(*), categories(*), product_images(*), product_variants(*, prices(*))')
                    .or(`name.ilike.%${searchQuery}%,short_description.ilike.%${searchQuery}%,tags.cs.{"${searchQuery}"}`)
                    .eq('active', true)
                    .limit(8)

                if (data) setResults(data as any)
            } catch (err) {
                console.error(err)
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
                            {results.map((product) => (
                                <button
                                    key={product.id}
                                    className="dropdown-item"
                                    onClick={() => handleSelect(product.slug)}
                                >
                                    <div className="item-info">
                                        <p className="item-name">{product.name}</p>
                                        <p className="item-cat">{product.categories?.name} • {product.brands?.name}</p>
                                    </div>
                                    <div className="item-arrow">→</div>
                                </button>
                            ))}
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
