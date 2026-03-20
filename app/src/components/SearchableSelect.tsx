'use client'

import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, Search } from 'lucide-react'

export interface Option {
    value: string;
    label: string;
}

interface Props {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string; // e.g. "form-select"
    id?: string;
    disabled?: boolean;
    style?: React.CSSProperties;
}

export function SearchableSelect({ options, value, onChange, placeholder = 'Seleccionar...', className = '', id, disabled = false, style }: Props) {
    const [highlightedIdx, setHighlightedIdx] = useState(-1)
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState('')
    const ref = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const selectedOption = options.find(o => o.value === value)

    // Filter options based on search
    const filteredOptions = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false)
                setSearch('') // reset search on close
                setHighlightedIdx(-1)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        if (isOpen) {
            if (inputRef.current) inputRef.current.focus()
            setHighlightedIdx(-1)
        }
    }, [isOpen])

    const handleSelect = (option: Option) => {
        onChange(option.value)
        setIsOpen(false)
        setSearch('')
        setHighlightedIdx(-1)
    }

    return (
        <div ref={ref} className={`searchable-select-container ${className}`} style={{ position: 'relative', width: '100%', padding: 0, border: 'none', background: 'transparent', ...style }}>
            <div
                id={id}
                className={`form-input ${disabled ? 'disabled' : ''}`}
                tabIndex={disabled ? -1 : 0}
                style={{
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    opacity: disabled ? 0.6 : 1,
                    userSelect: 'none',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '12px',
                    height: '46px',
                    padding: '0 16px'
                }}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                onKeyDown={(e) => {
                    if (disabled) return
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setIsOpen(!isOpen)
                    } else if (e.key === 'ArrowDown' && !isOpen) {
                        e.preventDefault()
                        setIsOpen(true)
                    } else if (e.key === 'Escape' && isOpen) {
                        setIsOpen(false)
                    }
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selectedOption ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.95rem' }}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
            </div>

            {isOpen && (
                <div
                    className="animate-fade-in-fast"
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        right: 0,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '12px',
                        boxShadow: 'var(--shadow-lg)',
                        zIndex: 1000,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        maxHeight: '400px'
                    }}
                >
                    <div style={{ padding: '8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)' }}>
                        <Search size={14} style={{ color: 'var(--text-muted)', marginLeft: 8 }} />
                        <input
                            ref={inputRef}
                            type="text"
                            style={{ border: 'none', background: 'transparent', width: '100%', padding: '4px 8px', outline: 'none', fontSize: '0.9rem', color: 'var(--text-primary)' }}
                            placeholder="Buscar..."
                            value={search}
                            autoFocus
                            onChange={e => {
                                setSearch(e.target.value)
                                setHighlightedIdx(0)
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'ArrowDown') {
                                    e.preventDefault()
                                    setHighlightedIdx(prev => Math.min(prev + 1, filteredOptions.length - 1))
                                } else if (e.key === 'ArrowUp') {
                                    e.preventDefault()
                                    setHighlightedIdx(prev => Math.max(prev - 1, 0))
                                } else if (e.key === 'Enter') {
                                    e.preventDefault()
                                    if (highlightedIdx >= 0 && filteredOptions[highlightedIdx]) {
                                        handleSelect(filteredOptions[highlightedIdx])
                                    }
                                } else if (e.key === 'Escape') {
                                    setIsOpen(false)
                                }
                            }}
                            onClick={e => e.stopPropagation()} // Prevent closing when clicking input
                        />
                    </div>
                    <div style={{ overflowY: 'auto', padding: '4px' }}>
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option, idx) => (
                                <div
                                    key={option.value}
                                    onClick={() => handleSelect(option)}
                                    style={{
                                        padding: '10px 14px',
                                        cursor: 'pointer',
                                        borderRadius: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        fontSize: '0.9rem',
                                        color: (option.value === value || idx === highlightedIdx) ? 'var(--accent-light)' : 'var(--text-primary)',
                                        background: option.value === value ? 'rgba(52, 199, 89, 0.1)' : (idx === highlightedIdx ? 'var(--bg-card-hover)' : 'transparent'),
                                        transition: 'background 0.2s ease'
                                    }}
                                    onMouseEnter={() => setHighlightedIdx(idx)}
                                >
                                    {option.label}
                                    {option.value === value && <Check size={14} />}
                                </div>
                            ))
                        ) : (
                            <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                No resultados.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
