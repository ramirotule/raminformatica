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
import { getComparisonData, applyBestPrice, applyAllBestPrices } from './precios/actions'
import { formatUSD } from '@/lib/utils'
import { SearchableSelect } from '@/components/SearchableSelect'

interface Product {
    id: string
    name: string
    cost_price: number | null
    provider_id: string | null
}

interface Provider {
    id: string
    name: string
}

interface ProviderCost {
    product_id: string
    provider_id: string
    cost_price: number
    updated_at: string
}

export default function AdminComparator() {
    const [products, setProducts] = useState<Product[]>([])
    const [providers, setProviders] = useState<Provider[]>([])
    const [costs, setCosts] = useState<ProviderCost[]>([])
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState<string | null>(null) // ID of product being synced
    const [syncingAll, setSyncingAll] = useState(false)
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [providerFilter, setProviderFilter] = useState('')

    const loadData = async () => {
        setLoading(true)
        const res = await getComparisonData()
        if (res.success) {
            setProducts(res.products as Product[])
            setProviders(res.providers as Provider[])
            setCosts(res.costs as ProviderCost[])
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

    const handleApplyAll = async () => {
        if (!confirm("Esto actualizará el precio de costo y proveedor de todos los productos donde se encontró un mejor precio. ¿Continuar?")) return
        setSyncingAll(true)
        const res = await applyAllBestPrices()
        setResult(res as any)
        if (res.success) {
            await loadData()
        }
        setSyncingAll(false)
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
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase())
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
                    <button onClick={loadData} className="btn btn-ghost" style={{ gap: 8 }}>
                        <RefreshCw size={16} /> Actualizar Datos
                    </button>
                    <button
                        onClick={handleApplyAll}
                        disabled={syncingAll}
                        className="btn btn-primary"
                        style={{ gap: 8, background: 'var(--blue)', borderColor: 'var(--blue)' }}
                    >
                        {syncingAll ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
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
            <div className="table-wrap card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg-secondary)' }}>
                            <th style={{ padding: '16px 20px', textAlign: 'left', width: '35%' }}>Producto</th>
                            <th style={{ padding: '16px 20px', textAlign: 'center' }}>Actual (Tienda)</th>
                            {providers.map(prov => (
                                <th key={prov.id} style={{ padding: '16px 20px', textAlign: 'center' }}>{prov.name}</th>
                            ))}
                            <th style={{ padding: '16px 20px', textAlign: 'center' }}>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredProducts.map(p => {
                            const best = getBestPrice(p.id)
                            const isCurrentBest = best && p.provider_id === best.provider_id && p.cost_price === best.cost_price

                            return (
                                <tr key={p.id} style={{ borderTop: '1px solid var(--border)', transition: 'background 0.2s' }} className="hover-bg">
                                    <td style={{ padding: '20px' }}>
                                        <div style={{ fontWeight: 700 }}>{p.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>ID: {p.id.slice(0, 8)}...</div>
                                    </td>

                                    <td style={{ padding: '20px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 800 }}>{p.cost_price ? `$${p.cost_price}` : '—'}</span>
                                            {p.provider_id && (
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 4, marginTop: 4 }}>
                                                    {providers.find(pr => pr.id === p.provider_id)?.name || 'Desconocido'}
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {providers.map(prov => {
                                        const cost = getCostForProvider(p.id, prov.id)
                                        const isBest = best && cost === best.cost_price

                                        return (
                                            <td key={prov.id} style={{ padding: '20px', textAlign: 'center' }}>
                                                {cost ? (
                                                    <div style={{
                                                        fontWeight: isBest ? 800 : 500,
                                                        color: isBest ? 'var(--green)' : 'inherit',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        gap: 4
                                                    }}>
                                                        <span>${cost}</span>
                                                        {isBest && <span style={{ fontSize: '0.6rem', background: 'rgba(52, 199, 89, 0.1)', color: 'var(--green)', padding: '2px 6px', borderRadius: 4 }}>MEJOR</span>}
                                                    </div>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)', opacity: 0.3 }}>—</span>
                                                )}
                                            </td>
                                        )
                                    })}

                                    <td style={{ padding: '20px', textAlign: 'center' }}>
                                        {best && !isCurrentBest ? (
                                            <button
                                                onClick={() => handleApplyBest(p.id, best.provider_id, best.cost_price)}
                                                disabled={syncing === p.id}
                                                className="btn btn-sm"
                                                style={{
                                                    background: 'var(--green)',
                                                    color: 'white',
                                                    border: 'none',
                                                    width: 120
                                                }}
                                            >
                                                {syncing === p.id ? <Loader2 size={14} className="animate-spin" /> : 'Aplicar Mejor'}
                                            </button>
                                        ) : isCurrentBest ? (
                                            <div style={{ color: 'var(--green)', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                                                <CheckCircle2 size={14} /> Optimizado
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sin datos</span>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            <style jsx>{`
                .hover-bg:hover {
                    background: rgba(0,0,0,0.02);
                }
            `}</style>
        </div>
    )
}
