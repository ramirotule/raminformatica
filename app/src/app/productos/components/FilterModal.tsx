'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, SlidersHorizontal } from 'lucide-react'
import { FilterSidebar } from './FilterSidebar'
import type { Brand } from '@/lib/database.types'

interface FilterModalProps {
    isOpen: boolean;
    onClose: () => void;
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
    resultCount: number;
}

export function FilterModal({
    isOpen,
    onClose,
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
    hasFilters,
    resultCount
}: FilterModalProps) {

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.6)',
                            backdropFilter: 'blur(8px)',
                            zIndex: 2000
                        }}
                    />

                    {/* Modal */}
                    <div style={{
                        position: 'fixed',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2001,
                        padding: 20,
                        pointerEvents: 'none'
                    }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                            style={{
                                width: '100%',
                                maxWidth: 500,
                                background: 'var(--bg-card)',
                                borderRadius: 24,
                                border: '1px solid var(--border)',
                                boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                pointerEvents: 'auto',
                                maxHeight: '90vh'
                            }}
                        >
                            {/* Header */}
                            <div style={{ 
                                padding: '20px 24px', 
                                borderBottom: '1px solid var(--border-light)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: 'rgba(255,255,255,0.02)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ 
                                        width: 36, 
                                        height: 36, 
                                        borderRadius: 10, 
                                        background: 'var(--accent-glow)', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        color: 'var(--accent)'
                                    }}>
                                        <SlidersHorizontal size={18} />
                                    </div>
                                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Filtros</h3>
                                </div>
                                <button 
                                    onClick={onClose} 
                                    style={{ 
                                        background: 'rgba(255,255,255,0.05)', 
                                        border: 'none', 
                                        cursor: 'pointer', 
                                        width: 32, 
                                        height: 32, 
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--text-secondary)',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Content */}
                            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>

                                {/* Filters Section (Reusing Sidebar UI) */}
                                <FilterSidebar 
                                    brands={brands}
                                    selectedBrands={selectedBrands}
                                    onBrandToggle={onBrandToggle}
                                    minPrice={minPrice}
                                    maxPrice={maxPrice}
                                    currency={currency}
                                    onCurrencyChange={onCurrencyChange}
                                    onMinPriceChange={onMinPriceChange}
                                    onMaxPriceChange={onMaxPriceChange}
                                    onReset={onReset}
                                    hasFilters={hasFilters}
                                    hideTitle={true}
                                />
                            </div>

                            {/* Footer */}
                            <div style={{ 
                                padding: '20px 24px', 
                                borderTop: '1px solid var(--border-light)',
                                background: 'rgba(255,255,255,0.02)',
                                display: 'flex',
                                gap: 12
                            }}>
                                <button 
                                    className="btn btn-primary" 
                                    onClick={onClose}
                                    style={{ 
                                        flex: 1,
                                        height: 52, 
                                        borderRadius: 14,
                                        fontSize: '1rem',
                                        fontWeight: 800,
                                        boxShadow: '0 10px 20px rgba(52, 199, 89, 0.2)'
                                    }}
                                >
                                    Ver {resultCount} productos
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    )
}
