'use client'

import { useState, useEffect } from 'react'
import { DollarSign, Upload, Zap, AlertCircle, CheckCircle2, FileJson, FileText, Loader2, ShieldCheck, ArrowLeft, Search, PlusCircle, Database, Pencil, Trash2 } from 'lucide-react'
import { parseImportData, searchMatches, processSync, getMissingProducts, triggerEnrichment, recalculateAllPrices, getRecalculatePreview, type ParsedItem } from './precios/actions'
import { SearchableSelect } from '@/components/SearchableSelect'
import { supabase } from '@/lib/supabase'

export default function AdminPrecios() {
    const [view, setView] = useState<'input' | 'preview'>('input')
    const [provider, setProvider] = useState<'gcgroup' | 'zentek' | 'kadabra' | 'tecnoduo'>('gcgroup')
    const [databaseProviderId, setDatabaseProviderId] = useState<string>('')
    const [isCatalogSync, setIsCatalogSync] = useState(false) // true cuando se importa productos_ram.json completo
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)
    const [parsedItems, setParsedItems] = useState<ParsedItem[]>([])
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
    const [result, setResult] = useState<{ success: boolean; message: string; errors?: string[] } | null>(null)
    const [enrichStatus, setEnrichStatus] = useState<string | null>(null)
    const [providers, setProviders] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [editingItem, setEditingItem] = useState<{ idx: number; name: string; cost: number; sale: number; category: string } | null>(null)
    const [bulkPreview, setBulkPreview] = useState<any[] | null>(null)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        async function fetchProviders() {
            const { data } = await supabase.from('providers').select('id, name').eq('active', true).order('name')
            if (data) setProviders(data)
        }
        async function fetchCategories() {
            const { data } = await supabase.from('categories').select('id, name').order('name')
            if (data) setCategories(data)
        }
        fetchProviders()
        fetchCategories()
    }, [])

    useEffect(() => {
        if (providers.length > 0) {
            // Find a direct match first
            let match = providers.find(p => p.name.toLowerCase().replace(/\s+/g, '') === provider.toLowerCase().replace(/\s+/g, ''))
            
            // If no direct match, try partial match
            if (!match) {
                match = providers.find(p => p.name.toLowerCase().replace(/\s+/g, '').includes(provider.toLowerCase().replace(/\s+/g, '')))
            }
            
            if (match) {
                setDatabaseProviderId(match.id)
            } else {
                setDatabaseProviderId('')
            }
        }
    }, [provider, providers])

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        
        const reader = new FileReader()
        reader.onload = (e) => {
            const content = e.target?.result as string
            setInput(content)
            // Auto detect provider if JSON
            try {
                const data = JSON.parse(content)
                if (data.metadatos?.proveedor?.toLowerCase().includes('zentek')) {
                    setProvider('zentek')
                } else {
                    setProvider('gcgroup')
                }
            } catch (err) {
                // Not a JSON or invalid, stay with current provider
            }
        }
        reader.readAsText(file)
    }

    const handleAutoLoad = async (fileName: string) => {
        setIsLoading(true)
        setResult(null)
        const isFullCatalog = fileName === 'productos_ram.json'
        setIsCatalogSync(isFullCatalog)
        try {
            const res = await fetch(`/${fileName}`)
            if (!res.ok) throw new Error("No se pudo cargar el archivo automático.")
            const data = await res.json()
            setInput(JSON.stringify(data, null, 2))

            if (fileName.includes('zentek')) {
                setProvider('zentek')
            } else if (fileName.includes('kadabra')) {
                setProvider('kadabra')
            } else if (fileName.includes('tecnoduo')) {
                setProvider('tecnoduo')
            } else {
                setProvider('gcgroup')
            }

            // Trigger automatic parse after loading
            const p = fileName.includes('zentek') ? 'zentek' : 
                      fileName.includes('kadabra') ? 'kadabra' : 
                      fileName.includes('tecnoduo') ? 'tecnoduo' : 'gcgroup';
            
            const parseRes = await parseImportData(JSON.stringify(data), p as any)
            if (parseRes.success) {
                setParsedItems(parseRes.items)
                setSelectedIndices(new Set(parseRes.items.map((_, i) => i)))
                setView('preview')
            }
        } catch (err: any) {
            setResult({ success: false, message: 'Error cargando archivo automático: ' + err.message })
        } finally {
            setIsLoading(false)
        }
    }

    const handleParse = async () => {
        setIsLoading(true)
        setResult(null)
        try {
            const res = await parseImportData(input, provider)
            if (res.success) {
                setParsedItems(res.items)
                setSelectedIndices(new Set(res.items.map((_, i) => i))) // Seleccionamos todos por defecto
                setView('preview')
            } else {
                setResult({ success: false, message: res.message || 'Error desconocido al parsear' })
            }
        } catch (err: any) {
            setResult({ success: false, message: 'Ocurrió un error al procesar el texto.' })
        } finally {
            setIsLoading(false)
        }
    }

    const handleIntegrateToDB = async () => {
        if (selectedIndices.size === 0) {
            alert('No hay items seleccionados');
            return;
        }
        if (!databaseProviderId) {
            alert('Falta seleccionar el proveedor en el desplegable azul');
            setResult({ success: false, message: 'Debes seleccionar un proveedor de la base de datos antes de integrar.' })
            return
        }

        setIsSyncing(true)
        setResult(null)

        try {
            const { integrateProviderCosts } = await import('./precios/actions');
            const itemsToSync = parsedItems.filter((_, i) => selectedIndices.has(i));
            
            const res = await integrateProviderCosts(itemsToSync, databaseProviderId);
            setResult(res);
        } catch (err: any) {
            console.error('Error integrating:', err);
            setResult({ success: false, message: 'Error durante la integración: ' + err.message })
        } finally {
            setIsSyncing(false)
            window.scrollTo({ top: 0, behavior: 'smooth' })
        }
    }

    const handleSearchMatches = async () => {
        setIsLoading(true)
        try {
            // Match ALL items in the list to be more thorough
            const res = await searchMatches(parsedItems, databaseProviderId || undefined)

            if (res.success) {
                let newItems = res.items
                const nextIndices = new Set<number>() // Reiniciamos la selección

                // Seleccionar automáticamente:
                // 1. Coincidencias al >= 85% (Actualizaciones)
                // 2. Productos Nuevos (Creaciones)
                newItems.forEach((item, idx) => {
                    if (item.status === 'matched' || item.status === 'new') {
                        nextIndices.add(idx)
                    }
                })

                // Ver faltantes (desactivaciones)
                // - Catálogo completo: evalúa TODOS los activos sin filtro de proveedor
                // - Por proveedor: solo evalúa los de ese proveedor
                if (isCatalogSync || databaseProviderId) {
                    const matchedIds = res.items.map(it => it.matchId).filter(id => !!id) as string[]
                    const missing = await getMissingProducts(
                        matchedIds,
                        isCatalogSync ? undefined : databaseProviderId
                    )
                    if (missing.length > 0) {
                        const currentCount = newItems.length
                        newItems = [...newItems, ...missing]
                        for (let k = currentCount; k < newItems.length; k++) {
                            nextIndices.add(k)
                        }
                    }
                }

                setParsedItems(newItems)
                setSelectedIndices(nextIndices)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setIsLoading(false)
        }
    }

    const handleFinalSync = async () => {
        if (selectedIndices.size === 0) {
            alert('No hay items seleccionados');
            return;
        }
        if (!isCatalogSync && !databaseProviderId) {
            alert('Falta seleccionar el proveedor en el desplegable azul');
            setResult({ success: false, message: 'Debes seleccionar un proveedor de la base de datos antes de sincronizar.' })
            return
        }

        setIsSyncing(true)
        setResult(null)

        try {
            const itemsToSync = parsedItems.filter((_, i) => selectedIndices.has(i))
            const res = await processSync(itemsToSync, isCatalogSync ? undefined : databaseProviderId)

            setResult(res)
            if (res.success && res.createdIds && res.createdIds.length > 0) {
                setEnrichStatus(`⏳ Enriqueciendo ${res.createdIds.length} nuevos productos...`)
                triggerEnrichment().then(e => {
                    setEnrichStatus(e.started
                        ? `✅ Enriquecimiento iniciado (${res.createdIds!.length} productos)`
                        : `⚠️ ${e.message}`
                    )
                })
            }
        } catch (err: any) {
            console.error('Error fatal en handleFinalSync:', err);
            setResult({ success: false, message: 'Error durante la sincronización final: ' + err.message })
        } finally {
            setIsSyncing(false)
            window.scrollTo({ top: 0, behavior: 'smooth' })
        }
    }

    const handleShowRecalculatePreview = async () => {
        setIsSyncing(true)
        setResult(null)
        try {
            const res = await getRecalculatePreview()
            if (res.success) {
                setBulkPreview(res.preview || [])
            } else {
                setResult({ success: false, message: res.message || 'No se pudo obtener la previsualización' })
            }
        } catch (err: any) {
            setResult({ success: false, message: 'Error al obtener preview: ' + err.message })
        } finally {
            setIsSyncing(false)
        }
    }

    const handleConfirmBulkRecalculate = async () => {
        setIsSyncing(true)
        setResult(null)
        setBulkPreview(null)
        try {
            const res = await recalculateAllPrices()
            setResult({ ...res, message: res.message || '' })
        } catch (err: any) {
            setResult({ success: false, message: 'Error al recalcular: ' + err.message })
        } finally {
            setIsSyncing(false)
        }
    }

    const toggleSelectAll = () => {
        if (selectedIndices.size === parsedItems.length) {
            setSelectedIndices(new Set())
        } else {
            setSelectedIndices(new Set(parsedItems.map((_, i) => i)))
        }
    }

    const toggleItem = (idx: number) => {
        const next = new Set(selectedIndices)
        if (next.has(idx)) next.delete(idx)
        else next.add(idx)
        setSelectedIndices(next)
    }

    const deleteItem = (idx: number) => {
        setParsedItems(prev => prev.filter((_, i) => i !== idx))
        const next = new Set<number>()
        selectedIndices.forEach(val => {
            if (val < idx) next.add(val)
            if (val > idx) next.add(val - 1)
        })
        setSelectedIndices(next)
    }

    const openEditModal = (idx: number, item: ParsedItem) => {
        setEditingItem({
            idx,
            name: item.name,
            cost: item.cost,
            sale: item.finalPrice,
            category: item.categoryName || ''
        })
    }

    const saveEdit = () => {
        if (!editingItem) return
        setParsedItems(prev => prev.map((item, i) => 
            i === editingItem.idx 
                ? { 
                    ...item, 
                    name: editingItem.name, 
                    cost: editingItem.cost, 
                    categoryName: editingItem.category, 
                    finalPrice: editingItem.sale 
                }
                : item
        ))
        setEditingItem(null)
    }

    const getSimilarityColor = (score?: number) => {
        if (!score) return 'var(--text-muted)'
        if (score > 95) return 'var(--green)'
        if (score > 80) return 'var(--blue)'
        if (score > 60) return 'var(--orange)'
        return 'var(--red)'
    }

    const bulkPreviewModal = bulkPreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
            <div className="card shadow-2xl animate-scale-in" style={{ width: '900px', maxHeight: '85vh', padding: 32, borderRadius: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h3 style={{ fontWeight: 900, fontSize: '1.6rem', marginBottom: 6 }}>Previsualización de Precios</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            Se detectaron <b>{bulkPreview.length}</b> productos con costo. Solo los que tienen cambios relevantes en el redondeo serán actualizados.
                        </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        {(() => {
                            const changed = bulkPreview.filter(p => p.changed).length
                            return <span style={{ padding: '6px 12px', borderRadius: 10, background: 'rgba(52,199,89,0.1)', color: 'var(--green)', fontWeight: 800, fontSize: '0.8rem' }}>
                                {changed} Productos por cambiar
                            </span>
                        })()}
                    </div>
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 5 }}>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '12px 16px' }}>Producto</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px' }}>Costo</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px' }}>Precio Actual</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px' }}>Nuevo (Ceil)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bulkPreview.map((p, i) => (
                                <tr key={i} style={{ borderTop: '1px solid var(--border)', background: p.changed ? 'rgba(52,199,89,0.03)' : 'transparent' }}>
                                    <td style={{ padding: '12px 16px', fontSize: '0.85rem' }}>{p.name}</td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center', fontFamily: 'monospace' }}>${p.cost}</td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>${p.oldPrice}</td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                        <span style={{ 
                                            fontWeight: p.changed ? 900 : 400,
                                            color: p.changed ? 'var(--green)' : 'inherit',
                                            fontSize: p.changed ? '1.05rem' : '0.9rem'
                                        }}>
                                            ${p.newPrice}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    <button onClick={() => setBulkPreview(null)} className="btn btn-ghost" style={{ flex: 1 }}>Cerrar Preview</button>
                    <button 
                        onClick={handleConfirmBulkRecalculate} 
                        className="btn btn-primary" 
                        style={{ flex: 2, fontWeight: 900, background: 'var(--green)', borderColor: 'var(--green)', boxShadow: '0 10px 25px rgba(52, 199, 89, 0.4)' }}
                    >
                        Confirmar y Actualizar Precios ({bulkPreview.filter(p => p.changed).length})
                    </button>
                </div>
            </div>
        </div>
    );

    if (view === 'preview') {
        return (
            <div style={{ maxWidth: '1100px', margin: '0 auto', position: 'relative' }} className="animate-fade-in">
                {isSyncing && (
                    <div style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000, backdropFilter: 'blur(4px)', gap: 16
                    }}>
                        <div className="card" style={{ padding: '32px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, borderRadius: 24 }}>
                            <Loader2 className="animate-spin" size={48} color="var(--green)" />
                            <div style={{ textAlign: 'center' }}>
                                <h3 style={{ fontWeight: 800, marginBottom: 4 }}>Sincronizando Productos...</h3>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Esto puede tardar unos segundos, no cierres la ventana.</p>
                            </div>
                        </div>
                    </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, background: 'var(--bg-card)', padding: '16px 20px', borderRadius: 16, border: '1px solid var(--border)', flexWrap: 'wrap', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <button onClick={() => setView('input')} className="btn btn-ghost btn-sm" style={{ gap: 8 }}>
                            <ArrowLeft size={16} /> Volver
                        </button>
                        <div style={{ 
                            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', 
                            borderRadius: 12, background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.2)' 
                        }}>
                            <Database size={14} color="#007AFF" />
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#007AFF' }}>
                                Proveedor a cargar: <span style={{ textTransform: 'uppercase' }}>{providers.find(p => p.id === databaseProviderId)?.name || provider}</span>
                            </span>
                        </div>
                        {parsedItems.length > 0 && (
                            <div style={{ display: 'flex', gap: 8, fontSize: '0.75rem' }}>
                                {(() => {
                                    const matched = parsedItems.filter(i => i.status === 'matched').length
                                    const newP = parsedItems.filter(i => i.status === 'new').length
                                    const deact = parsedItems.filter(i => i.status === 'deactivate').length
                                    return <>
                                        {matched > 0 && <span style={{ padding: '3px 8px', borderRadius: 8, background: 'rgba(0,122,255,0.1)', color: '#007AFF', fontWeight: 600 }}>↑ {matched} actualizar</span>}
                                        {newP > 0 && <span style={{ padding: '3px 8px', borderRadius: 8, background: 'rgba(52,199,89,0.1)', color: 'var(--green-dark)', fontWeight: 600 }}>+ {newP} nuevos</span>}
                                        {deact > 0 && <span style={{ padding: '3px 8px', borderRadius: 8, background: 'rgba(255,59,48,0.1)', color: 'var(--red)', fontWeight: 600 }}>✕ {deact} desactivar</span>}
                                    </>
                                })()}
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ position: 'relative', width: 240 }}>
                            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input 
                                type="text" 
                                placeholder="Buscar en listado..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ 
                                    padding: '8px 12px 8px 36px', 
                                    borderRadius: 12, 
                                    background: 'rgba(255,255,255,0.03)', 
                                    border: '1px solid var(--border)',
                                    color: 'white',
                                    fontSize: '0.85rem',
                                    width: '100%',
                                    outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                                onFocus={(e) => e.target.style.borderColor = 'var(--blue)'}
                                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                            />
                        </div>
                        <button
                            onClick={handleSearchMatches}
                            disabled={isLoading}
                            className="btn btn-ghost"
                            style={{ gap: 8, background: 'rgba(52, 199, 89, 0.05)', color: 'var(--green-dark)' }}
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                            Detección Inteligente
                        </button>
                        <button
                            onClick={handleIntegrateToDB}
                            className="btn btn-ghost"
                            style={{ gap: 8, padding: '0 16px', border: '1px solid var(--border)' }}
                        >
                            {isSyncing ? <Loader2 className="animate-spin" size={16} /> : <Database size={16} />}
                            Integrar Costos ({selectedIndices.size})
                        </button>
                        <button
                            onClick={handleFinalSync}
                            className="btn btn-primary"
                            style={{ 
                                gap: 8, 
                                padding: '0 24px', 
                                background: 'var(--green)', 
                                borderColor: 'var(--green)',
                                boxShadow: '0 10px 20px rgba(52, 199, 89, 0.2)' 
                            }}
                        >
                            {isSyncing ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                            PUBLICAR EN WEB ({selectedIndices.size})
                        </button>
                    </div>
                </div>

                {result && (
                    <div id="result-banner" style={{
                        padding: 16, borderRadius: 12, marginBottom: enrichStatus ? 8 : 20,
                        background: result.success ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 59, 48, 0.1)',
                        border: `1px solid ${result.success ? 'var(--green)' : 'var(--red)'}`,
                        display: 'flex', flexDirection: 'column', gap: 8
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {result.success ? <CheckCircle2 size={18} color="var(--green)" /> : <AlertCircle size={18} color="var(--red)" />}
                            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{result.message}</span>
                        </div>
                        {result.errors && result.errors.length > 0 && (
                            <ul style={{ margin: '8px 0 0 28px', fontSize: '0.8rem', color: result.success ? 'var(--text-secondary)' : 'var(--red)', opacity: 0.8 }}>
                                {result.errors.map((err, i) => <li key={i}>{err}</li>)}
                            </ul>
                        )}
                    </div>
                )}
                {enrichStatus && (
                    <div style={{
                        padding: '10px 16px', borderRadius: 12, marginBottom: 20,
                        background: 'rgba(90, 120, 255, 0.08)', border: '1px solid rgba(90, 120, 255, 0.2)',
                        fontSize: '0.85rem', color: 'var(--text-secondary)'
                    }}>
                        {enrichStatus}
                    </div>
                )}

                <div className="table-wrap" style={{ maxHeight: '70vh', overflowY: 'auto', borderRadius: 16 }}>
                    <table style={{ borderCollapse: 'separate', borderSpacing: '0 4px' }}>
                        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
                             <tr>
                                <th style={{ width: 40 }}><input type="checkbox" checked={selectedIndices.size === parsedItems.length && parsedItems.length > 0} onChange={toggleSelectAll} /></th>
                                <th>Producto / Coincidencia</th>
                                <th style={{ width: 150 }}>Categoría</th>
                                <th style={{ width: 120 }}>P. Costo (USD)</th>
                                <th style={{ width: 120 }}>P. Venta (USD)</th>
                                <th style={{ width: 100 }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {parsedItems.map((item, idx) => {
                                // Aplicar filtro de búsqueda
                                const terms = searchTerm.toLowerCase().trim().split(/\s+/).filter(t => t !== '')
                                const matchesSearch = terms.length === 0 || terms.every(term => 
                                    item.name.toLowerCase().includes(term) || 
                                    (item.categoryName && item.categoryName.toLowerCase().includes(term)) ||
                                    (item.originalDescription && item.originalDescription.toLowerCase().includes(term))
                                );
                                
                                if (!matchesSearch) return null;

                                const rowBg = item.status === 'deactivate' ? 'rgba(255, 59, 48, 0.08)' :
                                              item.status === 'new' ? 'rgba(52, 199, 89, 0.08)' :
                                              item.status === 'matched' ? 'rgba(0, 122, 255, 0.08)' :
                                              selectedIndices.has(idx) ? 'rgba(255, 255, 255, 0.02)' : 'transparent';
                                
                                return (
                                <tr key={idx} style={{
                                    background: rowBg,
                                    transition: 'background 0.2s',
                                    borderLeft: `4px solid ${
                                        item.status === 'deactivate' ? 'var(--red)' : 
                                        item.status === 'new' ? 'var(--green)' : 
                                        item.status === 'matched' ? 'var(--blue)' : 'transparent'
                                    }`,
                                    opacity: selectedIndices.has(idx) ? 1 : 0.6
                                }}>
                                    <td><input type="checkbox" checked={selectedIndices.has(idx)} onChange={() => toggleItem(idx)} /></td>
                                    <td>
                                        <div style={{ fontWeight: 600, color: item.status === 'deactivate' ? 'var(--red)' : 'inherit', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                            {item.name}
                                            {item.status === 'new' && <span style={{ fontSize: '0.65rem', background: 'rgba(52, 199, 89, 0.15)', color: 'var(--green)', padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>NUEVO</span>}
                                            {item.status === 'matched' && <span style={{ fontSize: '0.65rem', background: 'rgba(0, 122, 255, 0.15)', color: 'var(--blue)', padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>ACTUALIZACIÓN</span>}
                                            {item.status === 'deactivate' && <span style={{ fontSize: '0.65rem', background: 'rgba(255, 59, 48, 0.15)', color: 'var(--red)', padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>ELIMINAR</span>}
                                            {item.isActive === false && item.status !== 'deactivate' && <span style={{ fontSize: '0.65rem', background: 'rgba(255, 59, 48, 0.15)', color: 'var(--red)', padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>SE ACTIVARÁ</span>}
                                        </div>
                                        {item.matchName && (
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                                <Database size={10} /> {item.matchName} 
                                                <span style={{ fontSize: '0.65rem', color: 'var(--blue)', fontWeight: 800 }}>({item.similarity}%)</span>
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            {item.categoryName || '—'}
                                        </div>
                                    </td>
                                    <td style={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: 'monospace' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            {item.currentCost !== undefined && item.currentCost !== item.cost && (
                                                <span style={{ fontSize: '0.7rem', textDecoration: 'line-through', opacity: 0.5 }}>${item.currentCost}</span>
                                            )}
                                            <span>${item.cost}</span>
                                        </div>
                                    </td>
                                    <td style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--green)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            {item.currentPrice !== undefined && item.currentPrice !== item.finalPrice && (
                                                <span style={{ fontSize: '0.7rem', textDecoration: 'line-through', color: 'var(--text-muted)', fontWeight: 400 }}>${item.currentPrice}</span>
                                            )}
                                            <span>${item.finalPrice}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button 
                                                onClick={() => openEditModal(idx, item)} 
                                                className="btn btn-ghost btn-sm" 
                                                title="Editar"
                                                style={{ width: 32, height: 32, padding: 0, border: '1px solid var(--border)' }}
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            <button 
                                                onClick={() => deleteItem(idx)} 
                                                className="btn btn-ghost btn-sm" 
                                                title="Eliminar"
                                                style={{ width: 32, height: 32, padding: 0, color: 'var(--red)', border: '1px solid rgba(255, 59, 48, 0.2)' }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                
                {/* Modal de Edición Local */}
                {editingItem && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
                        <div className="card" style={{ width: 500, minHeight: 650, maxHeight: '90vh', overflowY: 'auto', padding: 32, borderRadius: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: 24 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <h3 style={{ fontWeight: 900, fontSize: '1.4rem' }}>Editar Producto</h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Ajusta los detalles antes de integrar a la base de datos.</p>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>NOMBRE DEL PRODUCTO</label>
                                    <input 
                                        type="text" 
                                        value={editingItem.name} 
                                        onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '12px 16px', borderRadius: 12, color: 'white', fontWeight: 500 }}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>COSTO (USD)</label>
                                        <input 
                                            type="number" 
                                            value={editingItem.cost} 
                                            onChange={(e) => {
                                                const cost = parseFloat(e.target.value) || 0;
                                                const sale = Math.ceil(((cost / 0.90) + 25) / 5) * 5;
                                                setEditingItem({ ...editingItem, cost, sale });
                                            }}
                                            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '12px 16px', borderRadius: 12, color: 'white', fontWeight: 700 }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>VENTA (USD)</label>
                                        <input 
                                            type="number" 
                                            value={editingItem.sale} 
                                            onChange={(e) => setEditingItem({ ...editingItem, sale: parseFloat(e.target.value) || 0 })}
                                            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '12px 16px', borderRadius: 12, color: 'var(--green)', fontWeight: 800 }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>CATEGORÍA</label>
                                    <SearchableSelect 
                                        options={categories.map(c => ({ value: c.name, label: c.name }))}
                                        value={editingItem.category}
                                        onChange={(val) => setEditingItem({ ...editingItem, category: val })}
                                        placeholder="Seleccionar categoría..."
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                                <button onClick={() => setEditingItem(null)} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
                                <button onClick={saveEdit} className="btn btn-primary" style={{ flex: 1, fontWeight: 800 }}>Guardar Cambios</button>
                            </div>
                        </div>
                    </div>
                )}
                {bulkPreviewModal}
            </div>
        )
    }

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                        <DollarSign size={24} />
                    </div>
                    Sincronización de Precios
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
                    Sincroniza masivamente desde texto plano o JSON con detección inteligente.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
                <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    
                    {/* Sección de Carga Rápida */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px', background: 'rgba(52, 199, 89, 0.05)', borderRadius: 12, border: '1px solid rgba(52, 199, 89, 0.1)' }}>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--green-dark)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <FileJson size={14} /> CARGA MÁGICA (Archivos Generados)
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <button 
                                onClick={() => handleAutoLoad('productos_zentek.json')}
                                className="btn btn-ghost btn-sm"
                                style={{ background: 'white', border: '1px solid var(--border)', fontSize: '0.75rem', height: 'auto', padding: '8px' }}
                            >
                                📦 Zentek
                            </button>
                            <button 
                                onClick={() => handleAutoLoad('productos_kadabra.json')}
                                className="btn btn-ghost btn-sm"
                                style={{ background: 'white', border: '1px solid var(--border)', fontSize: '0.75rem', height: 'auto', padding: '8px' }}
                            >
                                🐰 Kadabra
                            </button>
                            <button 
                                onClick={() => handleAutoLoad('productos_tecnoduo.json')}
                                className="btn btn-ghost btn-sm"
                                style={{ background: 'white', border: '1px solid var(--border)', fontSize: '0.75rem', height: 'auto', padding: '8px' }}
                            >
                                👥 Tecno Duo
                            </button>
                            <button 
                                onClick={() => handleAutoLoad('productos_ram.json')}
                                className="btn btn-ghost btn-sm"
                                style={{ background: 'white', border: '1px solid var(--border)', fontSize: '0.75rem', height: 'auto', padding: '8px' }}
                            >
                                💎 Todos (Mejor Precio)
                            </button>
                             <button 
                                onClick={handleShowRecalculatePreview}
                                disabled={isSyncing}
                                className="btn btn-ghost btn-sm"
                                style={{ background: 'rgba(52, 199, 89, 0.1)', border: '1px solid var(--green)', fontSize: '0.75rem', height: 'auto', padding: '8px', gridColumn: 'span 2', fontWeight: 800, color: 'var(--green-dark)' }}
                            >
                                {isSyncing ? <Loader2 className="animate-spin" size={14} style={{ marginRight: 6 }} /> : <Database size={14} style={{ marginRight: 6 }} />}
                                Recalcular Todos BD (Modo Ceil)
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <button
                                onClick={() => setProvider('gcgroup')}
                                style={{
                                    padding: '12px', borderRadius: 12,
                                    border: `2px solid ${provider === 'gcgroup' ? 'var(--green)' : 'var(--border)'}`,
                                    background: provider === 'gcgroup' ? 'rgba(52, 199, 89, 0.05)' : 'transparent',
                                    cursor: 'pointer', transition: 'all 0.2s ease',
                                    display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center'
                                }}
                            >
                                <FileJson size={18} color={provider === 'gcgroup' ? 'var(--green)' : 'var(--text-muted)'} />
                                <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>GCgroup</span>
                            </button>
                            <button
                                onClick={() => setProvider('zentek')}
                                style={{
                                    padding: '12px', borderRadius: 12,
                                    border: `2px solid ${provider === 'zentek' ? 'var(--green)' : 'var(--border)'}`,
                                    background: provider === 'zentek' ? 'rgba(52, 199, 89, 0.05)' : 'transparent',
                                    cursor: 'pointer', transition: 'all 0.2s ease',
                                    display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center'
                                }}
                            >
                                <FileText size={18} color={provider === 'zentek' ? 'var(--green)' : 'var(--text-muted)'} />
                                <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>Zentek</span>
                            </button>
                            <button
                                onClick={() => setProvider('kadabra')}
                                style={{
                                    padding: '12px', borderRadius: 12,
                                    border: `2px solid ${provider === 'kadabra' ? 'var(--green)' : 'var(--border)'}`,
                                    background: provider === 'kadabra' ? 'rgba(52, 199, 89, 0.05)' : 'transparent',
                                    cursor: 'pointer', transition: 'all 0.2s ease',
                                    display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center'
                                }}
                            >
                                <Zap size={18} color={provider === 'kadabra' ? 'var(--green)' : 'var(--text-muted)'} />
                                <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>Kadabra</span>
                            </button>
                            <button
                                onClick={() => setProvider('tecnoduo')}
                                style={{
                                    padding: '12px', borderRadius: 12,
                                    border: `2px solid ${provider === 'tecnoduo' ? 'var(--green)' : 'var(--border)'}`,
                                    background: provider === 'tecnoduo' ? 'rgba(52, 199, 89, 0.05)' : 'transparent',
                                    cursor: 'pointer', transition: 'all 0.2s ease',
                                    display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center'
                                }}
                            >
                                <ShieldCheck size={18} color={provider === 'tecnoduo' ? 'var(--green)' : 'var(--text-muted)'} />
                                <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>Tecno Duo</span>
                            </button>
                        </div>
                    </div>

                    <div style={{ position: 'relative' }}>
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={['gcgroup', 'kadabra', 'tecnoduo'].includes(provider) ? 'Pega el JSON aquí...' : 'Pega el texto de Zentek aquí...'}
                            style={{
                                width: '100%', height: '300px', padding: '20px', borderRadius: '16px',
                                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.85rem',
                                outline: 'none', resize: 'none', transition: 'border-color 0.2s ease'
                            }}
                        />
                        {input && (
                            <button
                                onClick={() => setInput('')}
                                style={{ position: 'absolute', top: 12, right: 12, padding: 6, borderRadius: 8, background: 'rgba(0,0,0,0.1)', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                            >
                                Limpiar
                            </button>
                        )}
                    </div>

                    <button
                        onClick={handleParse}
                        disabled={isLoading || !input.trim()}
                        className="btn btn-primary"
                        style={{
                            padding: '16px', borderRadius: 14, fontSize: '1rem', fontWeight: 800,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                            boxShadow: '0 10px 20px rgba(52, 199, 89, 0.2)'
                        }}
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
                        Previsualizar Importación
                    </button>
                </div>

                {bulkPreviewModal}
            </div>
        </div>
    )
}
