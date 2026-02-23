'use client'

import React from 'react'
import { ShoppingCart, ArrowRight, ShoppingBag, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
    isOpen: boolean
    onClose: () => void
    productName: string
    productImage?: string
    onViewCart: () => void
}

export default function AddedToCartModal({ isOpen, onClose, productName, productImage, onViewCart }: Props) {
    if (!isOpen) return null

    return (
        <div className="modal-overlay animate-fade-in-fast" style={{ zIndex: 1100 }} onClick={onClose}>
            <div
                className="modal animate-fade-in"
                style={{
                    maxWidth: 400,
                    padding: 0,
                    overflow: 'hidden',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ padding: '20px 24px', background: 'rgba(52, 199, 89, 0.1)', borderBottom: '1px solid rgba(52, 199, 89, 0.2)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ background: 'var(--green)', color: '#fff', borderRadius: '50%', padding: 4, display: 'flex' }}>
                        <ShoppingCart size={16} />
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--green)', fontSize: '0.95rem' }}>¡Agregado al carrito!</span>
                    <button onClick={onClose} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '24px', textAlign: 'center' }}>
                    <div style={{ width: 100, height: 100, margin: '0 auto 16px', background: 'var(--bg-secondary)', borderRadius: 12, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {productImage ? (
                            <img src={productImage} alt={productName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        ) : (
                            <ShoppingBag size={48} opacity={0.2} />
                        )}
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>{productName}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 24 }}>Se añadió correctamente a tu pedido.</p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <button
                            className="btn btn-primary btn-full"
                            onClick={onViewCart}
                            style={{ gap: 8 }}
                        >
                            Ver mi carrito
                            <ArrowRight size={18} />
                        </button>
                        <button
                            className="btn btn-ghost btn-full"
                            onClick={onClose}
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            Seguir comprando
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
