'use client'

import { ListFilter, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

export type SortOption = 'mas-vendidos' | 'reciente' | 'precio-asc' | 'precio-desc' | 'nombre-asc' | 'nombre-desc'

interface SortControlsProps {
    sortBy: SortOption;
    onSortChange: (option: SortOption) => void;
    onToggleFilters?: () => void; // For mobile trigger
}

export function SortControls({ sortBy, onSortChange, onToggleFilters }: SortControlsProps) {
    const [isOpen, setIsOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    const options: { value: SortOption; label: string }[] = [
        { value: 'mas-vendidos', label: 'Más vendidos' },
        { value: 'reciente', label: 'Más recientes' },
        { value: 'precio-asc', label: 'Menor precio' },
        { value: 'precio-desc', label: 'Mayor precio' },
        { value: 'nombre-asc', label: 'Nombre: A - Z' },
        { value: 'nombre-desc', label: 'Nombre: Z - A' }
    ]

    const currentLabel = options.find(o => o.value === sortBy)?.label

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 24,
            padding: '8px 0',
            borderBottom: '1px solid var(--border-light)'
        }}>
            {/* Mobile Filter Trigger */}
            <button 
                className="btn btn-ghost"
                onClick={onToggleFilters}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}
            >
                <ListFilter size={18} />
                <span className="hide-on-mobile">Filtrar y Ordenar</span>
            </button>

            {/* Sort Dropdown */}
            <div ref={ref} style={{ position: 'relative' }}>
                <button 
                    onClick={() => setIsOpen(!isOpen)}
                    style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 8, 
                        background: 'none', 
                        border: 'none', 
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)'
                    }}
                >
                    Ordenar por: <span style={{ color: 'var(--text-primary)' }}>{currentLabel}</span>
                    <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>

                {isOpen && (
                    <div className="animate-fade-in-fast" style={{ 
                        position: 'absolute', 
                        top: '100%', 
                        right: 0, 
                        marginTop: 8,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        boxShadow: 'var(--shadow-lg)',
                        zIndex: 100,
                        minWidth: 180,
                        overflow: 'hidden'
                    }}>
                        {options.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => { onSortChange(opt.value); setIsOpen(false) }}
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    textAlign: 'left',
                                    background: sortBy === opt.value ? 'rgba(52, 199, 89, 0.05)' : 'none',
                                    border: 'none',
                                    borderBottom: '1px solid var(--border-light)',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    color: sortBy === opt.value ? 'var(--accent)' : 'var(--text-primary)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
