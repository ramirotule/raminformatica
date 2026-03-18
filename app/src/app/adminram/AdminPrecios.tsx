'use client'

import { useState, useEffect } from 'react'
import { DollarSign, Upload, Zap, AlertCircle, CheckCircle2, FileJson, FileText, Loader2, ShieldCheck, ArrowLeft, Search, CheckSquare, PlusCircle, Database, Building2 } from 'lucide-react'
import { parseImportData, searchMatches, processSync, getMissingProducts, triggerEnrichment, type ParsedItem } from './precios/actions'
import { SearchableSelect } from '@/components/SearchableSelect'
import { supabase } from '@/lib/supabase'

export default function AdminPrecios() {
    const [view, setView] = useState<'input' | 'preview'>('input')
    const [provider, setProvider] = useState<'gcgroup' | 'zentek'>('gcgroup')
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

    useEffect(() => {
        async function fetchProviders() {
            const { data } = await supabase.from('providers').select('id, name').eq('active', true).order('name')
            if (data) setProviders(data)
        }
        fetchProviders()
    }, [])

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
            } else {
                setProvider('gcgroup')
            }

            // Trigger automatic parse after loading
            const parseRes = await parseImportData(JSON.stringify(data), fileName.includes('zentek') ? 'zentek' : 'gcgroup')
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
        console.log('Iniciando handleFinalSync...');
        console.log('Seleccionados:', selectedIndices.size);
        console.log('Provider ID:', databaseProviderId);

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
            console.log('Items a enviar al servidor:', itemsToSync.length);

            const res = await processSync(itemsToSync, isCatalogSync ? undefined : databaseProviderId)
            console.log('Respuesta del servidor:', res);

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
            alert('Error crítico: ' + err.message);
            setResult({ success: false, message: 'Error durante la sincronización final: ' + err.message })
        } finally {
            setIsSyncing(false)
            window.scrollTo({ top: 0, behavior: 'smooth' })
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

    const getSimilarityColor = (score?: number) => {
        if (!score) return 'var(--text-muted)'
        if (score > 95) return 'var(--green)'
        if (score > 80) return 'var(--blue)'
        if (score > 60) return 'var(--orange)'
        return 'var(--red)'
    }

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
                        {isCatalogSync ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 20, background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.3)' }}>
                                <Database size={14} color="var(--green-dark)" />
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--green-dark)' }}>Catálogo Completo</span>
                            </div>
                        ) : (
                            <div style={{ width: 250 }}>
                                <SearchableSelect
                                    value={databaseProviderId}
                                    onChange={(val) => setDatabaseProviderId(val)}
                                    options={providers.map(p => ({ value: p.id, label: p.name }))}
                                    placeholder="Elegir proveedor..."
                                />
                            </div>
                        )}
                        {parsedItems.length > 0 && (
                            <div style={{ display: 'flex', gap: 8, fontSize: '0.75rem' }}>
                                {(() => {
                                    const matched = parsedItems.filter(i => i.status === 'matched').length
                                    const newP = parsedItems.filter(i => i.status === 'new').length
                                    const deact = parsedItems.filter(i => i.status === 'deactivate').length
                                    return <>
                                        {matched > 0 && <span style={{ padding: '3px 8px', borderRadius: 8, background: 'rgba(52,199,89,0.1)', color: 'var(--green-dark)', fontWeight: 600 }}>↑ {matched} actualizar</span>}
                                        {newP > 0 && <span style={{ padding: '3px 8px', borderRadius: 8, background: 'rgba(0,122,255,0.1)', color: '#007AFF', fontWeight: 600 }}>+ {newP} nuevos</span>}
                                        {deact > 0 && <span style={{ padding: '3px 8px', borderRadius: 8, background: 'rgba(255,59,48,0.1)', color: 'var(--red)', fontWeight: 600 }}>✕ {deact} desactivar</span>}
                                    </>
                                })()}
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
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
                            onClick={handleFinalSync}
                            className="btn btn-primary"
                            style={{ gap: 8, padding: '0 24px' }}
                        >
                            {isSyncing ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                            Sincronizar ({selectedIndices.size})
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
                                <th style={{ width: 40 }}><input type="checkbox" checked={selectedIndices.size === parsedItems.length} onChange={toggleSelectAll} /></th>
                                <th>Producto / Coincidencia</th>
                                <th style={{ width: 130 }}>Costo</th>
                                <th style={{ width: 110 }}>Similitud</th>
                                <th style={{ width: 140 }}>Precio Venta</th>
                                <th>Estado / Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {parsedItems.map((item, idx) => (
                                <tr key={idx} style={{
                                    background: item.status === 'deactivate' ? 'rgba(255, 59, 48, 0.05)' : selectedIndices.has(idx) ? 'rgba(52, 199, 89, 0.03)' : 'transparent',
                                    transition: 'background 0.2s',
                                    opacity: selectedIndices.has(idx) ? 1 : 0.6
                                }}>
                                    <td><input type="checkbox" checked={selectedIndices.has(idx)} onChange={() => toggleItem(idx)} /></td>
                                    <td>
                                        <div style={{ fontWeight: 600, color: item.status === 'deactivate' ? 'var(--red)' : 'inherit' }}>{item.name}</div>
                                        {item.matchName && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                                <Database size={10} /> Base: {item.matchName}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ fontSize: '0.85rem' }}>
                                        {item.status !== 'deactivate' ? (
                                            item.currentCost !== undefined && item.currentCost !== item.cost ? (
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ textDecoration: 'line-through', opacity: 0.5, fontSize: '0.75rem' }}>${item.currentCost}</span>
                                                    <span style={{ fontWeight: 800, color: 'var(--orange)' }}>${item.cost}</span>
                                                </div>
                                            ) : (
                                                <span style={{ fontFamily: 'monospace', opacity: 0.8 }}>${item.cost}</span>
                                            )
                                        ) : '—'}
                                    </td>
                                    <td>
                                        {item.similarity !== undefined && (
                                            <div style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                color: getSimilarityColor(item.similarity),
                                                background: `${getSimilarityColor(item.similarity)}15`,
                                                padding: '2px 8px',
                                                borderRadius: 6,
                                                width: 'fit-content'
                                            }}>
                                                {item.similarity}% conf.
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        {item.status === 'matched' ? (
                                            <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ textDecoration: 'line-through', opacity: 0.5, fontSize: '0.75rem' }}>${item.currentPrice || '—'}</span>
                                                <span style={{ fontWeight: 800, color: 'var(--green)' }}>${item.finalPrice}</span>
                                            </div>
                                        ) : item.status === 'new' ? (
                                            <span style={{ fontWeight: 800 }}>${item.finalPrice}</span>
                                        ) : '—'}
                                    </td>
                                    <td>
                                        {item.status === 'matched' ? (
                                            <div style={{ color: 'var(--green)', fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <CheckCircle2 size={12} /> ACTUALIZAR
                                            </div>
                                        ) : item.status === 'new' ? (
                                            <div style={{ color: 'var(--orange)', fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <PlusCircle size={12} /> CREAR NUEVO
                                            </div>
                                        ) : item.status === 'deactivate' ? (
                                            <div style={{ color: 'var(--red)', fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <AlertCircle size={12} /> DESACTIVAR (NO EN LISTA)
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Analizar...</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
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
                                📦 Zentek Apple/RayBan
                            </button>
                            <button 
                                onClick={() => handleAutoLoad('productos_ram.json')}
                                className="btn btn-ghost btn-sm"
                                style={{ background: 'white', border: '1px solid var(--border)', fontSize: '0.75rem', height: 'auto', padding: '8px' }}
                            >
                                💎 Todos (Mejor Precio)
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ flex: 1, display: 'flex', gap: 12 }}>
                            <button
                                onClick={() => setProvider('gcgroup')}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: 12,
                                    border: `2px solid ${provider === 'gcgroup' ? 'var(--green)' : 'var(--border)'}`,
                                    background: provider === 'gcgroup' ? 'rgba(52, 199, 89, 0.05)' : 'transparent',
                                    cursor: 'pointer', transition: 'all 0.2s ease',
                                    display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center'
                                }}
                            >
                                <FileJson size={20} color={provider === 'gcgroup' ? 'var(--green)' : 'var(--text-muted)'} />
                                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>GCgroup</span>
                            </button>
                            <button
                                onClick={() => setProvider('zentek')}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: 12,
                                    border: `2px solid ${provider === 'zentek' ? 'var(--green)' : 'var(--border)'}`,
                                    background: provider === 'zentek' ? 'rgba(52, 199, 89, 0.05)' : 'transparent',
                                    cursor: 'pointer', transition: 'all 0.2s ease',
                                    display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center'
                                }}
                            >
                                <FileText size={20} color={provider === 'zentek' ? 'var(--green)' : 'var(--text-muted)'} />
                                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Zentek Text</span>
                            </button>
                        </div>
                        
                        <div style={{ position: 'relative' }}>
                             <input 
                                type="file" 
                                id="json-upload" 
                                accept=".json,.txt" 
                                onChange={handleFileUpload} 
                                style={{ display: 'none' }} 
                            />
                            <label 
                                htmlFor="json-upload" 
                                className="btn btn-ghost"
                                style={{ gap: 8, background: 'var(--bg-secondary)', padding: '0 16px', height: 48, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                            >
                                <Upload size={18} /> Subir File
                            </label>
                        </div>
                    </div>

                    <div style={{ position: 'relative' }}>
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={provider === 'gcgroup' ? 'Pega el JSON aquí...' : 'Pega el texto de Zentek aquí...'}
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div className="card" style={{ padding: 20, background: 'rgba(52, 199, 89, 0.05)', border: '1px solid rgba(52, 199, 89, 0.2)' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--green)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ShieldCheck size={16} />
                            Fórmula de Cálculo
                        </h4>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            {provider === 'zentek' ? (
                                <>
                                    Para <strong>Zentek</strong> aplicamos:<br />
                                    <code style={{ display: 'block', margin: '8px 0', padding: '4px 8px', background: 'var(--bg-secondary)', borderRadius: 4, fontWeight: 700 }}>
                                        (Costo / 0.90) + 25
                                    </code>
                                    Y redondeamos al múltiplo de 5 más cercano.
                                </>
                            ) : (
                                <>
                                    Para <strong>GCgroup</strong> aplicamos:<br />
                                    <code style={{ display: 'block', margin: '8px 0', padding: '4px 8px', background: 'var(--bg-secondary)', borderRadius: 4, fontWeight: 700 }}>
                                        (Costo / 0.90) + 25
                                    </code>
                                    Y redondeamos al múltiplo de 5 más cercano.
                                </>
                            )}
                        </div>
                    </div>

                    <div className="card" style={{ padding: 20, borderStyle: 'dashed' }}>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Zap size={14} color="var(--orange)" />
                            Tip de Productividad
                        </h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Usa la <strong>"Carga Mágica"</strong> para importar los archivos que el sistema ya procesó. Es la forma más rápida y segura.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
