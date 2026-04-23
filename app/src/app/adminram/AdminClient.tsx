'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    LayoutDashboard,
    Package,
    Tag,
    Building2,
    Warehouse,
    Plus,
    Pencil,
    Trash2,
    RefreshCw,
    X,
    Check,
    CheckCircle2,
    ShieldCheck,
    AlertCircle,
    Search,
    CheckSquare,
    ChevronUp,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Loader2,
    ImagePlus,
    Upload,
    LogOut,
    ExternalLink,
    Image,
    Home,
    TrendingUp,
    Star,
    Wand2,
    Bell,
    Zap,
    Cpu,
    Sparkles,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { dict } from '@/lib/dict'
import { conditionLabel, slugify, formatUSD, getPriceUSD, smartCapitalize } from '@/lib/utils'
import type { Product, ProductWithDetails, Category, Brand, ProductVariant, Price, Inventory, HomeSlide, BrandLogo, Provider, WeeklyNews } from '@/lib/database.types'
import { SearchableSelect } from '@/components/SearchableSelect'
import { calculateSellingPrice } from '@/lib/constants'
import AdminPrecios from './AdminPrecios'
import AdminComparator from './AdminComparator'
import { bulkEnrichProducts } from './precios/actions'

type AdminSection = 'dashboard' | 'productos' | 'categorias' | 'marcas' | 'proveedores' | 'home' | 'precios' | 'comparador'

