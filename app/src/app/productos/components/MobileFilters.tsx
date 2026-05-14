'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { FilterSidebar } from './FilterSidebar'
import type { Brand } from '@/lib/database.types'
interface MobileFiltersProps {
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

export function MobileFilters({
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
}: MobileFiltersProps) {
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
                            background: 'rgba(0,0,0,0.5)',
                            backdropFilter: 'blur(4px)',
                            zIndex: 1000
                        }}
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        style={{
                            position: 'fixed',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            maxHeight: '85vh',
                            background: 'var(--bg-card)',
                            borderTopLeftRadius: 24,
                            borderTopRightRadius: 24,
                            zIndex: 1001,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Header */}
                        <div style={{ 
                            padding: '16px 20px', 
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Filtros</h3>
                            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div style={{ padding: '24px 20px', overflowY: 'auto', flex: 1 }}>
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
                            />
                        </div>

                        {/* Footer / Apply Button */}
                        <div style={{ 
                            padding: '16px 20px', 
                            borderTop: '1px solid var(--border)',
                            background: 'var(--bg-card)'
                        }}>
                            <button 
                                className="btn btn-primary" 
                                onClick={onClose}
                                style={{ width: '100%', height: 50, borderRadius: 12 }}
                            >
                                Ver {resultCount} productos
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
