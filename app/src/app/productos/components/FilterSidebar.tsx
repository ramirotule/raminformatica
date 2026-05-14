import { SearchableSelect } from '@/components/SearchableSelect'
import { Smartphone, Package, Search, DollarSign } from 'lucide-react'
import type { Brand } from '@/lib/database.types'

interface FilterSidebarProps {
    brands: Brand[];
    selectedBrands: string[];
    onBrandToggle: (slug: string) => void;
    minPrice: string;
    maxPrice: string;
    currency: 'ARS' | 'USD';
    onCurrencyChange: (curr: 'ARS' | 'USD') => void;
    onMinPriceChange: (val: string) => void;
    onMaxPriceChange: (val: string) => void;
    onReset: () => void;
    hasFilters: boolean;
}

export function FilterSidebar({
    brands,
    selectedBrands,
    onBrandToggle,
    minPrice,
    maxPrice,
    currency,
    onCurrencyChange,
    onMinPriceChange,
    onMaxPriceChange,
    onReset,
    hasFilters
}: FilterSidebarProps) {
    const brandOptions = [
        { value: '', label: 'Todas las marcas' },
        ...brands.map(b => ({ value: b.slug, label: b.name }))
    ]

    return (
        <aside style={{ 
            width: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 32,
            position: 'sticky',
            top: 100
        }}>
            {/* Header / Reset */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Filtros</h3>
                {hasFilters && (
                    <button 
                        onClick={onReset}
                        style={{ 
                            fontSize: '0.85rem', 
                            color: 'var(--accent)', 
                            background: 'none', 
                            border: 'none', 
                            cursor: 'pointer',
                            padding: 4
                        }}
                    >
                        Limpiar todos
                    </button>
                )}
            </div>

            {/* Marcas (Dropdown Searchable) */}
            <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>
                    Marcas
                </h4>
                <SearchableSelect
                    value={selectedBrands[0] || ''}
                    onChange={(v) => onBrandToggle(v)}
                    options={brandOptions}
                    placeholder="Buscar marca..."
                    style={{ borderRadius: 10 }}
                />
                {selectedBrands.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                        {selectedBrands.map(slug => {
                            const brand = brands.find(b => b.slug === slug)
                            return (
                                <div key={slug} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '4px 10px',
                                    background: 'var(--accent-glow)',
                                    border: '1px solid var(--accent)',
                                    borderRadius: 6,
                                    fontSize: '0.8rem',
                                    color: 'var(--text-primary)'
                                }}>
                                    {brand?.name || slug}
                                    <button onClick={() => onBrandToggle(slug)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>
                                        <Smartphone size={12} />
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Rango de Precio (Dual Currency) */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                        Precio ({currency === 'ARS' ? '$ ARS' : 'US$'})
                    </h4>
                    <div style={{ 
                        display: 'flex', 
                        background: 'rgba(255,255,255,0.05)', 
                        padding: 3, 
                        borderRadius: 8, 
                        border: '1px solid var(--border-light)' 
                    }}>
                        {['ARS', 'USD'].map(curr => (
                            <button
                                key={curr}
                                onClick={() => onCurrencyChange(curr as 'ARS' | 'USD')}
                                style={{
                                    padding: '4px 12px',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    borderRadius: 6,
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: currency === curr ? 'var(--accent)' : 'transparent',
                                    color: currency === curr ? '#000' : 'var(--text-secondary)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {curr}
                            </button>
                        ))}
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <input
                            type="number"
                            placeholder={currency === 'ARS' ? 'Mín $' : 'Min US$'}
                            value={minPrice}
                            onChange={(e) => onMinPriceChange(e.target.value)}
                            style={{
                                width: '100%',
                                height: 44,
                                padding: '0 12px',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border)',
                                borderRadius: 10,
                                fontSize: '0.9rem',
                                outline: 'none',
                                color: 'var(--text-primary)'
                            }}
                        />
                    </div>
                    <span style={{ color: 'var(--text-muted)' }}>-</span>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <input
                            type="number"
                            placeholder={currency === 'ARS' ? 'Máx $' : 'Max US$'}
                            value={maxPrice}
                            onChange={(e) => onMaxPriceChange(e.target.value)}
                            style={{
                                width: '100%',
                                height: 44,
                                padding: '0 12px',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border)',
                                borderRadius: 10,
                                fontSize: '0.9rem',
                                outline: 'none',
                                color: 'var(--text-primary)'
                            }}
                        />
                    </div>
                </div>
            </div>
        </aside>
    )
}