async function getFileHash(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function Sidebar({ active, onChange }: { active: AdminSection; onChange: (s: AdminSection) => void }) {
    const items: { id: AdminSection; label: string; icon: React.ReactNode }[] = [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
        { id: 'home', label: 'Home Page', icon: <Home size={16} /> },
        { id: 'productos', label: dict.admin.productos, icon: <Package size={16} /> },
        { id: 'categorias', label: dict.admin.categorias, icon: <Tag size={16} /> },
        { id: 'marcas', label: dict.admin.marcas, icon: <Building2 size={16} /> },
        { id: 'proveedores', label: 'Proveedores', icon: <Warehouse size={16} /> },
        { id: 'precios', label: 'Actualizar Precios', icon: <RefreshCw size={16} /> },
        { id: 'comparador', label: 'Comparador', icon: <TrendingUp size={16} /> },
    ]
    return (
        <aside className="admin-sidebar">
            <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                    RAM Informática
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {dict.admin.titulo}
                </div>
            </div>
            {items.map((item) => (
                <button
                    key={item.id}
                    id={`admin-nav-${item.id}`}
                    className={`admin-nav-item ${active === item.id ? 'active' : ''}`}
                    onClick={() => onChange(item.id)}
                >
                    {item.icon}
                    {item.label}
                </button>
            ))}
            <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <button
                    className="admin-nav-item"
                    onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')}
                    style={{ color: 'var(--red)', width: '100%', textAlign: 'left' }}
                >
                    <LogOut size={16} />
                    Cerrar Sesión
                </button>
            </div>
        </aside>
    )
}

// ─── Alert Banner ─────────────────────────────────────────────────────────────
function Alert({ type, message, onClose }: { type: 'success' | 'error'; message: string; onClose: () => void }) {
    return (
        <div className={`alert alert-${type}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
                {message}
            </span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex' }}>
                <X size={14} />
            </button>
        </div>
    )
}

function calculateSimilarity(s1: string, s2: string): number {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0) return 1.0;
    
    // Levenshtein bit optimized
    const editDistance = (a: string, b: string) => {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        if (a.length < b.length) [a, b] = [b, a];

        let row = Array.from({ length: b.length + 1 }, (_, i) => i);
        for (let i = 1; i <= a.length; i++) {
            let prev = i;
            for (let j = 1; j <= b.length; j++) {
                let val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
                row[j - 1] = prev;
                prev = val;
            }
            row[b.length] = prev;
        }
        return row[b.length];
    }

    const dist = editDistance(longer, shorter);
    return (longer.length - dist) / longer.length;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard() {
    const [stats, setStats] = useState({ productos: 0, categorias: 0, marcas: 0, sinStock: 0 })
    const [loading, setLoading] = useState(true)
    const [mfaEnabled, setMfaEnabled] = useState(false)
    const [verifyingPrices, setVerifyingPrices] = useState(false)
    const [priceIssues, setPriceIssues] = useState<any[]>([])
    const [verificationDone, setVerificationDone] = useState(false)
    const [editCostModalOpen, setEditCostModalOpen] = useState(false)
    const [editCostData, setEditCostData] = useState<{id: string, name: string, cost: number} | null>(null)
    const [editCostInput, setEditCostInput] = useState('')
    const [isSavingCost, setIsSavingCost] = useState(false)
    const [verifyingDuplicates, setVerifyingDuplicates] = useState(false)
    const [duplicateGroups, setDuplicateGroups] = useState<any[][]>([])
    const [duplicatesDone, setDuplicatesDone] = useState(false)

    async function verifyPrices() {
        setVerifyingPrices(true)
        setVerificationDone(false)
        setPriceIssues([])
        try {
            // Obtener variantes y precios
            const { data: variantsData, error: vErr } = await (supabase as any)
                .from('product_variants')
                .select('id, product_id, prices(amount, currency)')
            
            const variantMap = new Map()
            if (variantsData) {
                variantsData.forEach((v: any) => {
                    const priceUSD = v.prices?.find((p: any) => p.currency === 'USD')?.amount
                    if (priceUSD !== undefined) {
                        variantMap.set(v.product_id, priceUSD)
                    }
                })
            }

            const { data: productsData, error } = await (supabase as any)
                .from('products')
                .select('id, name, cost_price, price_usd')
                .eq('active', true)
            
            if (error) throw error

            const issues = []
            for (const p of (productsData as any[]) || []) {
                const cost = p.cost_price
                if (!cost) continue

                let sellPrice = p.price_usd
                if (sellPrice === undefined || sellPrice === null) {
                    sellPrice = variantMap.get(p.id)
                }

                if (sellPrice !== undefined && sellPrice !== null) {
                    // La fórmula real es (costo / 0.90) + 25 y redondeado al múltiplo de 5 más cercano
                    const exactAllowed = (cost / 0.90) + 25
                    const minAllowed = Math.ceil(exactAllowed / 5) * 5

                    if (sellPrice < minAllowed - 0.01) {
                        issues.push({ id: p.id, name: p.name, cost, sellPrice, minAllowed })
                    }
                }
            }
            setPriceIssues(issues)
            setVerificationDone(true)
        } catch (err) {
            console.error('Error verificando precios', err)
            alert('Error verificando precios')
        } finally {
            setVerifyingPrices(false)
        }
    }

    async function findDuplicates() {
        setVerifyingDuplicates(true)
        setDuplicatesDone(false)
        setDuplicateGroups([])
        try {
            const { data, error } = await (supabase as any)
                .from('products')
                .select('id, name, active, category_id, categories(name)')
            
            if (error) throw error
            const prods = data as any[]
            const groups: any[][] = []
            const processed = new Set<string>()

            for (let i = 0; i < prods.length; i++) {
                if (processed.has(prods[i].id)) continue
                const group: any[] = [prods[i]]
                
                for (let j = i + 1; j < prods.length; j++) {
                    if (processed.has(prods[j].id)) continue
                    
                    const s1 = prods[i].name.toLowerCase().trim()
                    const s2 = prods[j].name.toLowerCase().trim()
                    
                    let similarity = 0
                    if (s1 === s2) {
                        similarity = 1
                    } else {
                        // Solo calcular Levenshtein si las longitudes son similares (ahorro CPU)
                        const lenDiff = Math.abs(s1.length - s2.length)
                        if (lenDiff / Math.max(s1.length, s2.length) < 0.1) {
                            similarity = calculateSimilarity(s1, s2)
                        }
                    }

                    if (similarity >= 0.95) {
                        group.push(prods[j])
                        processed.add(prods[j].id)
                    }
                }
                if (group.length > 1) {
                    groups.push(group)
                    processed.add(prods[i].id)
                }
            }
            setDuplicateGroups(groups)
            setDuplicatesDone(true)
        } catch (err) {
            console.error('Error buscando duplicados', err)
            alert('Error buscando duplicados')
        } finally {
            setVerifyingDuplicates(false)
        }
    }

    async function deleteDuplicate(id: string) {
        if (!confirm('¿Estás seguro de eliminar este producto duplicado?')) return
        try {
            const { error } = await (supabase as any).from('products').delete().eq('id', id)
            if (error) throw error
            // Actualizar la lista localmente para no re-escanear todo
            setDuplicateGroups(prev => prev.map(group => group.filter(p => p.id !== id)).filter(group => group.length > 1))
        } catch (err) {
            alert('Error al eliminar el producto')
        }
    }

    const dismissGroup = (idx: number) => {
        setDuplicateGroups(prev => prev.filter((_, i) => i !== idx))
    }

    function openEditCostModal(id: string, name: string, currentCost: number) {
        setEditCostData({ id, name, cost: currentCost })
        setEditCostInput(currentCost.toString())
        setEditCostModalOpen(true)
    }

    async function saveCostPrice() {
        if (!editCostData) return
        const newCost = parseFloat(editCostInput.replace(',', '.'))
        if (isNaN(newCost) || newCost < 0) {
            alert("Precio no válido")
            return
        }

        setIsSavingCost(true)
        try {
            const { error } = await (supabase as any).from('products').update({ cost_price: newCost }).eq('id', editCostData.id)
            if (error) throw error
            setEditCostModalOpen(false)
            verifyPrices()
        } catch (err) {
            console.error('Error actualizando costo', err)
            alert("Error al actualizar el precio de costo")
        } finally {
            setIsSavingCost(false)
        }
    }

    useEffect(() => {
        async function load() {
            const [p, c, b, inv, mfa] = await Promise.all([
                (supabase as any).from('products').select('id', { count: 'exact', head: true }),
                (supabase as any).from('categories').select('id', { count: 'exact', head: true }),
                (supabase as any).from('brands').select('id', { count: 'exact', head: true }),
                (supabase as any).from('inventory').select('id', { count: 'exact', head: true }).eq('qty_available', 0),
                supabase.auth.mfa.listFactors()
            ])
            setStats({
                productos: p.count ?? 0,
                categorias: c.count ?? 0,
                marcas: b.count ?? 0,
                sinStock: inv.count ?? 0,
            })
            setMfaEnabled(mfa.data?.totp && mfa.data.totp.length > 0 ? true : false)
            setLoading(false)
        }
        load()
    }, [])

    const cards = [
        { label: 'Total Productos', value: stats.productos, emoji: '📦', color: 'var(--accent)' },
        { label: 'Categorías', value: stats.categorias, emoji: '🗂️', color: 'var(--green)' },
        { label: 'Marcas', value: stats.marcas, emoji: '🏷️', color: 'var(--orange)' },
        { label: 'Sin Stock', value: stats.sinStock, emoji: '⚠️', color: 'var(--red)' },
    ]

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Dashboard</h1>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: '0.8rem',
                    padding: '6px 12px',
                    borderRadius: 100,
                    background: mfaEnabled ? 'rgba(52,199,89,0.1)' : 'rgba(255,159,10,0.1)',
                    color: mfaEnabled ? 'var(--green)' : 'var(--orange)',
                    border: `1px solid ${mfaEnabled ? 'rgba(52,199,89,0.2)' : 'rgba(255,159,10,0.2)'}`
                }}>
                    <ShieldCheck size={14} />
                    {mfaEnabled ? '2FA Activo' : '2FA No configurado'}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
                {cards.map((card) => (
                    <div key={card.label} className="card" style={{ padding: 24 }}>
                        <div style={{ fontSize: '2rem', marginBottom: 12 }}>{card.emoji}</div>
                        {loading ? (
                            <div className="skeleton" style={{ height: 36, width: '60%', borderRadius: 6 }} />
                        ) : (
                            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: card.color, letterSpacing: '-0.04em' }}>
                                {card.value.toLocaleString('es-AR')}
                            </div>
                        )}
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>{card.label}</div>
                    </div>
                ))}
            </div>

            <div className="card" style={{ padding: 24, marginBottom: 32 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Verificador de Precios</h2>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                            Verifica que los productos activos cumplan: Precio Venta ≥ Redondeado(5, (Costo / 0.90) + $25)
                        </p>
                    </div>
                    <button 
                        onClick={verifyPrices} 
                        disabled={verifyingPrices}
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                        {verifyingPrices ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        Verificar Precios
                    </button>
                </div>
                
                {verificationDone && (
                    <div style={{ marginTop: 24 }}>
                        {priceIssues.length === 0 ? (
                            <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CheckCircle2 size={16} /> Todos los productos cumplen con la regla de precio.
                            </div>
                        ) : (
                            <div>
                                <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                    <AlertCircle size={16} /> Se encontraron {priceIssues.length} producto(s) por debajo del precio mínimo esperado.
                                </div>
                                <div className="table-wrap" style={{ maxHeight: 350, overflowY: 'auto' }}>
                                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                <th style={{ padding: '12px 8px' }}>Producto</th>
                                                <th style={{ padding: '12px 8px' }}>Costo</th>
                                                <th style={{ padding: '12px 8px' }}>Precio Actual</th>
                                                <th style={{ padding: '12px 8px' }}>Mínimo Esperado</th>
                                                <th style={{ padding: '12px 8px', width: 60, textAlign: 'center' }}>Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {priceIssues.map(issue => (
                                                <tr key={issue.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>
                                                    <td style={{ padding: 8, fontWeight: 500 }}>{issue.name}</td>
                                                    <td style={{ padding: 8 }}>${issue.cost.toFixed(2)}</td>
                                                    <td style={{ padding: 8, color: 'var(--red)', fontWeight: 700 }}>${issue.sellPrice.toFixed(2)}</td>
                                                    <td style={{ padding: 8, color: 'var(--green)', fontWeight: 700 }}>${issue.minAllowed.toFixed(2)}</td>
                                                    <td style={{ padding: 8, textAlign: 'center' }}>
                                                        <button 
                                                            className="btn btn-ghost btn-sm" 
                                                            style={{ padding: 4 }}
                                                            onClick={() => openEditCostModal(issue.id, issue.name, issue.cost)}
                                                            title="Editar Costo"
                                                        >
                                                            <Pencil size={14} color="var(--text-secondary)" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="card" style={{ padding: 24, marginBottom: 32 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Buscador de Duplicados</h2>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                            Encuentra automáticamente productos con nombres idénticos o con una similitud del 95% o superior.
                        </p>
                    </div>
                    <button 
                        onClick={findDuplicates} 
                        disabled={verifyingDuplicates}
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--orange)', borderColor: 'var(--orange)' }}
                    >
                        {verifyingDuplicates ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                        Buscar Duplicados
                    </button>
                </div>
                
                {duplicatesDone && (
                    <div style={{ marginTop: 24 }}>
                        {duplicateGroups.length === 0 ? (
                            <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CheckCircle2 size={16} /> No se encontraron productos duplicados.
                            </div>
                        ) : (
                            <div>
                                <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, background: 'rgba(255,159,10,0.1)', color: 'var(--orange)', border: '1px solid var(--orange)' }}>
                                    <AlertCircle size={16} /> Se encontraron {duplicateGroups.length} grupo(s) de posibles productos duplicados.
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {duplicateGroups.map((group, gIdx) => (
                                        <div key={gIdx} className="card" style={{ padding: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', position: 'relative' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    Grupo {gIdx + 1} ({group.length} coincidencias)
                                                </div>
                                                <button 
                                                    onClick={() => dismissGroup(gIdx)}
                                                    className="btn btn-ghost btn-sm"
                                                    style={{ padding: 4, height: 'auto', minHeight: 0 }}
                                                    title="Descartar este grupo"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {group.map(p => (
                                                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.active ? 'var(--green)' : 'var(--red)' }} title={p.active ? 'Activo' : 'Inactivo'} />
                                                            <div>
                                                                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{p.name}</div>
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.categories?.name || 'Sin categoría'} • ID: {p.id.substring(0, 8)}...</div>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: 8 }}>
                                                            <button 
                                                                className="btn btn-ghost btn-sm" 
                                                                style={{ color: 'var(--red)', padding: 6 }}
                                                                onClick={() => deleteDuplicate(p.id)}
                                                                title="Eliminar Duplicado"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {!mfaEnabled && (
                <div className="card" style={{
                    padding: 24,
                    border: '1px dashed var(--orange)',
                    background: 'rgba(255,159,10,0.03)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 20
                }}>
                    <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--orange)', marginBottom: 4 }}>Refuerza la seguridad</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Te recomendamos configurar la autenticación de dos factores (2FA) para proteger el panel de administración.
                        </p>
                    </div>
                    <a
                        href="https://supabase.com/dashboard/project/_/auth/mfa"
                        target="_blank"
                        className="btn btn-ghost"
                        style={{ borderColor: 'var(--orange)', color: 'var(--orange)', whiteSpace: 'nowrap' }}
                    >
                        Configurar en Supabase
                        <ExternalLink size={14} style={{ marginLeft: 8 }} />
                    </a>
                </div>
            )}

            {editCostModalOpen && editCostData && (
                <div className="modal-overlay animate-fade-in-fast">
                    <div className="modal" style={{ maxWidth: 400 }}>
                        <div className="modal-title">
                            <span>Editar Costo de Producto</span>
                            <button onClick={() => setEditCostModalOpen(false)} className="btn btn-ghost btn-sm"><X size={16} /></button>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <p style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 8 }}>{editCostData.name}</p>
                            <label className="form-label">Nuevo Precio de Costo (USD)</label>
                            <input 
                                type="number" 
                                className="form-input" 
                                value={editCostInput} 
                                onChange={(e) => setEditCostInput(e.target.value)} 
                                placeholder="Ej. 150.50" 
                                autoFocus
                            />
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" onClick={() => setEditCostModalOpen(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={saveCostPrice} disabled={isSavingCost}>
                                {isSavingCost ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} Guardar Costo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Productos Admin ──────────────────────────────────────────────────────────
function AdminProductos() {
    const [products, setProducts] = useState<ProductWithDetails[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [brands, setBrands] = useState<Brand[]>([])
    const [providers, setProviders] = useState<Provider[]>([])
    const [loading, setLoading] = useState(true)
    const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [editProduct, setEditProduct] = useState<ProductWithDetails | null>(null)
    const [showMoreDetails, setShowMoreDetails] = useState(false)
    const [showOriginalDesc, setShowOriginalDesc] = useState(false)

    // Formulario nuevo/editar producto
    const [form, setForm] = useState({
        name: '', slug: '', category_id: '', brand_id: '', provider_id: '',
        condition: 'new', short_description: '', active: true,
        is_featured: false,
        priceUSD: '', cost_price: '', sku: '', color: '', storage: '', connectivity: '',
        tags: '',
        long_description: '',
        descripcion_original: '',
    })
    const [images, setImages] = useState<{ id: string, file?: File, url: string, isExisting: boolean, storagePath?: string }[]>([])
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
    const [lightboxOpen, setLightboxOpen] = useState(false)
    const [lightboxIndex, setLightboxIndex] = useState(0)

    // Estado para Bulk Actions y Búsqueda
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false)
    const [bulkBrandOpen, setBulkBrandOpen] = useState(false)
    const [bulkProviderOpen, setBulkProviderOpen] = useState(false)
    const [bulkCategoryForm, setBulkCategoryForm] = useState('')
    const [bulkBrandForm, setBulkBrandForm] = useState('')
    const [bulkProviderForm, setBulkProviderForm] = useState('')
    const [bulkImagesOpen, setBulkImagesOpen] = useState(false)
    const [bulkImagesData, setBulkImagesData] = useState<Record<string, File[]>>({})
    const [bulkRenameOpen, setBulkRenameOpen] = useState(false)
    const [bulkRenameSearch, setBulkRenameSearch] = useState('')
    const [bulkRenameReplace, setBulkRenameReplace] = useState('')
    const [bulkTagsOpen, setBulkTagsOpen] = useState(false)
    const [bulkTagsForm, setBulkTagsForm] = useState('')
    const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
    const [singleDeleteConfirm, setSingleDeleteConfirm] = useState<{ id: string; name: string } | null>(null)

    type SortField = 'name' | 'categories.name' | 'brands.name' | 'providers.name' | 'priceUSD' | 'condition' | 'active'
    const [sortField, setSortField] = useState<SortField>('name')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
    const [isSaving, setIsSaving] = useState(false)
    const [providerFilter, setProviderFilter] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('')
    const [brandFilter, setBrandFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortOrder('asc')
        }
    }

    const showAlert = (type: 'success' | 'error', message: string) => {
        setAlert({ type, message })
        setTimeout(() => setAlert(null), 4000)
    }

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [pRes, cRes, bRes, provRes] = await Promise.all([
                supabase
                    .from('products')
                    .select('*, categories(*), brands(*), product_variants(*, prices(*), inventory(*)), product_images(*)')
                    .order('created_at', { ascending: false })
                    .limit(1000),
                (supabase as any).from('categories').select('*').order('name'),
                (supabase as any).from('brands').select('*').order('name'),
                (supabase as any).from('providers').select('*').order('name'),
            ])

            if (pRes.error) {
                console.error('Error loading products:', pRes.error)
                showAlert('error', 'Error al cargar productos: ' + pRes.error.message)
            }

            const productsData = (pRes.data as any) ?? []
            const providersData = (provRes.data as any) ?? []

            // Cruce manual ya que no hay una relación (Foreign Key) explícita en la DB
            const enrichedProducts = productsData.map((p: any) => ({
                ...p,
                providers: providersData.find((prov: any) => prov.id === p.provider_id)
            }))

            setProducts(enrichedProducts)
            setCategories((cRes.data as any) ?? [])
            setBrands((bRes.data as any) ?? [])
            setProviders(providersData)
        } catch (error: any) {
            console.error('Unexpected error in load:', error)
            showAlert('error', 'Error inesperado: ' + error.message)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    const filteredProducts = products.filter(p => {
        const terms = searchQuery.toLowerCase().trim().split(/\s+/).filter(t => t !== '')
        
        let matchesSearch = true;
        if (terms.length > 0) {
            // Concatenamos todos los campos buscables para este producto
            const searchableText = [
                p.name.toLowerCase(),
                p.brands?.name?.toLowerCase() || '',
                p.categories?.name?.toLowerCase() || '',
                p.providers?.name?.toLowerCase() || '',
                p.short_description?.toLowerCase() || '',
                p.long_description?.toLowerCase() || '',
                ...(p.tags || []).map(t => t.toLowerCase()),
                p.product_variants?.[0]?.sku?.toLowerCase() || '',
                p.product_variants?.[0]?.storage?.toLowerCase() || '',
                p.product_variants?.[0]?.color?.toLowerCase() || '',
                p.product_variants?.[0]?.connectivity?.toLowerCase() || ''
            ].join(' ')

            // Cada término de la búsqueda debe estar presente en el texto buscable
            matchesSearch = terms.every(term => {
                // Si el término es puramente numérico (ej: "8"), queremos evitar que coincida con "128"
                if (/^\d+$/.test(term)) {
                    const regex = new RegExp(`(^|[^0-9])${term}([^0-9]|$)`, 'i')
                    return regex.test(searchableText)
                }
                return searchableText.includes(term)
            })
        }

        const matchesProvider = !providerFilter || p.provider_id === providerFilter
        const matchesCategory = !categoryFilter || p.category_id === categoryFilter
        const matchesBrand = !brandFilter || p.brand_id === brandFilter
        const matchesStatus = statusFilter === 'all' || 
                             (statusFilter === 'active' && p.active) || 
                             (statusFilter === 'inactive' && !p.active)

        return matchesSearch && matchesProvider && matchesCategory && matchesBrand && matchesStatus
    })

    const sortedProducts = [...filteredProducts].sort((a, b) => {
        let valA: any = ''
        let valB: any = ''

        if (sortField === 'name') {
            valA = a.name.toLowerCase()
            valB = b.name.toLowerCase()
        } else if (sortField === 'categories.name') {
            valA = a.categories?.name?.toLowerCase() || ''
            valB = b.categories?.name?.toLowerCase() || ''
        } else if (sortField === 'brands.name') {
            valA = a.brands?.name?.toLowerCase() || ''
            valB = b.brands?.name?.toLowerCase() || ''
        } else if (sortField === 'providers.name') {
            valA = a.providers?.name?.toLowerCase() || ''
            valB = b.providers?.name?.toLowerCase() || ''
        } else if (sortField === 'priceUSD') {
            const priceA = a.product_variants?.[0]?.prices?.find((pr: any) => pr.currency === 'USD')?.amount
            const priceB = b.product_variants?.[0]?.prices?.find((pr: any) => pr.currency === 'USD')?.amount
            valA = priceA ? Number(priceA) : 0
            valB = priceB ? Number(priceB) : 0
        } else if (sortField === 'condition') {
            valA = a.condition || ''
            valB = b.condition || ''
        } else if (sortField === 'active') {
            valA = a.active ? 1 : 0
            valB = b.active ? 1 : 0
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1
        return 0
    })

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setSelectedIds(newSet)
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === sortedProducts.length && sortedProducts.length > 0) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(sortedProducts.map(p => p.id)))
        }
    }

    async function performBulkRename(mode: 'clean' | 'replace') {
        if (!selectedIds.size) return

        setIsSaving(true)
        try {
            const productsToClean = products.filter(p => selectedIds.has(p.id))
            // Regex más robusta para emojis sin usar secuencias problemáticas para el editor
            const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g

            for (const p of productsToClean) {
                let newName = p.name;
                if (mode === 'clean') {
                    const noEmojis = p.name.replace(emojiRegex, '').replace(/\s+/g, ' ').trim()
                    newName = smartCapitalize(noEmojis)
                } else if (mode === 'replace' && bulkRenameSearch) {
                    // Escapar caracteres especiales para tratar la búsqueda como texto literal
                    const escapedSearch = bulkRenameSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                    const regex = new RegExp(escapedSearch, 'gi')
                    newName = p.name.replace(regex, bulkRenameReplace).replace(/\s+/g, ' ').trim()
                }

                if (newName !== p.name) {
                    await (supabase as any).from('products').update({ name: newName, slug: slugify(newName) }).eq('id', p.id)
                }
            }

            showAlert('success', 'Nombres actualizados correctamente.')
            setBulkRenameOpen(false)
            setBulkRenameSearch('')
            setBulkRenameReplace('')
            setSelectedIds(new Set())
            load()
        } catch (error: any) {
            showAlert('error', 'Error al procesar nombres: ' + error.message)
        } finally {
            setIsSaving(false)
        }
    }

    async function bulkStatus(active: boolean) {
        if (!selectedIds.size) return
        await ((supabase as any).from('products') as any).update({ active }).in('id', Array.from(selectedIds))
        showAlert('success', `Productos ${active ? 'activados' : 'pausados'} masivamente.`)
        setSelectedIds(new Set())
        load()
    }

    function bulkDelete() {
        if (!selectedIds.size) return
        setBulkDeleteConfirm(true)
    }

    async function executeBulkDelete() {
        setBulkDeleteConfirm(false)
        await (supabase as any).from('products').delete().in('id', Array.from(selectedIds))
        showAlert('success', 'Productos eliminados masivamente.')
        setSelectedIds(new Set())
        load()
    }

    async function performBulkCategory() {
        if (!selectedIds.size || !bulkCategoryForm) return
        await ((supabase as any).from('products') as any).update({ category_id: bulkCategoryForm }).in('id', Array.from(selectedIds))
        showAlert('success', 'Categoría actualizada para los productos seleccionados.')
        setBulkCategoryOpen(false)
        setSelectedIds(new Set())
        load()
    }

    async function performBulkBrand() {
        if (!selectedIds.size || !bulkBrandForm) return
        await ((supabase as any).from('products') as any).update({ brand_id: bulkBrandForm }).in('id', Array.from(selectedIds))
        showAlert('success', 'Marca actualizada para los productos seleccionados.')
        setBulkBrandOpen(false)
        setSelectedIds(new Set())
        load()
    }

    async function performBulkProvider() {
        if (!selectedIds.size || !bulkProviderForm) return
        await ((supabase as any).from('products') as any).update({ provider_id: bulkProviderForm }).in('id', Array.from(selectedIds))
        showAlert('success', 'Proveedor actualizado para los productos seleccionados.')
        setBulkProviderOpen(false)
        setSelectedIds(new Set())
        load()
    }

    async function performBulkTags() {
        if (!selectedIds.size || !bulkTagsForm) return

        setIsSaving(true)
        try {
            const newTags = bulkTagsForm.split(',').map(t => t.trim().toLowerCase()).filter(t => t !== '')

            // Traemos los productos actuales para no pisar los tags que ya tienen
            const { data: currentProducts } = await supabase
                .from('products')
                .select('id, tags')
                .in('id', Array.from(selectedIds))

            if (currentProducts) {
                for (const p of currentProducts as any[]) {
                    const existingTags = p.tags || []
                    const updatedTags = Array.from(new Set([...existingTags, ...newTags]))

                    await (supabase as any).from('products').update({
                        tags: updatedTags
                    }).eq('id', p.id)
                }
            }

            showAlert('success', 'Tags actualizados masivamente.')
            setBulkTagsOpen(false)
            setBulkTagsForm('')
            setSelectedIds(new Set())
            load()
        } catch (error: any) {
            showAlert('error', 'Error al procesar tags: ' + error.message)
        } finally {
            setIsSaving(false)
        }
    }

    async function handleBulkEnrichment(mode: 'all' | 'descriptions' | 'images' = 'all') {
        if (!selectedIds.size) return
        setIsSaving(true)
        try {
            const res = await bulkEnrichProducts(Array.from(selectedIds), mode)
            if (res.success) {
                showAlert('success', res.message)
                setSelectedIds(new Set())
                load()
            } else {
                showAlert('error', res.message)
            }
        } catch (error: any) {
            showAlert('error', 'Error en el enriquecimiento: ' + error.message)
        } finally {
            setIsSaving(false)
        }
    }

    function openNew() {
        setEditProduct(null)
        setForm({
            name: '',
            slug: '',
            category_id: '',
            brand_id: '',
            provider_id: '',
            condition: 'new',
            short_description: '',
            active: true,
            is_featured: false,
            priceUSD: '',
            cost_price: '',
            sku: '',
            color: '',
            storage: '',
            connectivity: '',
            tags: '',
            long_description: '',
            descripcion_original: '',
        })
        setImages([])
        setShowMoreDetails(false)
        setShowOriginalDesc(false)
        setModalOpen(true)
    }

    function openEdit(p: ProductWithDetails) {
        const variant = p.product_variants?.[0]
        const price = variant?.prices?.find((pr: any) => pr.currency === 'USD')
        setEditProduct(p)
        setForm({
            name: p.name,
            slug: p.slug,
            category_id: p.category_id || '',
            brand_id: p.brand_id || '',
            provider_id: p.provider_id || '',
            condition: p.condition || 'new',
            short_description: p.short_description ?? '',
            active: p.active,
            is_featured: p.is_featured,
            priceUSD: p.price_usd ? String(p.price_usd) : (price ? String(price.amount) : ''),
            cost_price: p.cost_price ? String(p.cost_price) : '',
            sku: variant?.sku ?? '',
            color: variant?.color ?? '',
            storage: variant?.storage ?? '',
            connectivity: variant?.connectivity ?? '',
            tags: p.tags ? p.tags.join(', ') : '',
            long_description: p.long_description || '',
            descripcion_original: (p as any).descripcion_original || '',
        })
        setShowMoreDetails(false)
        setShowOriginalDesc(false)
        const sortedImages = [...(p.product_images || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        setImages(sortedImages.map(img => ({
            id: img.id,
            url: img.public_url || '',
            isExisting: true,
            storagePath: img.storage_path
        })))
        setModalOpen(true)
    }

    async function performBulkImages() {
        if (selectedIds.size === 0) return
        setIsSaving(true)
        try {
            for (const productId of Array.from(selectedIds)) {
                const files = bulkImagesData[productId] || []
                if (files.length === 0) continue

                // Get current max sort order for this product
                const { data: currentImages } = await supabase
                    .from('product_images')
                    .select('sort_order')
                    .eq('product_id', productId)
                    .order('sort_order', { ascending: false })
                    .limit(1)

                let nextSortOrder = ((currentImages as any)?.[0]?.sort_order ?? -1) + 1

                for (let i = 0; i < files.length; i++) {
                    const file = files[i]
                    const hash = await getFileHash(file)
                    const fileExt = file.name.split('.').pop()
                    const fileName = `${hash}.${fileExt}`

                    const { error: uploadError } = await supabase.storage.from('Images').upload(fileName, file)

                    if (!uploadError || (uploadError as any).status === 409 || uploadError.message?.includes('already exists')) {
                        const { data: { publicUrl } } = supabase.storage.from('Images').getPublicUrl(fileName)
                        await (supabase as any).from('product_images').insert({
                            product_id: productId,
                            storage_path: fileName,
                            public_url: publicUrl,
                            alt: `Bulk Upload ${i + 1}`,
                            sort_order: nextSortOrder++
                        })
                    }
                }
            }
            showAlert('success', 'Imágenes subidas correctamente.')
            setBulkImagesOpen(false)
            setBulkImagesData({})
            load()
        } catch (error: any) {
            showAlert('error', error.message || 'Error al subir imágenes')
        } finally {
            setIsSaving(false)
        }
    }

    async function handleSave() {
        if (!form.name || !form.category_id || !form.brand_id) {
            showAlert('error', 'Nombre, categoría y marca son requeridos.')
            return
        }

        setIsSaving(true)
        try {
            const slug = form.slug || slugify(form.name)
            let currentProductId = ''

            if (editProduct) {
                currentProductId = editProduct.id
                // UPDATE producto
                const { error: pErr } = await (supabase as any)
                    .from('products')
                    .update({
                        name: form.name, slug, category_id: form.category_id, brand_id: form.brand_id,
                        provider_id: form.provider_id || null,
                        cost_price: form.cost_price ? parseFloat(form.cost_price) : null,
                        price_usd: form.priceUSD ? parseFloat(form.priceUSD) : null,
                        condition: form.condition as 'new', short_description: form.short_description || null,
                        long_description: form.long_description || null,
                        descripcion_original: form.descripcion_original || null,
                        active: form.active, is_featured: form.is_featured,
                    })
                    .eq('id', editProduct.id)

                if (pErr) throw pErr

                // UPDATE variant
                const variant = editProduct.product_variants?.[0]
                if (variant) {
                    const { error: vErr } = await ((supabase as any).from('product_variants') as any).update({
                        sku: form.sku || `${slug}-v1`, color: form.color || null,
                        storage: form.storage || null, connectivity: form.connectivity || null,
                    }).eq('id', variant.id)
                    if (vErr) console.error('Error updating variant:', vErr)
                }

                // Update common fields (tags)
                const { error: tErr } = await (supabase as any).from('products').update({
                    tags: form.tags.split(',').map(t => t.trim().toLowerCase()).filter(t => t !== '')
                }).eq('id', currentProductId)
                if (tErr) console.error('Error updating tags:', tErr)

                if (variant && form.priceUSD) {
                    const { error: prErr } = await (supabase as any).from('prices').upsert({
                        variant_id: variant.id, currency: 'USD', amount: parseFloat(form.priceUSD),
                    }, { onConflict: 'variant_id,currency' })
                    if (prErr) console.error('Error upserting price:', prErr)
                }
            } else {
                // INSERT producto
                const { data: prod, error: pErr } = await (supabase as any)
                    .from('products')
                    .insert({
                        name: form.name, slug, category_id: form.category_id, brand_id: form.brand_id,
                        provider_id: form.provider_id || null,
                        cost_price: form.cost_price ? parseFloat(form.cost_price) : null,
                        price_usd: form.priceUSD ? parseFloat(form.priceUSD) : null,
                        condition: form.condition as 'new', short_description: form.short_description || null,
                        long_description: form.long_description || null,
                        active: form.active, is_featured: form.is_featured,
                        tags: form.tags.split(',').map(t => t.trim().toLowerCase()).filter(t => t !== '')
                    })
                    .select()
                    .single()

                if (pErr || !prod) {
                    console.error('Error creating product:', pErr)
                    throw new Error(pErr?.message ?? 'Error al crear producto')
                }
                currentProductId = prod.id

                // INSERT variant
                const { data: varData, error: vErr } = await (supabase as any)
                    .from('product_variants')
                    .insert({
                        product_id: prod.id, sku: form.sku || `${slug}-v1`,
                        color: form.color || null, storage: form.storage || null,
                        connectivity: form.connectivity || null, active: true,
                    })
                    .select()
                    .single()

                if (vErr) console.error('Error creating variant:', vErr)

                // INSERT price
                if (varData && form.priceUSD) {
                    const { error: prErr } = await (supabase as any).from('prices').insert({
                        variant_id: varData.id, currency: 'USD', amount: parseFloat(form.priceUSD),
                    })
                    if (prErr) console.error('Error creating price:', prErr)

                    // INSERT inventory
                    const { error: invErr } = await (supabase as any).from('inventory').insert({
                        variant_id: varData.id, qty_available: 0, qty_reserved: 0,
                    })
                    if (invErr) console.error('Error creating inventory:', invErr)
                }
            }

            // Handle Image Save
            let imageErrors = false
            let imageErrorDetails: string[] = []
            if (currentProductId) {
                const currentExistingIds = new Set(images.filter(i => i.isExisting).map(i => i.id))
                const removedImages = (editProduct?.product_images || []).filter((img: any) => !currentExistingIds.has(img.id))

                for (const rmImg of removedImages) {
                    await (supabase as any).from('product_images').delete().eq('id', rmImg.id)
                    if (rmImg.storage_path && rmImg.storage_path.startsWith(currentProductId)) {
                        await supabase.storage.from('Images').remove([rmImg.storage_path])
                    }
                }

                for (let i = 0; i < images.length; i++) {
                    const img = images[i]
                    if (!img.isExisting && img.file) {
                        try {
                            const hash = await getFileHash(img.file)
                            const fileExt = img.file.name.split('.').pop()
                            const fileName = `${hash}.${fileExt}`
                            const { error: uploadError } = await supabase.storage.from('Images').upload(fileName, img.file, { upsert: true })

                            if (!uploadError || (uploadError as any).status === 409 || uploadError.message?.includes('already exists')) {
                                const { data: { publicUrl } } = supabase.storage.from('Images').getPublicUrl(fileName)
                                const { error: insErr } = await (supabase as any).from('product_images').insert({
                                    product_id: currentProductId,
                                    storage_path: fileName,
                                    public_url: publicUrl,
                                    alt: `${form.name} ${i + 1}`,
                                    sort_order: i,
                                    is_primary: i === 0
                                })
                                if (insErr) {
                                    console.error('Error linking image:', insErr)
                                    imageErrors = true
                                    imageErrorDetails.push(`DB: ${insErr.message}`)
                                }
                            } else {
                                console.error('Upload error:', uploadError)
                                imageErrors = true
                                imageErrorDetails.push(`Upload: ${uploadError.message}`)
                            }
                        } catch (err: any) {
                            console.error('Error processing image:', err)
                            imageErrors = true
                            imageErrorDetails.push(`Process: ${err.message}`)
                        }
                    } else if (!img.isExisting && !img.file && img.url) {
                        const { error: insErr } = await (supabase as any).from('product_images').insert({
                            product_id: currentProductId,
                            storage_path: img.url,
                            public_url: img.url,
                            alt: `${form.name} ${i + 1}`,
                            sort_order: i,
                            is_primary: i === 0
                        })
                        if (insErr) {
                            console.error('Error linking image URL:', insErr)
                            imageErrors = true
                            imageErrorDetails.push(`URL DB: ${insErr.message}`)
                        }
                    } else if (img.isExisting) {
                        await (supabase as any).from('product_images').update({
                            sort_order: i,
                            is_primary: i === 0
                        }).eq('id', img.id)
                    }
                }
            }

            if (imageErrors) {
                showAlert('error', `Guardado con errores en imágenes. Revisa el bucket "Images". Detalles: ${imageErrorDetails.join(', ')}`)
            } else {
                showAlert('success', editProduct ? 'Producto actualizado correctamente.' : 'Producto creado correctamente.')
            }
            setModalOpen(false)
            load()
        } catch (error: any) {
            console.error('Error in handleSave:', error)
            showAlert('error', error.message || 'Error al guardar')
        } finally {
            setIsSaving(false)
        }
    }

    async function handleDelete(id: string, name: string) {
        setSingleDeleteConfirm({ id, name })
    }

    async function executeSingleDelete() {
        if (!singleDeleteConfirm) return
        const { error } = await (supabase as any).from('products').delete().eq('id', singleDeleteConfirm.id)
        if (error) showAlert('error', error.message)
        else { showAlert('success', 'Producto eliminado.'); load() }
        setSingleDeleteConfirm(null)
    }

    async function toggleActive(p: ProductWithDetails) {
        await ((supabase as any).from('products') as any).update({ active: !p.active }).eq('id', p.id)
        load()
    }

    async function toggleFeatured(p: ProductWithDetails) {
        console.log('Toggling featured for product:', p.id, 'Current keys:', Object.keys(p))
        const { error } = await (supabase as any).from('products').update({ is_featured: !p.is_featured }).eq('id', p.id)
        if (error) {
            console.error('Error toggling featured:', error)
            showAlert('error', 'Error al actualizar: ' + error.message)
            // Si falla is_featured, intentar featured por si acaso
            if (error.message.includes('column "is_featured" does not exist')) {
                console.log('Trying "featured" column instead...')
                const { error: error2 } = await (supabase as any).from('products').update({ featured: !p.is_featured }).eq('id', p.id)
                if (error2) console.error('Error with featured column too:', error2)
                else { showAlert('success', 'Actualizado usando columna "featured"'); load() }
            }
        } else {
            load()
        }
    }

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{dict.admin.productos}</h1>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button id="admin-refresh-products" className="btn btn-ghost btn-sm" onClick={load} aria-label="Recargar">
                        <RefreshCw size={15} />
                    </button>
                    <button id="admin-new-product" className="btn btn-primary btn-sm" onClick={openNew}>
                        <Plus size={15} />
                        {dict.admin.nuevo}
                    </button>
                </div>
            </div>

            {/* Fila de Filtros y Búsqueda */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr repeat(4, 180px)', 
                gap: 12, 
                marginBottom: 24,
                background: 'var(--bg-card)',
                padding: '16px',
                borderRadius: 16,
                border: '1px solid var(--border)',
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', borderRadius: 10, padding: '0 12px', height: 44, border: '1px solid var(--border)' }}>
                    <Search size={16} style={{ color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, SKU, marca..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ border: 'none', background: 'transparent', padding: '8px', color: 'var(--text)', outline: 'none', width: '100%', fontSize: '0.9rem' }}
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <X size={14} />
                        </button>
                    )}
                </div>

                <SearchableSelect
                    value={categoryFilter}
                    onChange={(v) => setCategoryFilter(v)}
                    options={[
                        { value: '', label: 'Todas las Categorías' },
                        ...categories.map(c => ({ value: c.id, label: c.name }))
                    ]}
                    placeholder="Filtrar por Categoría"
                />

                <SearchableSelect
                    value={brandFilter}
                    onChange={(v) => setBrandFilter(v)}
                    options={[
                        { value: '', label: 'Todas las Marcas' },
                        ...brands.map(b => ({ value: b.id, label: b.name }))
                    ]}
                    placeholder="Filtrar por Marca"
                />

                <SearchableSelect
                    value={providerFilter}
                    onChange={(v) => setProviderFilter(v)}
                    options={[
                        { value: '', label: 'Todos los Proveedores' },
                        ...providers.map(p => ({ value: p.id, label: p.name }))
                    ]}
                    placeholder="Filtrar por Proveedor"
                />

                <SearchableSelect
                    value={statusFilter}
                    onChange={(v: any) => setStatusFilter(v)}
                    options={[
                        { value: 'all', label: 'Todos los Estados' },
                        { value: 'active', label: 'Solo Activos' },
                        { value: 'inactive', label: 'Solo Inactivos' }
                    ]}
                    placeholder="Estado"
                />
            </div>

            {selectedIds.size > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--primary-light)', borderRadius: 8, marginBottom: 16, border: '1px solid var(--primary)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--primary-dark)', fontSize: '0.9rem' }}>{selectedIds.size} seleccionado(s)</span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn btn-sm btn-primary" onClick={() => bulkStatus(true)}>Activar</button>
                        <button className="btn btn-sm btn-ghost" style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)' }} onClick={() => bulkStatus(false)}>Pausar</button>
                        <button className="btn btn-sm btn-ghost" style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)' }} onClick={() => { setBulkCategoryForm(''); setBulkCategoryOpen(true); }}>Categoría</button>
                        <button className="btn btn-sm btn-ghost" style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)' }} onClick={() => { setBulkBrandForm(''); setBulkBrandOpen(true); }}>Marca</button>
                        <button className="btn btn-sm btn-ghost" style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)' }} onClick={() => { setBulkProviderForm(''); setBulkProviderOpen(true); }}>Proveedor</button>
                        <button className="btn btn-sm btn-ghost" style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)' }} onClick={() => { setBulkTagsForm(''); setBulkTagsOpen(true); }}>
                            <Tag size={14} style={{ marginRight: 4 }} />
                            Tags
                        </button>
                        <button className="btn btn-sm btn-ghost" style={{ background: 'rgba(52,199,89,0.1)', border: '1px solid var(--accent)', color: 'var(--accent-light)' }} onClick={() => { setBulkImagesData({}); setBulkImagesOpen(true); }}>
                            <ImagePlus size={14} style={{ marginRight: 4 }} />
                            Subir Imágenes
                        </button>
                        <button className="btn btn-sm btn-ghost" style={{ background: 'rgba(10,132,255,0.1)', border: '1px solid rgba(10,132,255,0.3)', color: 'var(--blue)' }} onClick={() => setBulkRenameOpen(true)}>
                            <Wand2 size={14} style={{ marginRight: 4 }} />
                            Renombrar / Limpiar
                        </button>
                        <button className="btn btn-sm btn-ghost" style={{ background: 'rgba(255,159,10,0.1)', border: '1px solid var(--orange)', color: 'var(--orange)' }} onClick={() => handleBulkEnrichment('descriptions')} disabled={isSaving}>
                            {isSaving ? <Loader2 size={14} className="animate-spin" style={{ marginRight: 4 }} /> : <Sparkles size={14} style={{ marginRight: 4 }} />}
                            Generar Descripción (IA)
                        </button>
                        <button className="btn btn-sm btn-ghost" style={{ background: 'rgba(52,199,89,0.1)', border: '1px solid var(--accent)', color: 'var(--accent)' }} onClick={() => handleBulkEnrichment('images')} disabled={isSaving}>
                            {isSaving ? <Loader2 size={14} className="animate-spin" style={{ marginRight: 4 }} /> : <Image size={14} style={{ marginRight: 4 }} />}
                            Buscar Imágenes (Web)
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={bulkDelete}>Eliminar</button>
                    </div>
                </div>
            )}

            {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

            {loading ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Cargando...</div>
            ) : (
                <div className="table-wrap" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.size === sortedProducts.length && sortedProducts.length > 0}
                                        onChange={toggleSelectAll}
                                        style={{ accentColor: 'var(--primary)', width: 16, height: 16, cursor: 'pointer' }}
                                    />
                                </th>
                                <th style={{ width: 60 }}>Imagen</th>
                                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        Nombre {sortField === 'name' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                    </div>
                                </th>
                                <th onClick={() => handleSort('categories.name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        Categoría {sortField === 'categories.name' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                    </div>
                                </th>
                                <th onClick={() => handleSort('brands.name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        Marca {sortField === 'brands.name' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                    </div>
                                </th>
                                <th onClick={() => handleSort('providers.name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        Proveedor {sortField === 'providers.name' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                    </div>
                                </th>
                                <th style={{ userSelect: 'none' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        Costo USD
                                    </div>
                                </th>
                                <th onClick={() => handleSort('priceUSD')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        Precio USD {sortField === 'priceUSD' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                    </div>
                                </th>
                                <th onClick={() => handleSort('active')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        Estado {sortField === 'active' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                    </div>
                                </th>
                                <th>Más Vendido</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedProducts.map((p) => {
                                const variant = p.product_variants?.[0]
                                const priceUSD = getPriceUSD(variant?.prices, p.price_usd)
                                return (
                                    <tr key={p.id} style={{ background: selectedIds.has(p.id) ? 'var(--bg-secondary)' : 'transparent' }}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(p.id)}
                                                onChange={() => toggleSelect(p.id)}
                                                style={{ accentColor: 'var(--primary)', width: 16, height: 16, cursor: 'pointer' }}
                                            />
                                        </td>
                                        <td>
                                            <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                {p.product_images && p.product_images.length > 0 ? (
                                                    <img
                                                        src={p.product_images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))[0]?.public_url}
                                                        alt={p.name}
                                                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                                    />
                                                ) : (
                                                    <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1, padding: 4 }}>Sin imagen</div>
                                                )}
                                            </div>
                                        </td>
                                        <td onClick={() => openEdit(p)} style={{ cursor: 'pointer' }} className="hover-opacity">
                                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{p.name}</div>
                                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                                                {p.tags && p.tags.length > 0 ? (
                                                    p.tags.map((tag, idx) => (
                                                        <span key={idx} style={{
                                                            fontSize: '0.65rem',
                                                            background: 'rgba(0,0,0,0.05)',
                                                            border: '1px solid var(--border)',
                                                            padding: '2px 6px',
                                                            borderRadius: 4,
                                                            color: 'var(--text-secondary)',
                                                            textTransform: 'lowercase'
                                                        }}>
                                                            {tag}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin tags</div>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.categories?.name}</td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.brands?.name}</td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.providers?.name || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                                        <td style={{ fontWeight: 600, color: (p as any).cost_price ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                                            {(p as any).cost_price ? formatUSD(Number((p as any).cost_price)) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                        </td>
                                        <td style={{ fontWeight: 700 }}>
                                            {priceUSD ? formatUSD(Number(priceUSD)) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                        </td>
                                        <td>
                                            <button
                                                onClick={() => toggleActive(p)}
                                                title={p.active ? 'Desactivar' : 'Activar'}
                                                style={{
                                                    background: p.active ? 'rgba(52,199,89,0.15)' : 'rgba(255,59,48,0.1)',
                                                    border: `1px solid ${p.active ? 'rgba(52,199,89,0.3)' : 'rgba(255,59,48,0.25)'}`,
                                                    color: p.active ? 'var(--green)' : 'var(--red)',
                                                    borderRadius: 100,
                                                    padding: '3px 10px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                {p.active ? 'Activo' : 'Inactivo'}
                                            </button>
                                        </td>
                                        <td>
                                            <button
                                                onClick={() => toggleFeatured(p)}
                                                title={p.is_featured ? 'Quitar de más vendidos' : 'Marcar como más vendido'}
                                                style={{
                                                    background: p.is_featured ? 'rgba(255,159,10,0.15)' : 'rgba(255,255,255,0.05)',
                                                    border: `1px solid ${p.is_featured ? 'rgba(255,159,10,0.3)' : 'rgba(255,255,255,0.1)'}`,
                                                    color: p.is_featured ? 'var(--orange)' : 'var(--text-muted)',
                                                    borderRadius: 100,
                                                    padding: '3px 10px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 4
                                                }}
                                            >
                                                <TrendingUp size={12} />
                                                {p.is_featured ? 'Sí' : 'No'}
                                            </button>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button
                                                    id={`edit-product-${p.id}`}
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => openEdit(p)}
                                                    title="Editar"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    id={`delete-product-${p.id}`}
                                                    className="btn btn-danger"
                                                    onClick={() => handleDelete(p.id, p.name)}
                                                    title="Eliminar"
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
            )}

            {/* ─── Modal Form ─────────────────────────────── */}
            {modalOpen && (
                <div className="modal-overlay animate-fade-in-fast">
                    <div className="modal">
                        <div className="modal-title">
                            <span>{editProduct ? dict.admin.editar + ' Producto' : 'Nuevo Producto'}</span>
                            <button onClick={() => setModalOpen(false)} className="btn btn-ghost btn-sm"><X size={16} /></button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label className="form-label" htmlFor="form-name">{dict.admin.nombre} *</label>
                                <input id="form-name" className="form-input" value={form.name}
                                    onChange={(e) => {
                                        const name = e.target.value
                                        setForm((f) => ({ ...f, name, slug: editProduct ? f.slug : slugify(name) }))
                                    }} placeholder="Nombre del producto" />
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor="form-cost-price">Precio Costo (USD)</label>
                                <input id="form-cost-price" className="form-input" type="number" min="0" step="0.01"
                                    value={form.cost_price}
                                    onChange={(e) => {
                                        const cost = e.target.value
                                        const finalPrice = calculateSellingPrice(parseFloat(cost))
                                        setForm((f) => ({ 
                                            ...f, 
                                            cost_price: cost,
                                            priceUSD: finalPrice > 0 ? finalPrice.toString() : f.priceUSD
                                        }))
                                    }}
                                    placeholder="0.00" />
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor="form-price">Precio Venta (USD)</label>
                                <input id="form-price" className="form-input" type="number" min="0" step="0.01"
                                    value={form.priceUSD} onChange={(e) => setForm((f) => ({ ...f, priceUSD: e.target.value }))}
                                    placeholder="0.00" />
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor="form-category">{dict.admin.categoria} *</label>
                                <SearchableSelect
                                    id="form-category"
                                    value={form.category_id}
                                    onChange={(v) => setForm((f) => ({ ...f, category_id: v }))}
                                    options={categories.map(c => ({ value: c.id, label: c.name }))}
                                    placeholder="Seleccionar..."
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor="form-brand">{dict.admin.marca} *</label>
                                <SearchableSelect
                                    id="form-brand"
                                    value={form.brand_id}
                                    onChange={(v) => setForm((f) => ({ ...f, brand_id: v }))}
                                    options={brands.map(b => ({ value: b.id, label: b.name }))}
                                    placeholder="Seleccionar..."
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor="form-provider">Proveedor</label>
                                <SearchableSelect
                                    id="form-provider"
                                    value={form.provider_id}
                                    onChange={(v) => setForm((f) => ({ ...f, provider_id: v }))}
                                    options={providers.map(p => ({ value: p.id, label: p.name }))}
                                    placeholder="Seleccionar proveedor..."
                                />
                            </div>


                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label className="form-label" htmlFor="form-tags">Tags de Búsqueda (separados por coma)</label>
                                <textarea id="form-tags" className="form-textarea" rows={2} value={form.tags}
                                    onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                                    placeholder="Playstation, Sony, Consola, Next-Gen..." />
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                    Palabras clave que ayudarán a encontrar el producto más fácil (ej: "PS5" por "Playstation").
                                </p>
                            </div>

                            {/* ─── Descripción del Proveedor (solo lectura / expandible) ─── */}
                            {form.descripcion_original && (
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <label className="form-label" style={{ margin: 0 }}>
                                            📦 Descripción del Proveedor
                                            <span style={{ marginLeft: 8, fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-muted)', letterSpacing: '0.02em' }}>como llega en la lista</span>
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setShowOriginalDesc(!showOriginalDesc)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 5,
                                                padding: '4px 10px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600,
                                                border: '1px solid var(--border)', background: showOriginalDesc ? 'var(--primary-light)' : 'var(--bg-secondary)',
                                                color: showOriginalDesc ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            {showOriginalDesc ? <>👁️ Ocultar</> : <>👁️ Ver / Editar</>}
                                        </button>
                                    </div>
                                    {showOriginalDesc ? (
                                        <textarea
                                            id="form-desc-original"
                                            className="form-textarea"
                                            rows={2}
                                            value={form.descripcion_original}
                                            onChange={(e) => setForm((f) => ({ ...f, descripcion_original: e.target.value }))}
                                            style={{
                                                fontFamily: 'monospace', fontSize: '0.82rem',
                                                background: 'rgba(255,159,10,0.04)',
                                                border: '1px solid rgba(255,159,10,0.3)',
                                                color: 'var(--text)',
                                                resize: 'vertical'
                                            }}
                                        />
                                    ) : (
                                        <div style={{
                                            padding: '8px 12px', borderRadius: 8,
                                            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                            fontSize: '0.85rem', color: 'var(--text-muted)',
                                            fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                            maxHeight: 48, overflow: 'hidden',
                                            position: 'relative',
                                            cursor: 'pointer'
                                        }} onClick={() => setShowOriginalDesc(true)}>
                                            {form.descripcion_original}
                                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 20, background: 'linear-gradient(transparent, var(--bg-secondary))' }} />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ─── Accordion: Más Detalles ─── */}
                            <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: 8 }}>
                                <button
                                    type="button"
                                    onClick={() => setShowMoreDetails(!showMoreDetails)}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '12px 16px',
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 12,
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        color: 'var(--text-primary)',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Plus size={16} style={{ transition: 'transform 0.3s ease', transform: showMoreDetails ? 'rotate(45deg)' : 'none' }} />
                                        <span>Más detalles (Condición, Almacenamiento, etc.)</span>
                                    </div>
                                    <ChevronRight size={16} style={{ transition: 'transform 0.3s ease', transform: showMoreDetails ? 'rotate(90deg)' : 'none' }} />
                                </button>

                                {showMoreDetails && (
                                    <div className="animate-fade-in-down" style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr',
                                        gap: 16,
                                        padding: '20px',
                                        background: 'rgba(255,255,255,0.02)',
                                        border: '1px solid var(--border)',
                                        borderTop: 'none',
                                        borderBottomLeftRadius: 12,
                                        borderBottomRightRadius: 12,
                                        marginTop: -1
                                    }}>
                                        <div className="form-group">
                                            <label className="form-label" htmlFor="form-condition">{dict.admin.condicion}</label>
                                            <SearchableSelect
                                                id="form-condition"
                                                value={form.condition}
                                                onChange={(v) => setForm((f) => ({ ...f, condition: v }))}
                                                options={[
                                                    { value: 'new', label: 'Nuevo' },
                                                    { value: 'oem', label: 'OEM' },
                                                    { value: 'refurbished', label: 'Reacondicionado' },
                                                    { value: 'used', label: 'Usado' },
                                                ]}
                                                placeholder="Seleccionar..."
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label" htmlFor="form-storage">{dict.admin.almacenamiento}</label>
                                            <input id="form-storage" className="form-input" value={form.storage}
                                                onChange={(e) => setForm((f) => ({ ...f, storage: e.target.value }))} placeholder="128GB, 256GB..." />
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label" htmlFor="form-color">{dict.admin.color}</label>
                                            <input id="form-color" className="form-input" value={form.color}
                                                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} placeholder="Negro, Blanco..." />
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label" htmlFor="form-connectivity">{dict.admin.conectividad}</label>
                                            <input id="form-connectivity" className="form-input" value={form.connectivity}
                                                onChange={(e) => setForm((f) => ({ ...f, connectivity: e.target.value }))} placeholder="5G, WiFi, Bluetooth..." />
                                        </div>

                                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                            <label className="form-label" htmlFor="form-long-desc">Características Principales (Lista)</label>
                                            <textarea id="form-long-desc" className="form-textarea" rows={5} value={form.long_description}
                                                onChange={(e) => setForm((f) => ({ ...f, long_description: e.target.value }))}
                                                placeholder="📱 Pantalla: 6.9...&#10;⚡ Procesador: ..." />
                                        </div>

                                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                            <label className="form-label" htmlFor="form-desc">{dict.admin.descripcion} (Texto completo inferior)</label>
                                            <textarea id="form-desc" className="form-textarea" rows={3} value={form.short_description}
                                                onChange={(e) => setForm((f) => ({ ...f, short_description: e.target.value }))}
                                                placeholder="Descripción detallada del producto..." />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label className="form-label">Imágenes del Producto</label>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                                    <input type="file" accept="image/*" multiple className="form-input" style={{ flex: 1, padding: '4px 8px' }}
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files.length > 0) {
                                                const newImages = Array.from(e.target.files).map(file => ({
                                                    id: Math.random().toString(36).substr(2, 9),
                                                    file,
                                                    url: URL.createObjectURL(file), // create object url for preview
                                                    isExisting: false
                                                }))
                                                setImages(prev => [...prev, ...newImages])
                                            }
                                            e.target.value = '' // reset input
                                        }} />
                                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>ó URL:</span>
                                    <input className="form-input"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const val = e.currentTarget.value.trim();
                                                if (val) {
                                                    setImages(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), url: val, isExisting: false }])
                                                    e.currentTarget.value = ''
                                                }
                                            }
                                        }}
                                        placeholder="Pegar URL y presionar Enter" style={{ flex: 1 }} />
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>* Si subes archivos, necesitas el bucket "Images". Arrastra para ordenar (la 1ra es la portada).</div>

                                {images.length > 0 && (
                                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '16px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)', marginTop: 12 }}>
                                        {images.map((img, idx) => (
                                            <div
                                                key={img.id}
                                                draggable
                                                onDragStart={() => setDraggedIdx(idx)}
                                                onDragOver={(e) => e.preventDefault()}
                                                onDrop={(e) => {
                                                    e.preventDefault()
                                                    if (draggedIdx === null || draggedIdx === idx) return
                                                    const newImages = [...images]
                                                    const [draggedItem] = newImages.splice(draggedIdx, 1)
                                                    newImages.splice(idx, 0, draggedItem)
                                                    setImages(newImages)
                                                    setDraggedIdx(null)
                                                }}
                                                style={{
                                                    position: 'relative',
                                                    width: 100,
                                                    height: 100,
                                                    borderRadius: 8,
                                                    background: 'var(--bg)',
                                                    overflow: 'hidden',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                                onClick={(e) => {
                                                    // Evitar abrir lightbox si se hizo clic en el botón de borrar
                                                    if ((e.target as HTMLElement).closest('.btn-delete-img')) return;
                                                    setLightboxIndex(idx)
                                                    setLightboxOpen(true)
                                                }}
                                            >
                                                <img src={img.url} alt="preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
                                                <button
                                                    type="button"
                                                    className="btn-delete-img"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setImages(images.filter(i => i.id !== img.id))
                                                    }}
                                                    style={{
                                                        position: 'absolute', top: 4, right: 4,
                                                        background: 'rgba(255, 59, 48, 0.9)', color: 'white',
                                                        border: 'none', borderRadius: '50%', width: 20, height: 20,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        cursor: 'pointer', fontSize: 12, zIndex: 10
                                                    }}
                                                >
                                                    <X size={12} />
                                                </button>
                                                {idx === 0 && (
                                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--primary)', color: 'white', fontSize: 10, textAlign: 'center', padding: '2px 0', fontWeight: 'bold' }}>PORTADA</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="form-group" style={{ gridColumn: '1 / -1', display: 'flex', gap: 24, padding: '12px 0', borderTop: '1px solid var(--border)', marginTop: 8 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                    <input type="checkbox" checked={form.active}
                                        onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                                        style={{ width: 18, height: 18, accentColor: 'var(--green)' }} />
                                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Producto Activo</span>
                                </label>

                                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={form.is_featured}
                                        onChange={(e) => setForm(f => ({ ...f, is_featured: e.target.checked }))}
                                        style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--orange)' }}
                                    />
                                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <TrendingUp size={14} /> Marcar como + VENDIDO
                                    </span>
                                </label>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 10, marginTop: 8, justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>{dict.admin.cancelar}</button>
                            <button id="admin-save-product" className="btn btn-primary" onClick={handleSave}>
                                <Check size={15} />
                                {dict.admin.guardar}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Lightbox Modal (Carousel) ───────────────── */}
            {lightboxOpen && images.length > 0 && (
                <div 
                    className="modal-overlay animate-fade-in-fast" 
                    style={{ zIndex: 4000, background: 'rgba(0,0,0,0.95)' }}
                    onClick={() => setLightboxOpen(false)}
                >
                    <button 
                        onClick={() => setLightboxOpen(false)}
                        className="btn btn-ghost"
                        style={{ position: 'absolute', top: 20, right: 20, color: 'white', background: 'rgba(255,255,255,0.1)' }}
                    >
                        <X size={24} />
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', gap: 20, position: 'relative' }}>
                        {/* Botón previo */}
                        {images.length > 1 && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => (prev - 1 + images.length) % images.length) }}
                                style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '50%', width: 50, height: 50, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <ChevronLeft size={30} />
                            </button>
                        )}

                        <div 
                            style={{ position: 'relative', maxWidth: '80%', maxHeight: '80%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img 
                                src={images[lightboxIndex]?.url} 
                                alt="preview large" 
                                style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8, objectFit: 'contain' }} 
                            />
                            
                            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 24, padding: '12px 24px', background: 'rgba(255,255,255,0.05)', borderRadius: 99, border: '1px solid rgba(255,255,255,0.1)' }}>
                                <span style={{ color: 'white', fontWeight: 600, fontSize: '0.9rem' }}>{lightboxIndex + 1} / {images.length}</span>
                                <button 
                                    onClick={() => {
                                        const idToRemove = images[lightboxIndex].id
                                        const newImgList = images.filter(i => i.id !== idToRemove)
                                        setImages(newImgList)
                                        if (newImgList.length === 0) setLightboxOpen(false)
                                        else if (lightboxIndex >= newImgList.length) setLightboxIndex(newImgList.length - 1)
                                    }}
                                    className="btn btn-danger btn-sm"
                                    style={{ height: 32 }}
                                >
                                    <Trash2 size={14} style={{ marginRight: 6 }} />
                                    Borrar imagen
                                </button>
                            </div>
                        </div>

                        {/* Botón siguiente */}
                        {images.length > 1 && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => (prev + 1) % images.length) }}
                                style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '50%', width: 50, height: 50, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <ChevronRight size={30} />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Loading Overlay for Saving */}
            {isSaving && (
                <div className="modal-overlay" style={{ zIndex: 3000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}>
                    <div style={{ textAlign: 'center', color: '#fff' }}>
                        <Loader2 className="animate-spin" size={48} style={{ marginBottom: 16, color: 'var(--accent-light)' }} />
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Guardando producto...</h2>
                        <p style={{ color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>Subiendo imágenes y procesando datos, por favor espera.</p>
                    </div>
                </div>
            )}

            {/* Bulk Category Modal */}
            {bulkCategoryOpen && (
                <div className="modal-overlay animate-fade-in-fast">
                    <div className="modal" style={{ maxWidth: 400, overflow: 'visible' }}>
                        <div className="modal-title">
                            <span>Cambiar Categoría Masivo</span>
                            <button onClick={() => setBulkCategoryOpen(false)} className="btn btn-ghost btn-sm"><X size={16} /></button>
                        </div>
                        <div className="form-group" style={{ zIndex: 10 }}>
                            <label className="form-label">Selecciona la nueva categoría para los {selectedIds.size} productos:</label>
                            <SearchableSelect
                                value={bulkCategoryForm}
                                onChange={v => setBulkCategoryForm(v)}
                                options={categories.map(c => ({ value: c.id, label: c.name }))}
                                placeholder="Seleccionar..."
                            />
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                            <button className="btn btn-ghost" onClick={() => setBulkCategoryOpen(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={performBulkCategory} disabled={!bulkCategoryForm}>Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Brand Modal */}
            {bulkBrandOpen && (
                <div className="modal-overlay animate-fade-in-fast">
                    <div className="modal" style={{ maxWidth: 400, overflow: 'visible' }}>
                        <div className="modal-title">
                            <span>Cambiar Marca Masiva</span>
                            <button onClick={() => setBulkBrandOpen(false)} className="btn btn-ghost btn-sm"><X size={16} /></button>
                        </div>
                        <div className="form-group" style={{ zIndex: 10 }}>
                            <label className="form-label">Selecciona la nueva marca para los {selectedIds.size} productos:</label>
                            <SearchableSelect
                                value={bulkBrandForm}
                                onChange={v => setBulkBrandForm(v)}
                                options={brands.map(b => ({ value: b.id, label: b.name }))}
                                placeholder="Seleccionar..."
                            />
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                            <button className="btn btn-ghost" onClick={() => setBulkBrandOpen(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={performBulkBrand} disabled={!bulkBrandForm}>Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Provider Modal */}
            {bulkProviderOpen && (
                <div className="modal-overlay animate-fade-in-fast">
                    <div className="modal" style={{ maxWidth: 400, overflow: 'visible' }}>
                        <div className="modal-title">
                            <span>Asignar Proveedor Masivo</span>
                            <button onClick={() => setBulkProviderOpen(false)} className="btn btn-ghost btn-sm"><X size={16} /></button>
                        </div>
                        <div className="form-group" style={{ zIndex: 10 }}>
                            <label className="form-label">Selecciona el nuevo proveedor para los {selectedIds.size} productos:</label>
                            <SearchableSelect
                                value={bulkProviderForm}
                                onChange={v => setBulkProviderForm(v)}
                                options={providers.map(p => ({ value: p.id, label: p.name }))}
                                placeholder="Seleccionar..."
                            />
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                            <button className="btn btn-ghost" onClick={() => setBulkProviderOpen(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={performBulkProvider} disabled={!bulkProviderForm}>Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Image Upload Modal */}
            {bulkImagesOpen && (
                <div className="modal-overlay animate-fade-in-fast">
                    <div className="modal" style={{ maxWidth: 800, width: '90vw' }}>
                        <div className="modal-title">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <ImagePlus size={20} />
                                <span>Subida Masiva de Imágenes</span>
                            </div>
                            <button onClick={() => setBulkImagesOpen(false)} className="btn btn-ghost btn-sm"><X size={16} /></button>
                        </div>

                        <div style={{ background: 'rgba(52,199,89,0.05)', padding: '16px', borderRadius: 12, border: '1px dashed var(--accent)', marginBottom: 20, textAlign: 'center' }}>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                                <strong>Tip Pro:</strong> Cargá fotos acá para añadirlas a <strong>TODOS</strong> los productos seleccionados.
                            </p>
                            <input
                                type="file"
                                multiple
                                accept="image/*"
                                id="bulk-all-files"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                    if (e.target.files && e.target.files.length > 0) {
                                        const newFiles = Array.from(e.target.files);
                                        const newData = { ...bulkImagesData };
                                        selectedIds.forEach(id => {
                                            newData[id] = [...(newData[id] || []), ...newFiles];
                                        });
                                        setBulkImagesData(newData);
                                    }
                                }}
                            />
                            <label htmlFor="bulk-all-files" className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
                                <Upload size={14} style={{ marginRight: 4 }} />
                                Cargar en todos ({selectedIds.size})
                            </label>
                        </div>

                        <div style={{ maxHeight: '50vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {Array.from(selectedIds).map(id => {
                                const prod = products.find(p => p.id === id);
                                if (!prod) return null;
                                const files = bulkImagesData[id] || [];
                                return (
                                    <div key={id} style={{ display: 'flex', gap: 16, padding: 12, background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)', alignItems: 'center' }}>
                                        <div style={{ width: 50, height: 50, borderRadius: 6, overflow: 'hidden', background: 'var(--bg-card)', padding: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {prod.product_images && prod.product_images.length > 0 ? (
                                                <img
                                                    src={prod.product_images[0].public_url}
                                                    alt=""
                                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                />
                                            ) : '📦'}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{prod.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{files.length} imágenes nuevas</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 200 }}>
                                                {files.map((f, i) => (
                                                    <div key={i} style={{ width: 32, height: 32, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)', position: 'relative' }}>
                                                        <img src={URL.createObjectURL(f)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        <button
                                                            onClick={() => {
                                                                const newData = { ...bulkImagesData };
                                                                newData[id] = newData[id].filter((_, idx) => idx !== i);
                                                                setBulkImagesData(newData);
                                                            }}
                                                            style={{ position: 'absolute', top: -2, right: -2, background: 'var(--red)', color: '#fff', border: 'none', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, cursor: 'pointer', zIndex: 10 }}
                                                        >
                                                            <X size={8} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                            <input
                                                type="file"
                                                multiple
                                                accept="image/*"
                                                id={`bulk-file-${id}`}
                                                style={{ display: 'none' }}
                                                onChange={(e) => {
                                                    if (e.target.files && e.target.files.length > 0) {
                                                        const newFiles = Array.from(e.target.files);
                                                        setBulkImagesData(prev => ({ ...prev, [id]: [...(prev[id] || []), ...newFiles] }));
                                                    }
                                                }}
                                            />
                                            <label htmlFor={`bulk-file-${id}`} className="btn btn-ghost btn-sm" style={{ padding: 6, minWidth: 0, borderRadius: '50%' }}>
                                                <Plus size={16} />
                                            </label>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                            <button className="btn btn-ghost" onClick={() => setBulkImagesOpen(false)}>Cancelar</button>
                            <button
                                className="btn btn-primary"
                                onClick={performBulkImages}
                                disabled={Object.keys(bulkImagesData).every(k => (bulkImagesData[k]?.length || 0) === 0)}
                            >
                                <Check size={16} style={{ marginRight: 6 }} />
                                Guardar todas las imágenes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {bulkRenameOpen && (
                <div className="modal-overlay animate-fade-in-fast">
                    <div className="modal" style={{ maxWidth: 450 }}>
                        <div className="modal-title">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Wand2 size={20} color="var(--blue)" />
                                <span>Renombrar o Limpiar Nombres</span>
                            </div>
                            <button onClick={() => setBulkRenameOpen(false)} className="btn btn-ghost btn-sm"><X size={16} /></button>
                        </div>

                        <div style={{ padding: '16px 0' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
                                Aplicando cambios a <strong>{selectedIds.size}</strong> productos seleccionados.
                            </p>

                            <div style={{ background: 'rgba(10,132,255,0.05)', padding: 16, borderRadius: 12, border: '1px solid rgba(10,132,255,0.1)', marginBottom: 20 }}>
                                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12 }}>Opción 1: Reemplazar Texto</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Buscar palabra/frase</label>
                                        <input
                                            className="form-input"
                                            placeholder="Ej: Watch"
                                            value={bulkRenameSearch}
                                            onChange={(e) => setBulkRenameSearch(e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Reemplazar con</label>
                                        <input
                                            className="form-input"
                                            placeholder="Ej: Smartwatch"
                                            value={bulkRenameReplace}
                                            onChange={(e) => setBulkRenameReplace(e.target.value)}
                                        />
                                    </div>
                                    <button
                                        className="btn btn-primary btn-sm btn-full"
                                        onClick={() => performBulkRename('replace')}
                                        disabled={!bulkRenameSearch || isSaving}
                                        style={{ marginTop: 8 }}
                                    >
                                        Ejecutar Reemplazo
                                    </button>
                                </div>
                            </div>

                            <div style={{ background: 'rgba(52,199,89,0.05)', padding: 16, borderRadius: 12, border: '1px solid rgba(52,199,89,0.1)' }}>
                                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12 }}>Opción 2: Limpieza y Capitalización</h4>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                                    Elimina emojis, normaliza espacios y aplica formato título (Ej: "SMARTWATCH 64GB" → "Smartwatch 64GB").
                                </p>
                                <button
                                    className="btn btn-success btn-sm btn-full"
                                    onClick={() => performBulkRename('clean')}
                                    style={{ background: 'var(--green)', color: 'white' }}
                                    disabled={isSaving}
                                >
                                    Ejecutar Limpieza Completa
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                            <button className="btn btn-ghost" onClick={() => setBulkRenameOpen(false)}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {bulkTagsOpen && (
                <div className="modal-overlay animate-fade-in-fast">
                    <div className="modal" style={{ maxWidth: 450 }}>
                        <div className="modal-title">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Tag size={20} color="var(--primary)" />
                                Etiquetado Masivo
                            </div>
                            <button className="btn-close" onClick={() => setBulkTagsOpen(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                                Los tags ingresados se <b>agregarán</b> a los que ya tengan los productos seleccionados. Separe con comas.
                            </p>
                            <div className="form-group">
                                <label className="form-label">Nuevos Tags</label>
                                <textarea
                                    className="form-input"
                                    placeholder="ej: oferta, ps5, gaming"
                                    rows={3}
                                    value={bulkTagsForm}
                                    onChange={(e) => setBulkTagsForm(e.target.value)}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                            <button className="btn btn-ghost" onClick={() => setBulkTagsOpen(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={performBulkTags} disabled={!bulkTagsForm.trim() || isSaving}>
                                {isSaving ? 'Guardando...' : 'Agregar Tags'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {bulkDeleteConfirm && (
                <div className="modal-overlay animate-fade-in-fast">
                    <div className="modal" style={{ maxWidth: 440 }}>
                        <div className="modal-title">
                            <span>Confirmar Eliminación Masiva</span>
                            <button onClick={() => setBulkDeleteConfirm(false)} className="btn btn-ghost btn-sm"><X size={16} /></button>
                        </div>
                        <div style={{ padding: '10px 0 20px 0' }}>
                            <p style={{ marginBottom: 12 }}>Vas a eliminar <strong>{selectedIds.size} producto(s)</strong> seleccionado(s).</p>
                            <p style={{ color: 'var(--red)', fontWeight: 500, fontSize: '0.9rem' }}>Esta acción no se puede deshacer.</p>
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" onClick={() => setBulkDeleteConfirm(false)}>Cancelar</button>
                            <button className="btn btn-danger" onClick={executeBulkDelete}><Trash2 size={15} /> Confirmar Eliminación</button>
                        </div>
                    </div>
                </div>
            )}
            {singleDeleteConfirm && (
                <div className="modal-overlay animate-fade-in-fast">
                    <div className="modal" style={{ maxWidth: 440 }}>
                        <div className="modal-title">
                            <span>Confirmar Eliminación</span>
                            <button onClick={() => setSingleDeleteConfirm(null)} className="btn btn-ghost btn-sm"><X size={16} /></button>
                        </div>
                        <div style={{ padding: '10px 0 20px 0' }}>
                            <p>¿Estás seguro de que deseás eliminar <strong>"{singleDeleteConfirm.name}"</strong>?</p>
                            <p style={{ color: 'var(--red)', fontWeight: 500, fontSize: '0.9rem', marginTop: 8 }}>Esta acción no se puede deshacer.</p>
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" onClick={() => setSingleDeleteConfirm(null)}>Cancelar</button>
                            <button className="btn btn-danger" onClick={executeSingleDelete}><Trash2 size={15} /> Confirmar Eliminación</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Admin Categorías ─────────────────────────────────────────────────────────
function AdminCategorias() {
    const [items, setItems] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
    const [form, setForm] = useState({ name: '', slug: '', description: '', icon_url: '' })
    const [iconFile, setIconFile] = useState<File | null>(null)
    const [editId, setEditId] = useState<string | null>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string, count: number } | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    const toggleSelectAll = (items: any[]) => {
        if (selectedIds.size === items.length) setSelectedIds(new Set())
        else setSelectedIds(new Set(items.map(i => i.id)))
    }
    const toggleSelectOne = (id: string) => {
        const next = new Set(selectedIds)
        next.has(id) ? next.delete(id) : next.add(id)
        setSelectedIds(next)
    }
    const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

    const bulkDelete = () => setBulkDeleteConfirm(true)

    const executeBulkDelete = async () => {
        setIsSaving(true)
        setBulkDeleteConfirm(false)
        for (const id of Array.from(selectedIds)) {
            await (supabase as any).from('categories').delete().eq('id', id)
        }
        setSelectedIds(new Set())
        showAlert('success', `${selectedIds.size} categoría(s) eliminada(s).`)
        setIsSaving(false)
        load()
    }

    const [sortField, setSortField] = useState<'name' | 'slug'>('name')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

    const handleSort = (field: 'name' | 'slug') => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortOrder('asc')
        }
    }

    const sortedItems = [...items].sort((a, b) => {
        const valA = (a[sortField] || '').toLowerCase()
        const valB = (b[sortField] || '').toLowerCase()
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1
        return 0
    })

    const showAlert = (type: 'success' | 'error', message: string) => {
        setAlert({ type, message })
        setTimeout(() => setAlert(null), 3500)
    }

    const load = useCallback(async () => {
        setLoading(true)
        const { data } = await (supabase as any).from('categories').select('*').order('name')
        setItems(data ?? [])
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    function openNew() {
        setEditId(null)
        setForm({ name: '', slug: '', description: '', icon_url: '' })
        setIconFile(null)
        setModalOpen(true)
    }

    function openEdit(c: Category) {
        setEditId(c.id)
        setForm({ name: c.name, slug: c.slug, description: c.description ?? '', icon_url: c.icon_url ?? '' })
        setIconFile(null)
        setModalOpen(true)
    }

    async function handleSave() {
        setIsSaving(true)
        try {
            const data = { name: form.name, slug: form.slug || slugify(form.name), description: form.description || null, icon_url: form.icon_url || null }

            if (iconFile) {
                const hash = await getFileHash(iconFile)
                const fileExt = iconFile.name.split('.').pop()
                const fileName = `cat-${hash}.${fileExt}`
                const { error: uploadError } = await supabase.storage.from('Images').upload(fileName, iconFile, { upsert: true })
                if (!uploadError || (uploadError as any).status === 409 || uploadError.message?.includes('already exists')) {
                    const { data: { publicUrl } } = supabase.storage.from('Images').getPublicUrl(fileName)
                    data.icon_url = publicUrl
                } else {
                    console.error("Error al subir imagen:", uploadError)
                    throw new Error(`Falló la subida del icono: ${uploadError.message}`)
                }
            }

            let error
            if (editId) {
                ; ({ error } = await ((supabase as any).from('categories') as any).update(data).eq('id', editId))
            } else {
                ; ({ error } = await (supabase as any).from('categories').insert(data))
            }
            if (error) throw error
            showAlert('success', editId ? 'Categoría actualizada.' : 'Categoría creada.')
            setModalOpen(true) // Actually close modal
            setModalOpen(false)
            load()
        } catch (error: any) {
            showAlert('error', error.message || 'Error al guardar')
        } finally {
            setIsSaving(false)
        }
    }

    async function handleDelete(id: string, name: string) {
        const { count, error: countError } = await (supabase as any)
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', id)

        if (countError) {
            showAlert('error', countError.message)
            return
        }

        setDeleteConfirm({ id, name, count: count || 0 })
    }

    async function executeDelete() {
        if (!deleteConfirm) return
        const { id, count } = deleteConfirm

        if (count > 0) {
            showAlert('error', `No se puede eliminar: la categoría tiene ${count} producto(s) asociado(s). Reasignálos antes de borrarla.`)
            setDeleteConfirm(null)
            return
        }

        const { error } = await (supabase as any).from('categories').delete().eq('id', id)
        if (error) showAlert('error', error.message)
        else { showAlert('success', 'Categoría eliminada.'); load() }
        setDeleteConfirm(null)
    }

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{dict.admin.categorias}</h1>
                <button id="admin-new-category" className="btn btn-primary btn-sm" onClick={openNew}>
                    <Plus size={15} /> {dict.admin.nuevo}
                </button>
            </div>

            {selectedIds.size > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--primary-light)', borderRadius: 8, marginBottom: 16, border: '1px solid var(--primary)', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: 'var(--primary-dark)', fontSize: '0.9rem' }}>{selectedIds.size} seleccionada(s)</span>
                    <button className="btn btn-danger btn-sm" onClick={bulkDelete}><Trash2 size={14} /> Eliminar</button>
                </div>
            )}

            {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

            {loading ? <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Cargando...</div> : (
                <div className="table-wrap" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                    <table>
                        <thead><tr>
                            <th style={{ width: 40 }}><input type="checkbox" checked={selectedIds.size === sortedItems.length && sortedItems.length > 0} onChange={() => toggleSelectAll(sortedItems)} style={{ accentColor: 'var(--primary)', width: 16, height: 16, cursor: 'pointer' }} /></th>
                            <th>Icono</th>
                            <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    Nombre {sortField === 'name' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                </div>
                            </th>
                            <th onClick={() => handleSort('slug')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    Slug {sortField === 'slug' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                </div>
                            </th>
                            <th>Descripción</th>
                            <th>Acciones</th>
                        </tr></thead>
                        <tbody>
                            {sortedItems.map((c) => (
                                <tr key={c.id} style={{ background: selectedIds.has(c.id) ? 'var(--bg-secondary)' : 'transparent' }}>
                                    <td><input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelectOne(c.id)} style={{ accentColor: 'var(--primary)', width: 16, height: 16, cursor: 'pointer' }} /></td>
                                    <td style={{ fontSize: '1.5rem' }}>
                                        {c.icon_url && c.icon_url.startsWith('http') ? (
                                            <img src={c.icon_url} alt={c.name} style={{ width: 32, height: 32, objectFit: 'contain' }} />
                                        ) : (
                                            <span>{c.icon_url ?? '📁'}</span>
                                        )}
                                    </td>
                                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontFamily: 'monospace' }}>{c.slug}</td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{c.description ?? '—'}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)} title="Editar"><Pencil size={14} /></button>
                                            <button className="btn btn-danger" onClick={() => handleDelete(c.id, c.name)} title="Eliminar"><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {modalOpen && (
                <div className="modal-overlay animate-fade-in-fast">
                    <div className="modal">
                        <div className="modal-title">
                            <span>{editId ? 'Editar Categoría' : 'Nueva Categoría'}</span>
                            <button onClick={() => setModalOpen(false)} className="btn btn-ghost btn-sm"><X size={16} /></button>
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="cat-name">Nombre</label>
                            <input id="cat-name" className="form-input" value={form.name}
                                onChange={(e) => { const name = e.target.value; setForm((f) => ({ ...f, name, slug: editId ? f.slug : slugify(name) })) }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="cat-slug">Slug</label>
                            <input id="cat-slug" className="form-input" value={form.slug}
                                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="cat-icon">Icono</label>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                                <input type="file" accept="image/*" className="form-input" style={{ flex: 1, padding: '4px 8px' }}
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            setIconFile(e.target.files[0])
                                            setForm(f => ({ ...f, icon_url: '' }))
                                        }
                                        e.target.value = ''
                                    }} />
                                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>o</span>
                                <input className="form-input" value={form.icon_url} onChange={e => {
                                    setForm(f => ({ ...f, icon_url: e.target.value }))
                                    setIconFile(null)
                                }} placeholder="Emoji 📱 o URL" style={{ flex: 1.5 }} disabled={!!iconFile} />
                            </div>

                            {(iconFile || form.icon_url) && (
                                <div style={{ marginTop: 10, padding: 8, background: 'var(--bg-secondary)', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                                    {iconFile ? (
                                        <img src={URL.createObjectURL(iconFile)} alt="Preview" style={{ height: 40, width: 40, objectFit: 'contain', borderRadius: 4 }} />
                                    ) : form.icon_url.startsWith('http') ? (
                                        <img src={form.icon_url} alt="Preview" style={{ height: 40, width: 40, objectFit: 'contain', borderRadius: 4 }} onError={(e) => (e.currentTarget.style.display = 'none')} onLoad={(e) => (e.currentTarget.style.display = 'block')} />
                                    ) : (
                                        <span style={{ fontSize: '1.5rem' }}>{form.icon_url}</span>
                                    )}
                                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => { setIconFile(null); setForm(f => ({ ...f, icon_url: '' })) }} title="Quitar icono"><X size={15} /></button>
                                </div>
                            )}
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="cat-desc">Descripción</label>
                            <textarea id="cat-desc" className="form-textarea" rows={2} value={form.description}
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                            <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
                            <button id="admin-save-category" className="btn btn-primary" onClick={handleSave}><Check size={15} /> Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {deleteConfirm && (
                <div className="modal-overlay animate-fade-in-fast">
                    <div className="modal" style={{ maxWidth: 450 }}>
                        <div className="modal-title">
                            <span>{deleteConfirm.count > 0 ? 'No se puede eliminar' : 'Confirmar Eliminación'}</span>
                            <button onClick={() => setDeleteConfirm(null)} className="btn btn-ghost btn-sm"><X size={16} /></button>
                        </div>
                        <div style={{ padding: '10px 0 20px 0' }}>
                            {deleteConfirm.count > 0 ? (
                                <div>
                                    <p style={{ marginBottom: 12 }}>
                                        La categoría <strong>"{deleteConfirm.name}"</strong> tiene <strong>{deleteConfirm.count} producto(s)</strong> asociado(s).
                                    </p>
                                    <p style={{ color: 'var(--red)', fontWeight: 500 }}>
                                        Reasigná o eliminá esos productos antes de borrar la categoría.
                                    </p>
                                </div>
                            ) : (
                                <p>¿Estás seguro de que deseás eliminar la categoría <strong>"{deleteConfirm.name}"</strong>?</p>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            {deleteConfirm.count > 0 ? (
                                <button className="btn btn-primary" onClick={() => setDeleteConfirm(null)}>Entendido</button>
                            ) : (
                                <>
                                    <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
                                    <button className="btn btn-danger" onClick={executeDelete}><Trash2 size={15} /> Confirmar Eliminación</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {bulkDeleteConfirm && (
                <div className="modal-overlay animate-fade-in-fast">
                    <div className="modal" style={{ maxWidth: 440 }}>
                        <div className="modal-title">
                            <span>Confirmar Eliminación</span>
                            <button onClick={() => setBulkDeleteConfirm(false)} className="btn btn-ghost btn-sm"><X size={16} /></button>
                        </div>
                        <div style={{ padding: '10px 0 20px 0' }}>
                            <p style={{ marginBottom: 12 }}>Vas a eliminar <strong>{selectedIds.size} categoría(s)</strong> seleccionada(s).</p>
                            <p style={{ color: 'var(--red)', fontWeight: 500, fontSize: '0.9rem' }}>Esta acción no se puede deshacer.</p>
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" onClick={() => setBulkDeleteConfirm(false)}>Cancelar</button>
                            <button className="btn btn-danger" onClick={executeBulkDelete}><Trash2 size={15} /> Confirmar Eliminación</button>
                        </div>
                    </div>
                </div>
            )}
            {isSaving && (
                <div className="modal-overlay" style={{ zIndex: 3000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}>
                    <div style={{ textAlign: 'center', color: '#fff' }}>
                        <Loader2 className="animate-spin" size={48} style={{ marginBottom: 16, color: 'var(--accent-light)' }} />
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Guardando...</h2>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Admin Marcas ─────────────────────────────────────────────────────────────
function AdminMarcas() {
    const [items, setItems] = useState<Brand[]>([])
    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
    const [form, setForm] = useState({ name: '', slug: '', logo_url: '' })
    const [logoFile, setLogoFile] = useState<File | null>(null)
    const [editId, setEditId] = useState<string | null>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string, count: number } | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    const toggleSelectAll = (items: any[]) => {
        if (selectedIds.size === items.length) setSelectedIds(new Set())
        else setSelectedIds(new Set(items.map(i => i.id)))
    }
    const toggleSelectOne = (id: string) => {
        const next = new Set(selectedIds)
        next.has(id) ? next.delete(id) : next.add(id)
        setSelectedIds(next)
    }
    const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

    const bulkDelete = () => setBulkDeleteConfirm(true)

    const executeBulkDelete = async () => {
        setIsSaving(true)
        setBulkDeleteConfirm(false)
        let blocked = 0
        for (const id of Array.from(selectedIds)) {
            const { count } = await (supabase as any)
                .from('products').select('*', { count: 'exact', head: true }).eq('brand_id', id)
            if ((count ?? 0) > 0) { blocked++; continue }
            await (supabase as any).from('brands').delete().eq('id', id)
        }
        setSelectedIds(new Set())
        if (blocked > 0)
            showAlert('error', `${blocked} marca(s) no se eliminaron porque tienen productos asociados.`)
        else
            showAlert('success', `${selectedIds.size} marca(s) eliminada(s).`)
        setIsSaving(false)
        load()
    }

    const [sortField, setSortField] = useState<'name' | 'slug' | 'created_at'>('name')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

    const handleSort = (field: 'name' | 'slug' | 'created_at') => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortOrder('asc')
        }
    }

    const sortedItems = [...items].sort((a, b) => {
        const valA = sortField === 'created_at' ? new Date(a.created_at || 0).getTime() : (a[sortField] || '').toLowerCase()
        const valB = sortField === 'created_at' ? new Date(b.created_at || 0).getTime() : (b[sortField] || '').toLowerCase()
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1
        return 0
    })

    const showAlert = (type: 'success' | 'error', message: string) => {
        setAlert({ type, message })
        setTimeout(() => setAlert(null), 3500)
    }

    const load = useCallback(async () => {
        setLoading(true)
        const { data } = await (supabase as any).from('brands').select('*').order('name')
        setItems(data ?? [])
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    async function handleSave() {
        setIsSaving(true)
        try {
            const data = {
                name: form.name,
                slug: form.slug || slugify(form.name),
                logo_url: form.logo_url || null
            }

            if (logoFile) {
                const hash = await getFileHash(logoFile)
                const ext = logoFile.name.split('.').pop()
                const fileName = `brands/${hash}.${ext}`
                const { error: uploadError } = await supabase.storage.from('Images').upload(fileName, logoFile, { upsert: true })

                if (!uploadError || (uploadError as any).status === 409 || uploadError.message?.includes('already exists')) {
                    const { data: { publicUrl } } = supabase.storage.from('Images').getPublicUrl(fileName)
                    data.logo_url = publicUrl
                } else {
                    console.error("Error al subir logo de marca:", uploadError)
                    throw new Error(`Falló la subida del logo: ${uploadError.message}`)
                }
            }

            let error
            if (editId) {
                ; ({ error } = await ((supabase as any).from('brands') as any).update(data).eq('id', editId))
            } else {
                ; ({ error } = await (supabase as any).from('brands').insert(data))
            }
            if (error) throw error
            showAlert('success', editId ? 'Marca actualizada.' : 'Marca creada.')
            setModalOpen(false)
            setLogoFile(null)
            load()
        } catch (error: any) {
            showAlert('error', error.message || 'Error al guardar')
        } finally {
            setIsSaving(false)
        }
    }

    async function handleDelete(id: string, name: string) {
        const { count, error: countError } = await (supabase as any)
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('brand_id', id)

        if (countError) {
            showAlert('error', countError.message)
            return
        }

        setDeleteConfirm({ id, name, count: count || 0 })
    }

    async function executeDelete() {
        if (!deleteConfirm) return
        const { id, count } = deleteConfirm

        if (count > 0) {
            showAlert('error', `No se puede eliminar: la marca tiene ${count} producto(s) asociado(s). Reasignálos antes de borrarla.`)
            setDeleteConfirm(null)
            return
        }

        const { error } = await (supabase as any).from('brands').delete().eq('id', id)
        if (error) showAlert('error', error.message)
        else { showAlert('success', 'Marca eliminada.'); load() }
        setDeleteConfirm(null)
    }

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{dict.admin.marcas}</h1>
                <button id="admin-new-brand" className="btn btn-primary btn-sm" onClick={() => { setEditId(null); setForm({ name: '', slug: '', logo_url: '' }); setLogoFile(null); setModalOpen(true) }}>
                    <Plus size={15} /> {dict.admin.nuevo}
                </button>
            </div>

            {selectedIds.size > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--primary-light)', borderRadius: 8, marginBottom: 16, border: '1px solid var(--primary)', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: 'var(--primary-dark)', fontSize: '0.9rem' }}>{selectedIds.size} seleccionada(s)</span>
                    <button className="btn btn-danger btn-sm" onClick={bulkDelete}><Trash2 size={14} /> Eliminar</button>
                </div>
            )}

            {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

            {loading ? <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Cargando...</div> : (
                <div className="table-wrap" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                    <table>
                        <thead><tr>
                            <th style={{ width: 40 }}><input type="checkbox" checked={selectedIds.size === sortedItems.length && sortedItems.length > 0} onChange={() => toggleSelectAll(sortedItems)} style={{ accentColor: 'var(--primary)', width: 16, height: 16, cursor: 'pointer' }} /></th>
                            <th style={{ width: 60 }}>Logo</th>
                            <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    Nombre {sortField === 'name' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                </div>
                            </th>
                            <th onClick={() => handleSort('slug')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    Slug {sortField === 'slug' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                </div>
                            </th>
                            <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    Creado {sortField === 'created_at' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                </div>
                            </th>
                            <th>Acciones</th>
                        </tr></thead>
                        <tbody>
                            {sortedItems.map((b) => (
                                <tr key={b.id} style={{ background: selectedIds.has(b.id) ? 'var(--bg-secondary)' : 'transparent' }}>
                                    <td><input type="checkbox" checked={selectedIds.has(b.id)} onChange={() => toggleSelectOne(b.id)} style={{ accentColor: 'var(--primary)', width: 16, height: 16, cursor: 'pointer' }} /></td>
                                    <td>
                                        {b.logo_url && (
                                            <img src={b.logo_url} alt={b.name} style={{ width: 32, height: 32, objectFit: 'contain' }} />
                                        )}
                                    </td>
                                    <td style={{ fontWeight: 600 }}>{b.name}</td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontFamily: 'monospace' }}>{b.slug}</td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{new Date(b.created_at).toLocaleDateString('es-AR')}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button className="btn btn-ghost btn-sm" onClick={() => { setEditId(b.id); setForm({ name: b.name, slug: b.slug, logo_url: b.logo_url || '' }); setLogoFile(null); setModalOpen(true) }} title="Editar"><Pencil size={14} /></button>
                                            <button className="btn btn-danger" onClick={() => handleDelete(b.id, b.name)} title="Eliminar"><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {modalOpen && (
                <div className="modal-overlay animate-fade-in-fast">
                    <div className="modal" style={{ maxWidth: 400 }}>
                        <div className="modal-title">
                            <span>{editId ? 'Editar Marca' : 'Nueva Marca'}</span>
                            <button onClick={() => setModalOpen(false)} className="btn btn-ghost btn-sm"><X size={16} /></button>
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="brand-name">Nombre</label>
                            <input id="brand-name" className="form-input" value={form.name}
                                onChange={(e) => { const name = e.target.value; setForm((f) => ({ ...f, name, slug: editId ? f.slug : slugify(name) })) }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="brand-slug">Slug</label>
                            <input id="brand-slug" className="form-input" value={form.slug}
                                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="brand-logo">Logo</label>
                            <input type="file" accept="image/*" className="form-input" style={{ padding: '4px 8px' }}
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        setLogoFile(e.target.files[0])
                                    }
                                }} />
                            {(logoFile || form.logo_url) && (
                                <div style={{ marginTop: 10, padding: 8, background: 'var(--bg-secondary)', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                                    {logoFile ? (
                                        <img src={URL.createObjectURL(logoFile)} alt="Preview" style={{ height: 40, width: 40, objectFit: 'contain' }} />
                                    ) : (
                                        <img src={form.logo_url} alt="Logo actual" style={{ height: 40, width: 40, objectFit: 'contain' }} />
                                    )}
                                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => { setLogoFile(null); setForm(f => ({ ...f, logo_url: '' })) }} title="Quitar logo"><X size={15} /></button>
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                            <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
                            <button id="admin-save-brand" className="btn btn-primary" onClick={handleSave}><Check size={15} /> Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {deleteConfirm && (
                <div className="modal-overlay animate-fade-in-fast">
                    <div className="modal" style={{ maxWidth: 450 }}>
                        <div className="modal-title">
                            <span>{deleteConfirm.count > 0 ? 'No se puede eliminar' : 'Confirmar Eliminación'}</span>
                            <button onClick={() => setDeleteConfirm(null)} className="btn btn-ghost btn-sm"><X size={16} /></button>
                        </div>
                        <div style={{ padding: '10px 0 20px 0' }}>
                            {deleteConfirm.count > 0 ? (
                                <div>
                                    <p style={{ marginBottom: 12 }}>
                                        La marca <strong>"{deleteConfirm.name}"</strong> tiene <strong>{deleteConfirm.count} producto(s)</strong> asociado(s).
                                    </p>
                                    <p style={{ color: 'var(--red)', fontWeight: 500 }}>
                                        Reasigná o eliminá esos productos antes de borrar la marca.
                                    </p>
                                </div>
                            ) : (
                                <p>¿Estás seguro de que deseás eliminar la marca <strong>"{deleteConfirm.name}"</strong>?</p>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            {deleteConfirm.count > 0 ? (
                                <button className="btn btn-primary" onClick={() => setDeleteConfirm(null)}>Entendido</button>
                            ) : (
                                <>
                                    <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
                                    <button className="btn btn-danger" onClick={executeDelete}><Trash2 size={15} /> Confirmar Eliminación</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {bulkDeleteConfirm && (
                <div className="modal-overlay animate-fade-in-fast">
                    <div className="modal" style={{ maxWidth: 440 }}>
                        <div className="modal-title">
                            <span>Confirmar Eliminación</span>
                            <button onClick={() => setBulkDeleteConfirm(false)} className="btn btn-ghost btn-sm"><X size={16} /></button>
                        </div>
                        <div style={{ padding: '10px 0 20px 0' }}>
                            <p style={{ marginBottom: 12 }}>Vas a eliminar <strong>{selectedIds.size} marca(s)</strong> seleccionada(s).</p>
                            <p style={{ color: 'var(--red)', fontWeight: 500, fontSize: '0.9rem' }}>
                                Esta acción no se puede deshacer. Los productos asociados a estas marcas pueden verse afectados.
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" onClick={() => setBulkDeleteConfirm(false)}>Cancelar</button>
                            <button className="btn btn-danger" onClick={executeBulkDelete}><Trash2 size={15} /> Confirmar Eliminación</button>
                        </div>
                    </div>
                </div>
            )}
            {isSaving && (
                <div className="modal-overlay" style={{ zIndex: 3000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}>
                    <div style={{ textAlign: 'center', color: '#fff' }}>
                        <Loader2 className="animate-spin" size={48} style={{ marginBottom: 16, color: 'var(--accent-light)' }} />
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Guardando...</h2>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Admin Inventario ─────────────────────────────────────────────────────────
function AdminInventario() {
    const [items, setItems] = useState<(Inventory & { product_variants: ProductVariant & { products: Product } })[]>([])
    const [loading, setLoading] = useState(true)
    const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
    const [editItem, setEditItem] = useState<string | null>(null)
    const [qty, setQty] = useState('')

    const [sortField, setSortField] = useState<'product' | 'sku' | 'available' | 'reserved' | 'status'>('product')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

    const handleSort = (field: 'product' | 'sku' | 'available' | 'reserved' | 'status') => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortOrder('asc')
        }
    }

    const sortedItems = [...items].sort((a, b) => {
        const aVariant = a.product_variants as any
        const aProduct = aVariant?.products
        const bVariant = b.product_variants as any
        const bProduct = bVariant?.products

        let valA: any = ''
        let valB: any = ''

        if (sortField === 'product') {
            valA = (aProduct?.name || '').toLowerCase()
            valB = (bProduct?.name || '').toLowerCase()
        } else if (sortField === 'sku') {
            valA = (aVariant?.sku || '').toLowerCase()
            valB = (bVariant?.sku || '').toLowerCase()
        } else if (sortField === 'available') {
            valA = a.qty_available
            valB = b.qty_available
        } else if (sortField === 'reserved') {
            valA = a.qty_reserved
            valB = b.qty_reserved
        } else if (sortField === 'status') {
            const getStatusRank = (inv: any) => {
                if (inv.qty_available === 0) return 3 // Sin stock
                const isLow = inv.qty_available > 0 && inv.qty_available <= inv.low_stock_threshold
                if (isLow) return 2 // Low
                return 1 // OK
            }
            valA = getStatusRank(a)
            valB = getStatusRank(b)
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1
        return 0
    })

    const showAlert = (type: 'success' | 'error', message: string) => {
        setAlert({ type, message })
        setTimeout(() => setAlert(null), 3500)
    }

    const load = useCallback(async () => {
        setLoading(true)
        const { data, error } = await (supabase as any)
            .from('inventory')
            .select('*, product_variants(*, products(name, slug))')
            .order('updated_at', { ascending: false })
            .limit(100)
        setItems((data as any) ?? [])
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    async function saveQty(id: string) {
        const { error } = await ((supabase as any).from('inventory') as any).update({ qty_available: parseInt(qty), updated_at: new Date().toISOString() }).eq('id', id)
        if (error) showAlert('error', error.message)
        else { showAlert('success', 'Stock actualizado.'); setEditItem(null); load() }
    }

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{dict.admin.inventario}</h1>
                <button id="admin-refresh-inventory" className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={15} /></button>
            </div>

            {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

            {loading ? <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Cargando...</div> : (
                <div className="table-wrap">
                    <table>
                        <thead><tr>
                            <th onClick={() => handleSort('product')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    Producto {sortField === 'product' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                </div>
                            </th>
                            <th onClick={() => handleSort('sku')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    SKU {sortField === 'sku' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                </div>
                            </th>
                            <th onClick={() => handleSort('available')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    Disponible {sortField === 'available' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                </div>
                            </th>
                            <th onClick={() => handleSort('reserved')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    Reservado {sortField === 'reserved' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                </div>
                            </th>
                            <th onClick={() => handleSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    Estado {sortField === 'status' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                </div>
                            </th>
                            <th>Acción</th>
                        </tr></thead>
                        <tbody>
                            {sortedItems.map((inv) => {
                                const variant = inv.product_variants as any
                                const product = variant?.products
                                const isLow = inv.qty_available > 0 && inv.qty_available <= inv.low_stock_threshold
                                return (
                                    <tr key={inv.id}>
                                        <td style={{ fontWeight: 600, fontSize: '0.875rem' }}>{product?.name ?? 'Producto'}</td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'monospace' }}>{variant?.sku ?? '—'}</td>
                                        <td>
                                            {editItem === inv.id ? (
                                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                    <input
                                                        id={`inv-qty-${inv.id}`}
                                                        className="form-input"
                                                        type="number"
                                                        min="0"
                                                        value={qty}
                                                        onChange={(e) => setQty(e.target.value)}
                                                        style={{ width: 80 }}
                                                    />
                                                    <button className="btn btn-primary btn-sm" onClick={() => saveQty(inv.id)}><Check size={13} /></button>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => setEditItem(null)}><X size={13} /></button>
                                                </div>
                                            ) : (
                                                <span style={{ fontWeight: 700, fontSize: '1rem', color: inv.qty_available === 0 ? 'var(--red)' : isLow ? 'var(--yellow)' : 'var(--green)' }}>
                                                    {inv.qty_available}
                                                 </span>
                                            )}
                                        </td>
                                        <td style={{ color: 'var(--text-secondary)' }}>{inv.qty_reserved}</td>
                                        <td>
                                            {inv.qty_available === 0
                                                ? <span className="badge badge-used">Sin stock</span>
                                                : isLow
                                                    ? <span className="badge badge-stock-low">Stock bajo</span>
                                                    : <span className="badge badge-new">OK</span>}
                                        </td>
                                        <td>
                                            <button
                                                id={`edit-inv-${inv.id}`}
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => { setEditItem(inv.id); setQty(String(inv.qty_available)) }}
                                                title="Editar stock"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

// ─── Admin Home (Brand Logos + Novedades) ──────────────────────────────────────
function AdminHome() {
    const [tab, setTab] = useState<'news' | 'brands'>('news')
    const [logos, setLogos] = useState<BrandLogo[]>([])
    const [products, setProducts] = useState<ProductWithDetails[]>([])
    const [newsItems, setNewsItems] = useState<WeeklyNews[]>([])
    const [loading, setLoading] = useState(true)
    const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [editItem, setEditItem] = useState<any>(null)
    const [isSaving, setIsSaving] = useState(false)

    // Logo form
    const [logoForm, setLogoForm] = useState({ name: '', sort_order: '0', active: true })
    const [logoFile, setLogoFile] = useState<File | null>(null)
    const [logoPreview, setLogoPreview] = useState<string>('')

    // News form
    const [newsForm, setNewsForm] = useState({
        title: '',
        description: '',
        image_url: '',
        storage_path: '',
        link_url: '',
        active: true,
        sort_order: 0
    })
    const [newsFile, setNewsFile] = useState<File | null>(null)
    const [newsPreview, setNewsPreview] = useState<string | null>(null)
    const iconsList = ['Bell', 'Zap', 'Cpu', 'Sparkles']
    const colorsList = ['#34C759', '#5856D6', '#007AFF', '#FF9500', '#FF3B30']

    const showAlert = (type: 'success' | 'error', message: string) => {
        setAlert({ type, message })
        setTimeout(() => setAlert(null), 4000)
    }

    async function loadAll() {
        setLoading(true)
        const [lRes, pRes, nRes] = await Promise.all([
            (supabase as any).from('brand_logos').select('*').order('sort_order'),
            (supabase as any).from('products').select('id, name, slug').eq('active', true).order('name'),
            supabase.from('weekly_news').select('*').order('sort_order', { ascending: true })
        ])
        setLogos((lRes.data as BrandLogo[]) ?? [])
        setProducts((pRes.data as unknown as ProductWithDetails[]) ?? [])
        setNewsItems((nRes.data as WeeklyNews[]) ?? [])
        setLoading(false)
    }

    useEffect(() => { loadAll() }, [])

    // ── Logo CRUD ──
    function openNewLogo() {
        setEditItem(null)
        setLogoForm({ name: '', sort_order: String(logos.length), active: true })
        setLogoFile(null)
        setLogoPreview('')
        setModalOpen(true)
    }

    function openEditLogo(l: BrandLogo) {
        setEditItem(l)
        setLogoForm({ name: l.name, sort_order: String(l.sort_order), active: l.active })
        setLogoFile(null)
        setLogoPreview(l.logo_url)
        setModalOpen(true)
    }

    async function saveLogo() {
        setIsSaving(true)
        try {
            let logoUrl = editItem?.logo_url || ''
            let storagePath = editItem?.storage_path || ''

            if (logoFile) {
                const hash = await getFileHash(logoFile)
                const ext = logoFile.name.split('.').pop()
                const fileName = `brands/${hash}.${ext}`
                const { error: uploadError } = await supabase.storage.from('Images').upload(fileName, logoFile, { upsert: true })

                if (!uploadError || (uploadError as any).status === 409 || uploadError.message?.includes('already exists')) {
                    const { data: { publicUrl } } = supabase.storage.from('Images').getPublicUrl(fileName)
                    logoUrl = publicUrl
                    storagePath = fileName
                } else {
                    console.error("Error al subir logo:", uploadError)
                    throw new Error(`Falló la subida del logo: ${uploadError.message}`)
                }
            }

            if (!logoUrl) {
                showAlert('error', 'Se requiere un logo.')
                setIsSaving(false)
                return
            }

            const payload = {
                name: logoForm.name,
                logo_url: logoUrl,
                storage_path: storagePath || null,
                sort_order: parseInt(logoForm.sort_order) || 0,
                active: logoForm.active,
            }

            if (editItem) {
                await ((supabase as any).from('brand_logos') as any).update(payload).eq('id', editItem.id)
            } else {
                await (supabase as any).from('brand_logos').insert(payload)
            }

            showAlert('success', 'Logo guardado correctamente.')
            setModalOpen(false)
            loadAll()
        } catch (e: any) {
            showAlert('error', e.message)
        } finally {
            setIsSaving(false)
        }
    }

    async function deleteLogo(id: string) {
        if (!confirm('¿Eliminar este logo?')) return
        await (supabase as any).from('brand_logos').delete().eq('id', id)
        showAlert('success', 'Logo eliminado.')
        loadAll()
    }

    // ── News CRUD ──
    function openNewNews() {
        setEditItem(null);
        setNewsForm({ title: '', description: '', image_url: '', storage_path: '', link_url: '', active: true, sort_order: newsItems.length });
        setNewsFile(null);
        setNewsPreview(null);
        setModalOpen(true);
    }

    function openEditNews(item: WeeklyNews) {
        setEditItem(item);
        setNewsForm({ 
            title: item.title, 
            description: item.description || '', 
            image_url: item.image_url || '', 
            storage_path: item.storage_path || '', 
            link_url: (item as any).link_url || '', 
            active: item.active, 
            sort_order: item.sort_order 
        });
        setNewsPreview(item.image_url);
        setNewsFile(null);
        setModalOpen(true);
    }

    async function saveNews() {
        setIsSaving(true)
        try {
            let finalImageUrl = newsForm.image_url
            let finalStoragePath = newsForm.storage_path

            if (newsFile) {
                const fileExt = newsFile.name.split('.').pop()
                const fileName = `weekly-news-${Date.now()}.${fileExt}`

                const { error: uploadError } = await supabase.storage.from('Images').upload(fileName, newsFile, { upsert: true })
                if (uploadError) throw uploadError

                const { data: { publicUrl } } = supabase.storage.from('Images').getPublicUrl(fileName)
                finalImageUrl = publicUrl
                finalStoragePath = fileName
            }

            if (!finalImageUrl && !newsForm.title) {
                showAlert('error', 'Debes subir una imagen o ingresar un título.')
                setIsSaving(false)
                return
            }

            const payload = { 
                ...newsForm, 
                title: newsForm.title || 'Novedad con imagen',
                image_url: finalImageUrl, 
                storage_path: finalStoragePath,
                link_url: newsForm.link_url || null
            }

            if (editItem) {
                const { error } = await (supabase as any).from('weekly_news').update(payload).eq('id', editItem.id)
                if (error) throw error
                showAlert('success', 'Novedad actualizada.')
            } else {
                const { error } = await (supabase as any).from('weekly_news').insert(payload)
                if (error) throw error
                showAlert('success', 'Novedad creada.')
            }
            setModalOpen(false)
            setNewsFile(null)
            setNewsPreview(null)
            loadAll()
        } catch (error: any) {
            showAlert('error', error.message || 'Error al guardar')
        } finally {
            setIsSaving(false)
        }
    }

    async function deleteNews(id: string, name: string) {
        if (!confirm(`¿Eliminar la novedad "${name}"?`)) return
        const { error } = await (supabase as any).from('weekly_news').delete().eq('id', id)
        if (error) showAlert('error', error.message)
        else { showAlert('success', 'Novedad eliminada.'); loadAll() }
    }

    return (
        <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 24 }}>Configuración del Home</h1>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
                <button
                    className={`btn ${tab === 'news' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                    onClick={() => { setTab('news'); setModalOpen(false) }}
                >
                    <Bell size={14} /> Novedades
                </button>
                <button
                    className={`btn ${tab === 'brands' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                    onClick={() => { setTab('brands'); setModalOpen(false) }}
                >
                    <Building2 size={14} /> Logos de Marcas
                </button>
            </div>

            {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

            {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando...</div>
            ) : tab === 'brands' ? (
                /* ── Logos Tab ── */
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{logos.length} logo(s) configurados</p>
                        <button className="btn btn-primary btn-sm" onClick={openNewLogo}><Plus size={14} /> Nuevo Logo</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
                        {logos.map((l) => (
                            <div key={l.id} className="card" style={{ padding: 16, textAlign: 'center', opacity: l.active ? 1 : 0.5 }}>
                                <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                                    <img src={l.logo_url} alt={l.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                </div>
                                <p style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: 8 }}>{l.name}</p>
                                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                    <button className="btn btn-ghost btn-sm" onClick={() => openEditLogo(l)}><Pencil size={12} /></button>
                                    <button className="btn btn-danger btn-sm" onClick={() => deleteLogo(l.id)}><Trash2 size={12} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                /* ── News Tab ── */
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Novedades y Ofertas del Mes</h2>
                        <button className="btn btn-primary btn-sm" onClick={openNewNews}>
                            <Plus size={15} /> Nueva Novedad
                        </button>
                    </div>
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: 60 }}>Imagen</th>
                                    <th>Identificador (Título)</th>
                                    <th>Enlace</th>
                                    <th>Orden</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {newsItems.map((it) => (
                                    <tr key={it.id}>
                                        <td>
                                            {it.image_url ? (
                                                <img src={it.image_url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Image size={20} />
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{it.title || 'Sin título'}</div>
                                            {it.description && <div style={{ fontSize: '0.7rem', opacity: 0.6, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.description}</div>}
                                        </td>
                                        <td>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {(it as any).link_url || 'Sin enlace'}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>{it.sort_order}</td>
                                        <td>
                                            <span className={`badge ${it.active ? 'badge-new' : 'badge-used'}`}>
                                                {it.active ? 'Activo' : 'Pausado'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button className="btn btn-ghost btn-sm" onClick={() => openEditNews(it)}><Pencil size={14} /></button>
                                                <button className="btn btn-danger btn-sm" onClick={() => deleteNews(it.id, it.title)}><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Modal ── */}
            {modalOpen && (
                <div className="modal-overlay animate-fade-in-fast">
                    <div className="modal" style={{ maxWidth: 500 }}>
                        <div className="modal-title">
                            <span>{tab === 'brands' ? (editItem ? 'Editar Logo' : 'Nuevo Logo') : (editItem ? 'Editar Novedad' : 'Nueva Novedad')}</span>
                            <button onClick={() => setModalOpen(false)} className="btn btn-ghost btn-sm"><X size={16} /></button>
                        </div>

                        {tab === 'brands' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div className="form-group">
                                    <label className="form-label">Logo de la Marca *</label>
                                    <input type="file" accept="image/*" className="form-input" style={{ padding: '4px 8px' }}
                                        onChange={(e) => {
                                            const f = e.target.files?.[0]
                                            if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)) }
                                        }}
                                    />
                                    {logoPreview && (
                                        <div style={{ marginTop: 8, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <img src={logoPreview} alt="Preview" style={{ maxHeight: '100%', objectFit: 'contain' }} />
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Nombre de la Marca</label>
                                    <input className="form-input" value={logoForm.name} onChange={(e) => setLogoForm({ ...logoForm, name: e.target.value })} placeholder="Ej: Apple" />
                                </div>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label">Orden</label>
                                        <input className="form-input" type="number" value={logoForm.sort_order} onChange={(e) => setLogoForm(f => ({ ...f, sort_order: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, paddingTop: 24 }}>
                                        <input type="checkbox" checked={logoForm.active} onChange={(e) => setLogoForm(f => ({ ...f, active: e.target.checked }))} style={{ width: 18, height: 18, accentColor: 'var(--green)' }} />
                                        <span style={{ fontSize: '0.85rem' }}>Activo</span>
                                    </div>
                                </div>
                                <button className="btn btn-primary btn-full" onClick={saveLogo} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : 'Guardar Logo'}
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div className="form-group" style={{
                                    padding: '12px',
                                    border: '2px dashed var(--border)',
                                    borderRadius: '12px',
                                    background: 'var(--bg-secondary)',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                                        <div style={{
                                            width: '100%', height: 280, borderRadius: 12, background: 'var(--bg-primary)', border: '1px solid var(--border)',
                                            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                        }}>
                                            {newsPreview ? (
                                                <img src={newsPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                            ) : (
                                                <div style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                                    <Image size={48} />
                                                    <span style={{ fontSize: '0.8rem' }}>Subir imagen generada por IA</span>
                                                </div>
                                            )}
                                        </div>
                                        <input type="file" accept="image/*" onChange={(e) => {
                                            const f = e.target.files?.[0]
                                            if (f) {
                                                setNewsFile(f)
                                                setNewsPreview(URL.createObjectURL(f))
                                            }
                                        }} style={{ width: '100%', fontSize: '0.8rem' }} id="news-image-input" hidden />
                                        <button
                                            className="btn btn-primary btn-full"
                                            onClick={() => document.getElementById('news-image-input')?.click()}
                                            type="button"
                                        >
                                            <Image size={16} /> {newsPreview ? 'Cambiar Imagen' : 'Seleccionar Imagen'}
                                        </button>
                                        {(newsPreview || newsForm.image_url) && (
                                            <button className="btn btn-ghost btn-sm" onClick={() => { setNewsFile(null); setNewsPreview(null); setNewsForm({ ...newsForm, image_url: '', storage_path: '' }) }} style={{ color: 'var(--red)' }}>
                                                <Trash2 size={12} /> Quitar imagen
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Enlace al hacer click (Opcional)</label>
                                    <input
                                        className="form-input"
                                        value={newsForm.link_url}
                                        onChange={(e) => setNewsForm({ ...newsForm, link_url: e.target.value })}
                                        placeholder="Ej: /productos?q=samsung+s26"
                                    />
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                                        Puedes usar rutas relativas como /productos?q=termino o enlaces externos.
                                    </span>
                                </div>

                                <details style={{ width: '100%' }}>
                                    <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)', padding: '8px 0' }}>
                                        Opciones adicionales (Solo Administrador)
                                    </summary>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12, padding: '12px', background: 'var(--bg-secondary)', borderRadius: 12 }}>
                                        <div className="form-group">
                                            <label className="form-label">Identificador / Título</label>
                                            <input className="form-input" value={newsForm.title} onChange={(e) => setNewsForm({ ...newsForm, title: e.target.value })} placeholder="Ej: Banner iPhone 16" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Notas / Descripción</label>
                                            <textarea className="form-input" rows={2} value={newsForm.description} onChange={(e) => setNewsForm({ ...newsForm, description: e.target.value })} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Orden de aparición</label>
                                            <input type="number" className="form-input" value={newsForm.sort_order} onChange={(e) => setNewsForm({ ...newsForm, sort_order: parseInt(e.target.value) })} />
                                        </div>
                                        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <input type="checkbox" checked={newsForm.active} onChange={(e) => setNewsForm({ ...newsForm, active: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--green)' }} />
                                            <span style={{ fontWeight: 600 }}>Novedad Activa</span>
                                        </div>
                                    </div>
                                </details>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                            <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={tab === 'brands' ? saveLogo : saveNews} disabled={isSaving}>
                                {isSaving ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} Guardar {tab === 'brands' ? 'Logo' : 'Novedad'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Admin Proveedores ────────────────────────────────────────────────────────
function AdminProveedores() {
    const [items, setItems] = useState<Provider[]>([])
    const [loading, setLoading] = useState(true)
    const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [editId, setEditId] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', notes: '', active: true })

    const toggleSelectAll = (items: any[]) => {
        if (selectedIds.size === items.length) setSelectedIds(new Set())
        else setSelectedIds(new Set(items.map(i => i.id)))
    }
    const toggleSelectOne = (id: string) => {
        const next = new Set(selectedIds)
        next.has(id) ? next.delete(id) : next.add(id)
        setSelectedIds(next)
    }
    const bulkStatus = async (active: boolean) => {
        setIsSaving(true)
        for (const id of Array.from(selectedIds)) {
            await (supabase as any).from('providers').update({ active, updated_at: new Date().toISOString() }).eq('id', id)
        }
        setSelectedIds(new Set())
        showAlert('success', `${selectedIds.size} proveedor(es) ${active ? 'activado(s)' : 'desactivado(s)'}.`)
        setIsSaving(false)
        load()
    }
    const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
    const [singleDeleteConfirm, setSingleDeleteConfirm] = useState<{ id: string; name: string } | null>(null)

    const bulkDelete = () => setBulkDeleteConfirm(true)

    const executeBulkDelete = async () => {
        setIsSaving(true)
        setBulkDeleteConfirm(false)
        for (const id of Array.from(selectedIds)) {
            await (supabase as any).from('providers').delete().eq('id', id)
        }
        setSelectedIds(new Set())
        showAlert('success', `${selectedIds.size} proveedor(es) eliminado(s).`)
        setIsSaving(false)
        load()
    }

    const [sortField, setSortField] = useState<'name' | 'email' | 'created_at'>('name')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

    const showAlert = (type: 'success' | 'error', message: string) => {
        setAlert({ type, message })
        setTimeout(() => setAlert(null), 3500)
    }

    const load = useCallback(async () => {
        setLoading(true)
        const { data } = await (supabase as any).from('providers').select('*').order('name')
        setItems(data ?? [])
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    async function handleSave() {
        if (!form.name) return showAlert('error', 'El nombre es obligatorio')
        setIsSaving(true)
        try {
            const data = { ...form, updated_at: new Date().toISOString() }
            let error
            if (editId) {
                ; ({ error } = await ((supabase as any).from('providers') as any).update(data).eq('id', editId))
            } else {
                ; ({ error } = await (supabase as any).from('providers').insert(data))
            }
            if (error) throw error
            showAlert('success', editId ? 'Proveedor actualizado.' : 'Proveedor creado.')
            setModalOpen(false)
            load()
        } catch (error: any) {
            showAlert('error', error.message || 'Error al guardar')
        } finally {
            setIsSaving(false)
        }
    }

    async function handleDelete(id: string, name: string) {
        setSingleDeleteConfirm({ id, name })
    }

    async function executeSingleDelete() {
        if (!singleDeleteConfirm) return
        const { error } = await (supabase as any).from('providers').delete().eq('id', singleDeleteConfirm.id)
        if (error) showAlert('error', error.message)
        else { showAlert('success', 'Proveedor eliminado.'); load() }
        setSingleDeleteConfirm(null)
    }

    const sortedItems = [...items].sort((a: any, b: any) => {
        const valA = (a[sortField] || '').toLowerCase()
        const valB = (b[sortField] || '').toLowerCase()
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1
        return 0
    })

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Gestión de Proveedores</h1>
                <button className="btn btn-primary btn-sm" onClick={() => { setEditId(null); setForm({ name: '', email: '', phone: '', address: '', notes: '', active: true }); setModalOpen(true) }}>
                    <Plus size={15} /> Nuevo Proveedor
                </button>
            </div>

            {selectedIds.size > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--primary-light)', borderRadius: 8, marginBottom: 16, border: '1px solid var(--primary)', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: 'var(--primary-dark)', fontSize: '0.9rem' }}>{selectedIds.size} seleccionado(s)</span>
                    <button className="btn btn-sm btn-primary" onClick={() => bulkStatus(true)}>Activar</button>
                    <button className="btn btn-sm btn-ghost" style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)' }} onClick={() => bulkStatus(false)}>Pausar</button>
                    <button className="btn btn-danger btn-sm" onClick={bulkDelete}><Trash2 size={14} /> Eliminar</button>
                </div>
            )}

            {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

            {loading ? <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Cargando...</div> : (
                <div className="table-wrap" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}><input type="checkbox" checked={selectedIds.size === sortedItems.length && sortedItems.length > 0} onChange={() => toggleSelectAll(sortedItems)} style={{ accentColor: 'var(--primary)', width: 16, height: 16, cursor: 'pointer' }} /></th>
                                <th onClick={() => { setSortField('name'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }} style={{ cursor: 'pointer' }}>Nombre</th>
                                <th onClick={() => { setSortField('email'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }} style={{ cursor: 'pointer' }}>Email / Contacto</th>
                                <th>Teléfono</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedItems.map((p) => (
                                <tr key={p.id} style={{ background: selectedIds.has(p.id) ? 'var(--bg-secondary)' : 'transparent' }}>
                                    <td><input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelectOne(p.id)} style={{ accentColor: 'var(--primary)', width: 16, height: 16, cursor: 'pointer' }} /></td>
                                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.email || '—'}</td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.phone || '—'}</td>
                                    <td>
                                        <button
                                            onClick={async () => {
                                                await (supabase as any).from('providers').update({ active: !p.active, updated_at: new Date().toISOString() }).eq('id', p.id)
                                                load()
                                            }}
                                            style={{
                                                background: p.active ? 'rgba(52,199,89,0.15)' : 'rgba(255,59,48,0.1)',
                                                border: `1px solid ${p.active ? 'rgba(52,199,89,0.3)' : 'rgba(255,59,48,0.25)'}`,
                                                color: p.active ? 'var(--green)' : 'var(--red)',
                                                borderRadius: 100, padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                                            }}
                                        >
                                            {p.active ? 'Activo' : 'Inactivo'}
                                        </button>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button className="btn btn-ghost btn-sm" onClick={() => {
                                                setEditId(p.id);
                                                setForm({ name: p.name, email: p.email || '', phone: p.phone || '', address: p.address || '', notes: p.notes || '', active: p.active });
                                                setModalOpen(true)
                                            }} title="Editar"><Pencil size={14} /></button>
                                            <button className="btn btn-danger btn-sm" style={{ padding: '4px 8px' }} onClick={() => handleDelete(p.id, p.name)} title="Eliminar"><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {modalOpen && (
                <div className="modal-overlay animate-fade-in-fast">
                    <div className="modal" style={{ maxWidth: 600 }}>
                        <div className="modal-title">
                            <span>{editId ? 'Editar Proveedor' : 'Nuevo Proveedor'}</span>
                            <button onClick={() => setModalOpen(false)} className="btn btn-ghost btn-sm"><X size={16} /></button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div className="form-group">
                                <label className="form-label">Nombre *</label>
                                <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Contacto / Email</label>
                                <input className="form-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Teléfono</label>
                                <input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Dirección</label>
                                <input className="form-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Notas / Observaciones</label>
                            <textarea className="form-input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--green)' }} />
                            <span style={{ fontWeight: 600 }}>Proveedor Activo</span>
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                            <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                                {isSaving ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} Guardar Proveedor
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {bulkDeleteConfirm && (
                <div className="modal-overlay animate-fade-in-fast">
                    <div className="modal" style={{ maxWidth: 440 }}>
                        <div className="modal-title">
                            <span>Confirmar Eliminación</span>
                            <button onClick={() => setBulkDeleteConfirm(false)} className="btn btn-ghost btn-sm"><X size={16} /></button>
                        </div>
                        <div style={{ padding: '10px 0 20px 0' }}>
                            <p style={{ marginBottom: 12 }}>Vas a eliminar <strong>{selectedIds.size} proveedor(es)</strong> seleccionado(s).</p>
                            <p style={{ color: 'var(--red)', fontWeight: 500, fontSize: '0.9rem' }}>Esta acción no se puede deshacer.</p>
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" onClick={() => setBulkDeleteConfirm(false)}>Cancelar</button>
                            <button className="btn btn-danger" onClick={executeBulkDelete}><Trash2 size={15} /> Confirmar Eliminación</button>
                        </div>
                    </div>
                </div>
            )}
            {singleDeleteConfirm && (
                <div className="modal-overlay animate-fade-in-fast">
                    <div className="modal" style={{ maxWidth: 440 }}>
                        <div className="modal-title">
                            <span>Confirmar Eliminación</span>
                            <button onClick={() => setSingleDeleteConfirm(null)} className="btn btn-ghost btn-sm"><X size={16} /></button>
                        </div>
                        <div style={{ padding: '10px 0 20px 0' }}>
                            <p>¿Estás seguro de que deseás eliminar al proveedor <strong>"{singleDeleteConfirm.name}"</strong>?</p>
                            <p style={{ color: 'var(--red)', fontWeight: 500, fontSize: '0.9rem', marginTop: 8 }}>Esta acción no se puede deshacer.</p>
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" onClick={() => setSingleDeleteConfirm(null)}>Cancelar</button>
                            <button className="btn btn-danger" onClick={executeSingleDelete}><Trash2 size={15} /> Confirmar Eliminación</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Main AdminClient ─────────────────────────────────────────────────────────
export default function AdminClient() {
    const [section, setSection] = useState<AdminSection>('dashboard')

    const sectionMap: Record<AdminSection, React.ReactNode> = {
        dashboard: <Dashboard />,
        home: <AdminHome />,
        productos: <AdminProductos />,
        categorias: <AdminCategorias />,
        marcas: <AdminMarcas />,
        proveedores: <AdminProveedores />,
        precios: <AdminPrecios />,
        comparador: <AdminComparator />,
    }

    return (
        <div className="admin-layout" style={{ paddingTop: 0 }}>
            <Sidebar active={section} onChange={setSection} />
            <div className="admin-content">
                {sectionMap[section]}
            </div>
        </div>
    )
}
