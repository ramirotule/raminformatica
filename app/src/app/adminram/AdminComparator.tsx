'use client'

import { useState, useEffect } from 'react'
import {
    RefreshCw,
    ArrowRight,
    Zap,
    Loader2,
    Database,
    TrendingDown,
    CheckCircle2,
    AlertCircle,
    Search,
    ChevronDown,
    Building2,
    DollarSign
} from 'lucide-react'
import { getComparisonData, applyBestPrice, applyAllBestPrices, publishBulkFromProviderCosts } from './precios/actions'
import { formatUSD } from '@/lib/utils'
import { SearchableSelect } from '@/components/SearchableSelect'

interface Product {
    id: string
    name: string
    cost_price: number | null
    provider_id: string | null
    short_description?: string | null
    long_description?: string | null
}

interface Provider {
    id: string
    name: string
}

interface ProviderCost {
    id: string
    product_id: string | null
    provider_id: string
    cost_price: number
    product_name?: string
    category_name?: string
    updated_at: string
}

export default function AdminComparator() {
    const [products, setProducts] = useState<Product[]>([])
    const [providers, setProviders] = useState<Provider[]>([])
    const [costs, setCosts] = useState<ProviderCost[]>([])
    const [dbCategories, setDbCategories] = useState<{id: string, name: string}[]>([])
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState<string | null>(null) // ID of product being synced
    const [syncingAll, setSyncingAll] = useState(false)
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [providerFilter, setProviderFilter] = useState('')
    const [bestPricePreview, setBestPricePreview] = useState<any[] | null>(null)
    const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
    const [publishPreview, setPublishPreview] = useState<{ original: ProviderCost, name: string, cost: number, price: number, category: string }[] | null>(null)
    const [publishing, setPublishing] = useState(false)

    const loadData = async () => {
        setLoading(true)
        const res = await getComparisonData()
        if (res.success) {
            setProducts(res.products as Product[])
            setProviders(res.providers as Provider[])
            setCosts(res.costs as ProviderCost[])
            setDbCategories(res.categories || [])
        }
        setLoading(false)
    }

    useEffect(() => {
        loadData()
    }, [])

    const handleApplyBest = async (productId: string, bestProviderId: string, bestCost: number) => {
        setSyncing(productId)
        const res = await applyBestPrice(productId, bestProviderId, bestCost)
        if (res.success) {
            // Update local state to reflect change
            setProducts(prev => prev.map(p =>
                p.id === productId
                    ? { ...p, cost_price: bestCost, provider_id: bestProviderId }
                    : p
            ))
            setResult({ success: true, message: "Precio actualizado correctamente." })
        } else {
            setResult({ success: false, message: res.message || "Error al actualizar." })
        }
        setSyncing(null)
    }

    const handleShowBestPreview = () => {
        const preview: any[] = []
        
        products.forEach(p => {
            const productCosts = costs.filter(c => c.product_id === p.id)
            if (productCosts.length === 0) return

            const best = productCosts.reduce((prev, curr) => (prev.cost_price < curr.cost_price ? prev : curr))
            
            // Ver si hay cambio significativo
            const hasChanged = p.cost_price === null || Math.abs(best.cost_price - p.cost_price) > 0.01

            if (hasChanged) {
                const bestProvider = providers.find(pr => pr.id === best.provider_id)
                preview.push({
                    id: p.id,
                    name: p.name,
                    oldCost: p.cost_price,
                    newCost: best.cost_price,
                    providerName: bestProvider?.name || 'Desconocido',
                    providerId: best.provider_id,
                    newPrice: Math.ceil(((best.cost_price / 0.90) + 25) / 5) * 5
                })
            }
        })

        if (preview.length === 0) {
            alert("No se encontraron mejores precios para actualizar.")
            return
        }

        setBestPricePreview(preview)
    }

    const handleConfirmApplyAll = async () => {
        setSyncingAll(true)
        const res = await applyAllBestPrices()
        setResult(res as any)
        if (res.success) {
            await loadData()
            setBestPricePreview(null)
        }
        setSyncingAll(false)
    }

    const handleApplyAll = async () => {
        handleShowBestPreview()
    }

    const handlePublishSelected = () => {
        if (selectedItemIds.length === 0) return
        
        const previewData = selectedItemIds.map(id => {
            const cost = costs.find(c => c.id === id)
            if (!cost) return null
            
            return {
                name: cost.product_name || "Producto sin nombre",
                cost: cost.cost_price,
                price: Math.ceil(((cost.cost_price / 0.90) + 25) / 5) * 5,
                category: dbCategories.find(c => c.name === cost.category_name) ? (cost.category_name || "Sin Asignar") : "Sin Asignar",
                original: cost
            }
        }).filter(Boolean) as { original: ProviderCost, name: string, cost: number, price: number, category: string }[]

        setPublishPreview(previewData)
    }

    const handleConfirmPublish = async () => {
        if (!publishPreview) return
        
        setPublishing(true)
        // Convert the preview items back to what the server action expects
        const itemsToPublish = publishPreview.map(p => ({
            ...p.original,
            product_name: p.name,
            cost_price: p.cost,
            category_name: p.category
        }))
        const res = await publishBulkFromProviderCosts(itemsToPublish, null) // Provider ID null since it could be mixed
        setResult(res as any)
        if (res.success) {
            await loadData()
            setSelectedItemIds([])
            setPublishPreview(null)
        }
        setPublishing(false)
    }

    const updatePreviewItem = (idx: number, field: 'cost' | 'category' | 'name', value: any) => {
        if (!publishPreview) return
        const newPreview = [...publishPreview]
        const item = { ...newPreview[idx] }
        
        if (field === 'cost') {
            const costNum = parseFloat(value) || 0
            item.cost = costNum
            item.price = Math.ceil(((costNum / 0.90) + 25) / 5) * 5
        } else if (field === 'name') {
            item.name = value
        } else {
            item.category = value
        }
        
        newPreview[idx] = item
        setPublishPreview(newPreview)
    }

    // LISTA DE CATEGORÍAS DISPONIBLES (Extraídas de la base de datos)
    const categoryNames = Array.from(new Set([
        "Sin Asignar",
        ...dbCategories.map(c => c.name)
    ])).sort()

    const toggleSelectItem = (id: string) => {
        setSelectedItemIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    const toggleSelectAll = (visibleIds: string[]) => {
        const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedItemIds.includes(id))
        
        if (allSelected) {
            // Deseleccionar solo los visibles
            setSelectedItemIds(prev => prev.filter(id => !visibleIds.includes(id)))
        } else {
            // Añadir los visibles a la selección existente
            setSelectedItemIds(prev => Array.from(new Set([...prev, ...visibleIds])))
        }
    }

    const getCostForProvider = (productId: string, providerId: string) => {
        return costs.find(c => c.product_id === productId && c.provider_id === providerId)?.cost_price
    }

    const getBestPrice = (productId: string) => {
        const productCosts = costs.filter(c => c.product_id === productId)
        if (productCosts.length === 0) return null
        return productCosts.reduce((prev, curr) => (prev.cost_price < curr.cost_price ? prev : curr))
    }

    const filteredProducts = products.filter(p => {
        const terms = searchQuery.toLowerCase().trim().split(/\s+/).filter(t => t !== '')
        const matchesSearch = terms.length === 0 || terms.every(term => 
            p.name.toLowerCase().includes(term) ||
            (p.short_description || '').toLowerCase().includes(term) ||
            (p.long_description || '').toLowerCase().includes(term)
        )
        const matchesProvider = !providerFilter || p.provider_id === providerFilter
        return matchesSearch && matchesProvider
    })

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16 }}>
                <Loader2 className="animate-spin" size={48} color="var(--green)" />
                <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Cargando comparador...</p>
            </div>
        )
    }

    return (
        <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                            <TrendingDown size={24} />
                        </div>
                        Comparador de Precios
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
                        Visualiza los costos de todos tus proveedores y elige automáticamente la mejor oferta.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    {selectedItemIds.length > 0 && (
                        <button
                            onClick={handlePublishSelected}
                            disabled={publishing}
                            className="btn btn-primary animate-scale-in"
                            style={{ gap: 8, background: 'var(--green)', borderColor: 'var(--green)' }}
                        >
                            {publishing ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                            Publicar Selección ({selectedItemIds.length})
                        </button>
                    )}
                    <button onClick={loadData} className="btn btn-ghost" style={{ gap: 8 }}>
                        <RefreshCw size={16} /> Actualizar Datos
                    </button>
                    <button
                        onClick={handleApplyAll}
                        disabled={syncingAll}
                        className="btn btn-primary animate-pulse"
                        style={{ 
                            gap: 8, 
                            background: 'var(--green)', 
                            borderColor: 'var(--green)', 
                            fontWeight: 900, 
                            padding: '12px 24px',
                            boxShadow: '0 0 20px rgba(52, 199, 89, 0.2)',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                    >
                        {syncingAll ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} style={{ fill: 'white' }} />}
                        Aplicar Mejores Precios a Todo
                    </button>
                </div>
            </div>

            {/* Results Alert */}
            {result && (
                <div style={{
                    padding: 16, borderRadius: 12, marginBottom: 24,
                    background: result.success ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 59, 48, 0.1)',
                    border: `1px solid ${result.success ? 'var(--green)' : 'var(--red)'}`,
                    display: 'flex', alignItems: 'center', gap: 12
                }}>
                    {result.success ? <CheckCircle2 size={20} color="var(--green)" /> : <AlertCircle size={20} color="var(--red)" />}
                    <span style={{ fontWeight: 600 }}>{result.message}</span>
                    <button onClick={() => setResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}>cerrar</button>
                </div>
            )}

            {/* Stats Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 32 }}>
                <div className="card" style={{ padding: 20 }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Productos Monitoreados</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{products.length}</div>
                </div>
                <div className="card" style={{ padding: 20 }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Proveedores Activos</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{providers.length}</div>
                </div>
                <div className="card" style={{ padding: 20 }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Precios en DB</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{costs.length}</div>
                </div>
                {providerFilter && (() => {
                    const providerCosts = costs.filter(c => c.provider_id === providerFilter)
                    if (providerCosts.length === 0) return null
                    const latest = providerCosts.reduce((prev, curr) => (new Date(prev.updated_at) > new Date(curr.updated_at) ? prev : curr))
                    const lastUpdateDate = new Date(latest.updated_at)
                    const diffMs = new Date().getTime() - lastUpdateDate.getTime()
                    const diffHours = diffMs / (1000 * 60 * 60)
                    
                    let cardColor = 'var(--green)'
                    let bgColor = 'rgba(52, 199, 89, 0.05)'
                    let borderColor = 'rgba(52, 199, 89, 0.2)'
                    
                    if (diffHours > 36) {
                        cardColor = 'var(--red)'
                        bgColor = 'rgba(255, 59, 48, 0.05)'
                        borderColor = 'rgba(255, 59, 48, 0.2)'
                    } else if (diffHours > 24) {
                        cardColor = '#FF9500' // Yellow/Orange
                        bgColor = 'rgba(255, 149, 0, 0.05)'
                        borderColor = 'rgba(255, 149, 0, 0.2)'
                    }

                    return (
                        <div className="card pulse-glow" style={{ padding: 20, border: `1px solid ${borderColor}`, background: bgColor, transition: 'all 0.5s ease' }}>
                            <div style={{ fontSize: '0.8rem', color: cardColor, fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Building2 size={12} /> Proveedor Seleccionado
                            </div>
                            <div style={{ fontSize: '1rem', fontWeight: 800 }}>
                                {providers.find(p => p.id === providerFilter)?.name}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                Última carga: {lastUpdateDate.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                            </div>
                        </div>
                    )
                })()}
            </div>

            <div style={{ marginBottom: 20, display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
                    <input
                        type="text"
                        placeholder="Buscar producto por nombre..."
                        className="form-input"
                        style={{ paddingLeft: 48 }}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div style={{ width: 180 }}>
                    <SearchableSelect
                        value={providerFilter}
                        onChange={(v) => setProviderFilter(v)}
                        options={[
                            { value: '', label: 'Todos los Proveedores' },
                            ...providers.map(prov => ({ value: prov.id, label: prov.name }))
                        ]}
                        placeholder="Filtrar por Proveedor"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="table-wrap card" style={{ padding: 0, maxHeight: 'calc(100vh - 300px)', overflowY: 'auto', border: '1px solid var(--border)' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg-secondary)' }}>
                            {!providerFilter ? (
                                <>
                                    <th style={{ padding: '16px 20px', textAlign: 'left', width: 40, position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 10 }}>
                                        <input 
                                            type="checkbox" 
                                            checked={(() => {
                                                const terms = searchQuery.toLowerCase().trim().split(/\s+/).filter(t => t !== '')
                                                const visibleSelectable = costs.filter(c => !c.product_id && (terms.length === 0 || terms.every(term => (c.product_name || '').toLowerCase().includes(term))))
                                                return visibleSelectable.length > 0 && visibleSelectable.every(c => selectedItemIds.includes(c.id))
                                            })()}
                                            onChange={() => {
                                                const terms = searchQuery.toLowerCase().trim().split(/\s+/).filter(t => t !== '')
                                                const visibleSelectable = costs.filter(c => !c.product_id && (terms.length === 0 || terms.every(term => (c.product_name || '').toLowerCase().includes(term))))
                                                toggleSelectAll(visibleSelectable.map(s => s.id))
                                            }}
                                        />
                                    </th>
                                    <th style={{ padding: '16px 20px', textAlign: 'left', width: '35%', position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 10, boxShadow: 'inset 0 -1px 0 var(--border)' }}>Producto</th>
                                    <th style={{ padding: '16px 20px', textAlign: 'center', position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 10, boxShadow: 'inset 0 -1px 0 var(--border)' }}>Actual (Tienda)</th>
                                    {providers.map(prov => (
                                        <th key={prov.id} style={{ padding: '16px 20px', textAlign: 'center', position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 10, boxShadow: 'inset 0 -1px 0 var(--border)' }}>{prov.name}</th>
                                    ))}
                                </>
                            ) : (
                                <>
                                    <th style={{ padding: '16px 20px', textAlign: 'left', width: 40, position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 10 }}>
                                        <input 
                                            type="checkbox" 
                                            checked={(() => {
                                                const terms = searchQuery.toLowerCase().trim().split(/\s+/).filter(t => t !== '')
                                                const visibleSelectable = costs.filter(c => c.provider_id === providerFilter && !products.find(p => p.id === c.product_id) && (terms.length === 0 || terms.every(term => (c.product_name || '').toLowerCase().includes(term))))
                                                return visibleSelectable.length > 0 && visibleSelectable.every(c => selectedItemIds.includes(c.id))
                                            })()}
                                            onChange={() => {
                                                const terms = searchQuery.toLowerCase().trim().split(/\s+/).filter(t => t !== '')
                                                const visibleSelectable = costs.filter(c => c.provider_id === providerFilter && !products.find(p => p.id === c.product_id) && (terms.length === 0 || terms.every(term => (c.product_name || '').toLowerCase().includes(term))))
                                                toggleSelectAll(visibleSelectable.map(s => s.id))
                                            }}
                                        />
                                    </th>
                                    <th style={{ padding: '16px 20px', textAlign: 'left', width: '35%', position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 10, boxShadow: 'inset 0 -1px 0 var(--border)' }}>Producto</th>
                                    <th style={{ padding: '16px 20px', textAlign: 'center', position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 10 }}>P. Costo (Prov)</th>
                                    <th style={{ padding: '16px 20px', textAlign: 'center', position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 10, boxShadow: 'inset 0 -1px 0 var(--border)' }}>P. Venta Sug.</th>
                                    <th style={{ padding: '16px 20px', textAlign: 'center', position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 10, boxShadow: 'inset 0 -1px 0 var(--border)' }}>Publicado Tienda</th>
                                    <th style={{ padding: '16px 20px', textAlign: 'center', position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 10, boxShadow: 'inset 0 -1px 0 var(--border)' }}>Precio Tienda</th>
                                </>
                            )}
                            <th style={{ padding: '16px 20px', textAlign: 'center', position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 10, boxShadow: 'inset 0 -1px 0 var(--border)' }}>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(() => {
                            if (!providerFilter) {
                                // MODO COMPARATIVA GLOBAL: Productos de tienda + Ítems no vinculados
                                const unlinkedCosts = costs.filter(c => !c.product_id)
                                
                                const allRows = [
                                    ...products.map(p => ({ 
                                        id: p.id, 
                                        name: p.name, 
                                        type: 'linked' as const,
                                        original: p 
                                    })),
                                    ...unlinkedCosts.map((c, idx) => ({ 
                                        id: `unlinked-${c.provider_id}-${c.product_name}-${idx}`,
                                        name: c.product_name || 'Sin nombre', 
                                        type: 'unlinked' as const,
                                        originalCost: c 
                                    }))
                                ].filter(row => {
                                    const terms = searchQuery.toLowerCase().trim().split(/\s+/).filter(t => t !== '')
                                    if (terms.length === 0) return true
                                    const text = (row.name + (row.type === 'linked' ? (row.original.short_description || '') + (row.original.long_description || '') : '')).toLowerCase()
                                    return terms.every(term => text.includes(term))
                                })

                                const getPriceBadgeForGlobal = (costValue: number | null, allPrices: number[], storePrice: number | null) => {
                                    if (costValue === null) return null
                                    if (storePrice !== null && costValue === storePrice) {
                                        return { label: 'MISMO PRECIO', color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.05)' }
                                    }
                                    const sortedUnique = Array.from(new Set(allPrices)).sort((a, b) => a - b)
                                    const rank = sortedUnique.indexOf(costValue)
                                    if (rank === 0) return { label: 'MEJOR PRECIO', color: 'var(--green)', bg: 'rgba(52, 199, 89, 0.1)' }
                                    if (rank === 1) return { label: '2DO MEJOR', color: '#FFCC00', bg: 'rgba(255, 204, 0, 0.1)' }
                                    if (rank === 2) return { label: '3ER MEJOR', color: 'var(--blue)', bg: 'rgba(0, 122, 255, 0.1)' }
                                    return { label: 'MÁS CARO', color: 'var(--red)', bg: 'rgba(255, 59, 48, 0.1)' }
                                }

                                return allRows.map((row) => {
                                    if (row.type === 'linked') {
                                        const p = row.original
                                        const productProviderCosts = costs.filter(c => c.product_id === p.id)
                                        const bestEntry = productProviderCosts.length > 0 
                                            ? productProviderCosts.reduce((prev, curr) => (prev.cost_price < curr.cost_price ? prev : curr))
                                            : null
                                        
                                        const allPrices = productProviderCosts.map(c => c.cost_price)
                                        if (p.cost_price !== null) allPrices.push(p.cost_price)

                                        const isActuallyBetter = bestEntry && (p.cost_price === null || bestEntry.cost_price < p.cost_price)

                                        return (
                                            <tr key={row.id} style={{ borderTop: '1px solid var(--border)', transition: 'background 0.2s' }} className="hover-bg">
                                                <td style={{ width: 40 }}></td>
                                                <td style={{ padding: '20px' }}>
                                                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>ID: {p.id.slice(0, 8)}...</div>
                                                </td>
                                                <td style={{ padding: '20px', textAlign: 'center' }}>
                                                    {p.cost_price !== null ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                                            <span style={{ fontWeight: 700 }}>${p.cost_price}</span>
                                                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>
                                                                {providers.find(prov => prov.id === p.provider_id)?.name || 'Tienda'}
                                                            </span>
                                                            {(() => {
                                                                const badge = getPriceBadgeForGlobal(p.cost_price, allPrices, null)
                                                                return badge && <span style={{ fontSize: '0.6rem', color: badge.color, background: badge.bg, padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>{badge.label}</span>
                                                            })()}
                                                        </div>
                                                    ) : '—'}
                                                </td>
                                                {providers.map(prov => {
                                                    const costEntry = productProviderCosts.find(c => c.provider_id === prov.id)
                                                    const badge = getPriceBadgeForGlobal(costEntry?.cost_price || null, allPrices, p.cost_price)
                                                    return (
                                                        <td key={prov.id} style={{ padding: '20px', textAlign: 'center' }}>
                                                            {costEntry ? (
                                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                                                    <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>${costEntry.cost_price}</span>
                                                                    {badge && <span style={{ fontSize: '0.6rem', color: badge.color, background: badge.bg, padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>{badge.label}</span>}
                                                                </div>
                                                            ) : <span style={{ color: 'var(--text-muted)', opacity: 0.3 }}>—</span>}
                                                        </td>
                                                    )
                                                })}
                                                <td style={{ padding: '20px', textAlign: 'center' }}>
                                                    {isActuallyBetter ? (
                                                        <button onClick={() => handleApplyBest(p.id, bestEntry.provider_id, bestEntry.cost_price)} disabled={syncing === p.id} className="btn btn-sm" style={{ background: 'var(--green)', color: 'white', border: 'none', width: 120 }}>
                                                            {syncing === p.id ? <Loader2 size={14} className="animate-spin" /> : 'Aplicar Mejor'}
                                                        </button>
                                                    ) : (bestEntry || p.cost_price !== null) ? <div style={{ color: 'var(--green)', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}><CheckCircle2 size={14} /> Optimizado</div> : <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sin datos</span>}
                                                </td>
                                            </tr>
                                        )
                                    } else {
                                        const c = row.originalCost
                                        return (
                                            <tr key={row.id} style={{ borderTop: '1px solid var(--border)', transition: 'background 0.2s', background: selectedItemIds.includes(c.id) ? 'rgba(52,199,89,0.05)' : 'rgba(255,255,255,0.01)' }} className="hover-bg">
                                                <td style={{ padding: '20px' }}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedItemIds.includes(c.id)} 
                                                        onChange={() => toggleSelectItem(c.id)}
                                                    />
                                                </td>
                                                <td style={{ padding: '20px' }}>
                                                    <div style={{ fontWeight: 600, opacity: 0.8 }}>{c.product_name}</div>
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 4 }}>No vinculado • {c.category_name}</div>
                                                </td>
                                                <td style={{ padding: '20px', textAlign: 'center' }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                                                </td>
                                                {providers.map(prov => (
                                                    <td key={prov.id} style={{ padding: '20px', textAlign: 'center' }}>
                                                        {c.provider_id === prov.id ? (
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                                                <span style={{ fontWeight: 800, color: 'var(--blue)' }}>${c.cost_price}</span>
                                                                <span style={{ fontSize: '0.6rem', color: 'var(--blue)', fontWeight: 800, background: 'rgba(0,122,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>NUEVO</span>
                                                            </div>
                                                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                                    </td>
                                                ))}
                                                <td style={{ padding: '20px', textAlign: 'center' }}>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pendiente sync</span>
                                                </td>
                                            </tr>
                                        )
                                    }
                                })
                            } else {
                                // MODO FILTER: Basado en el costo del proveedor seleccionado
                                const filteredCosts = costs.filter(c => {
                                    if (c.provider_id !== providerFilter) return false
                                    const terms = searchQuery.toLowerCase().trim().split(/\s+/).filter(t => t !== '')
                                    if (terms.length === 0) return true
                                    const text = (c.product_name || '').toLowerCase()
                                    return terms.every(term => text.includes(term))
                                })
                                return filteredCosts.map((c, i) => {
                                    const linkedProduct = products.find(p => p.id === c.product_id)
                                    const suggestedSale = Math.ceil(((c.cost_price / 0.90) + 25) / 5) * 5
                                    const isPublished = !!linkedProduct
                                    
                                    return (
                                        <tr key={i} style={{ borderTop: '1px solid var(--border)', transition: 'background 0.2s', background: selectedItemIds.includes(c.id) ? 'rgba(52,199,89,0.05)' : 'transparent' }} className="hover-bg">
                                            <td style={{ padding: '12px 20px', textAlign: 'left' }}>
                                                {!isPublished && (
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedItemIds.includes(c.id)} 
                                                        onChange={() => toggleSelectItem(c.id)}
                                                    />
                                                )}
                                            </td>
                                            <td style={{ padding: '20px' }}>
                                                <div style={{ fontWeight: 700 }}>{(c as any).product_name || linkedProduct?.name || 'Producto sin nombre'}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Ref Provider: {c.provider_id}</div>
                                            </td>
                                            <td style={{ padding: '20px', textAlign: 'center' }}>
                                                <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>${c.cost_price}</span>
                                            </td>
                                            <td style={{ padding: '20px', textAlign: 'center' }}>
                                                <span style={{ color: 'var(--green)', fontWeight: 800 }}>${suggestedSale}</span>
                                            </td>
                                            <td style={{ padding: '20px', textAlign: 'center' }}>
                                                {isPublished ? (
                                                    <span style={{ background: 'rgba(52,199,89,0.1)', color: 'var(--green)', padding: '4px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 800 }}>SÍ public.</span>
                                                ) : (
                                                    <span style={{ background: 'rgba(255,59,48,0.1)', color: 'var(--red)', padding: '4px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 800 }}>NO public.</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '20px', textAlign: 'center' }}>
                                                {linkedProduct ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                        <span style={{ fontWeight: 700 }}>${linkedProduct.cost_price}</span>
                                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                                            {providers.find(prov => prov.id === linkedProduct.provider_id)?.name || 'Costo actual tienda'}
                                                        </span>
                                                    </div>
                                                ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                            </td>
                                            <td style={{ padding: '20px', textAlign: 'center' }}>
                                                {linkedProduct ? (
                                                    <button onClick={() => handleApplyBest(linkedProduct.id, c.provider_id, c.cost_price)} disabled={syncing === linkedProduct.id} className="btn btn-sm" style={{ background: 'var(--blue)', color: 'white', border: 'none', width: 120 }}>
                                                        {syncing === linkedProduct.id ? <Loader2 size={14} className="animate-spin" /> : 'Actualizar'}
                                                    </button>
                                                ) : <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Por publicar</span>}
                                            </td>
                                        </tr>
                                    )
                                })
                            }
                        })()}
                    </tbody>
                </table>
            </div>

            {/* Modal de Previsualización de Mejores Precios */}
            {bestPricePreview && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 20 }}>
                    <div className="card" style={{ width: '100%', maxWidth: 800, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 32, borderRadius: 24, boxShadow: '0 30px 60px rgba(0,0,0,0.5)', gap: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: 8 }}>Actualización Masiva de Mejores Precios</h2>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Se han encontrado <span style={{ color: 'var(--green)', fontWeight: 800 }}>{bestPricePreview.length}</span> mejoras de precio entre todos tus proveedores.
                                </p>
                            </div>
                            <div style={{ textAlign: 'right', background: 'rgba(52,199,89,0.1)', padding: '8px 16px', borderRadius: 12 }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: 1 }}>Modo Inteligente</div>
                                <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--green)' }}>Mejor Costo</div>
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 10, boxShadow: 'inset 0 -1px 0 var(--border)' }}>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>PRODUCTO</th>
                                        <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>ACTUAL</th>
                                        <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>MEJOR COSTO</th>
                                        <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>GANADOR</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bestPricePreview.map((p, i) => (
                                        <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                                            <td style={{ padding: '12px 16px', fontSize: '0.85rem', fontWeight: 600 }}>{p.name}</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.85rem', opacity: 0.6 }}>${p.oldCost || '—'}</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    <span style={{ fontWeight: 900, color: 'var(--green)', fontSize: '0.95rem' }}>${p.newCost}</span>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Venta: ${p.newPrice}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                <span style={{ padding: '4px 8px', borderRadius: 6, background: 'var(--bg-primary)', fontSize: '0.75rem', fontWeight: 700, border: '1px solid var(--border)' }}>
                                                    {p.providerName}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ display: 'flex', gap: 16 }}>
                            <button onClick={() => setBestPricePreview(null)} className="btn btn-ghost" style={{ flex: 1, height: 48 }}>Cancelar</button>
                            <button 
                                onClick={handleConfirmApplyAll} 
                                disabled={syncingAll}
                                className="btn btn-primary" 
                                style={{ flex: 2, height: 48, fontWeight: 900, background: 'var(--blue)', borderColor: 'var(--blue)', boxShadow: '0 10px 25px rgba(0, 122, 255, 0.3)' }}
                            >
                                {syncingAll ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                Actualizar {bestPricePreview.length} Productos
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Previsualización de Publicación Masiva */}
            {publishPreview && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 20 }}>
                    <div className="card" style={{ width: '100%', maxWidth: 1000, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 32, borderRadius: 24, boxShadow: '0 30px 60px rgba(0,0,0,0.5)', gap: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: 8, color: 'var(--green)' }}>Publicación Masiva de Productos</h2>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Vas a añadir <span style={{ color: 'var(--green)', fontWeight: 800 }}>{publishPreview.length}</span> nuevos productos a tu catálogo.
                                </p>
                            </div>
                            <div style={{ textAlign: 'right', background: 'rgba(52,199,89,0.1)', padding: '8px 16px', borderRadius: 12 }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: 1 }}>Sincronización</div>
                                <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--green)' }}>Nuevos Ítems</div>
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 10, boxShadow: 'inset 0 -1px 0 var(--border)' }}>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>PRODUCTO</th>
                                        <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>COSTO PROV</th>
                                        <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>VENTA TIENDA</th>
                                        <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>CATEGORÍA</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {publishPreview.map((p, i) => (
                                        <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                                            <td style={{ padding: '12px 16px' }}>
                                                <input 
                                                    type="text" 
                                                    value={p.name}
                                                    onChange={(e) => updatePreviewItem(i, 'name', e.target.value)}
                                                    style={{ background: 'transparent', border: 'none', color: 'white', fontWeight: 600, width: '100%', outline: 'none', fontSize: '0.85rem' }}
                                                />
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-primary)', borderRadius: 8, padding: '4px 8px', border: '1px solid var(--border)' }}>
                                                    <span style={{ fontSize: '0.8rem', opacity: 0.5, marginRight: 2 }}>$</span>
                                                    <input 
                                                        type="number" 
                                                        value={p.cost}
                                                        onChange={(e) => updatePreviewItem(i, 'cost', e.target.value)}
                                                        onFocus={(e) => e.target.select()}
                                                        className="no-spinner"
                                                        style={{ background: 'transparent', border: 'none', color: 'white', fontWeight: 700, width: 60, outline: 'none', textAlign: 'center' }}
                                                    />
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    <span style={{ color: 'var(--green)', fontWeight: 800 }}>${p.price}</span>
                                                    <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>Venta Sug.</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', minWidth: 200 }}>
                                                <SearchableSelect
                                                    value={p.category}
                                                    onChange={(v) => updatePreviewItem(i, 'category', v)}
                                                    options={categoryNames.map(cat => ({ value: cat, label: cat }))}
                                                    placeholder="Categoría..."
                                                    style={{ height: '38px', borderRadius: '8px' }}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ display: 'flex', gap: 16 }}>
                            <button onClick={() => setPublishPreview(null)} className="btn btn-ghost" style={{ flex: 1, height: 48 }}>Cancelar</button>
                            <button 
                                onClick={handleConfirmPublish} 
                                disabled={publishing}
                                className="btn btn-primary" 
                                style={{ flex: 2, height: 48, fontWeight: 900, background: 'var(--green)', borderColor: 'var(--green)', boxShadow: '0 10px 25px rgba(52, 199, 89, 0.3)' }}
                            >
                                {publishing ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                Confirmar y Publicar {publishPreview.length} Productos
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .hover-bg:hover {
                    background: rgba(0,0,0,0.02);
                }
                .no-spinner::-webkit-inner-spin-button,
                .no-spinner::-webkit-outer-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                .no-spinner {
                    -moz-appearance: textfield;
                }
            `}</style>
        </div>
    )
}
