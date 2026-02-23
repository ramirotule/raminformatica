'use client'

import React from 'react'
import { X, Trash2, ShoppingCart, MessageCircle, Minus, Plus } from 'lucide-react'
import { useCart } from '@/context/CartContext'
import { useDolarBlue } from '@/hooks/useDolarBlue'
import { formatUSD, formatARS, getPriceARS } from '@/lib/utils'
import { phone } from '@/const/phone'

interface CartDrawerProps {
    isOpen: boolean
    onClose: () => void
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
    const { cart, removeFromCart, updateQuantity, totalItems } = useCart()
    const { dolar } = useDolarBlue()

    if (!isOpen) return null

    const totalUSD = cart.reduce((acc, item) => acc + item.priceUSD * item.quantity, 0)
    const totalARS = dolar ? getPriceARS(totalUSD, dolar.venta) : null

    const handleConfirmOrder = () => {
        let message = `Hola! Me gustaría realizar el siguiente pedido:\n\n`

        cart.forEach(item => {
            message += `• ${item.name} (Cant: ${item.quantity}) - ${formatUSD(item.priceUSD * item.quantity)}\n`
        })

        message += `\n*TOTAL: ${formatUSD(totalUSD)}*`
        if (totalARS) {
            message += ` (${formatARS(totalARS)})`
        }

        const encodedMessage = encodeURIComponent(message)
        window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank')
    }

    return (
        <div className="modal-overlay animate-fade-in-fast" style={{ zIndex: 1000, justifyContent: 'flex-end', padding: 0 }} onClick={onClose}>
            <div
                style={{
                    width: '100%',
                    maxWidth: 450,
                    height: '100vh',
                    background: 'var(--bg-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '-10px 0 50px rgba(0,0,0,0.5)',
                    padding: 0,
                    borderRadius: 0,
                    animation: 'slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <ShoppingCart size={24} color="var(--accent-light)" />
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Tu Carrito</h2>
                        <span style={{ background: 'var(--accent)', color: '#fff', fontSize: '0.75rem', padding: '2px 8px', borderRadius: 100 }}>{totalItems} items</span>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost" style={{ padding: 8, borderRadius: '50%' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Items */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                    {cart.length === 0 ? (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: 16 }}>
                            <ShoppingCart size={64} opacity={0.2} />
                            <p style={{ fontSize: '1.1rem' }}>Tu carrito está vacío</p>
                            <button className="btn btn-primary" onClick={onClose}>Ver productos</button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {cart.map((item) => (
                                <div key={item.variantId} style={{ display: 'flex', gap: 16, background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
                                    <div style={{ width: 80, height: 80, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-secondary)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {item.image ? <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : '📦'}
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <div>
                                            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 4 }}>{item.name}</h4>
                                            <p style={{ color: 'var(--accent-light)', fontWeight: 800 }}>{formatUSD(item.priceUSD)}</p>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                                            <div className="qty-selector" style={{ padding: '2px 4px' }}>
                                                <button className="qty-btn" style={{ width: 28, height: 28 }} onClick={() => updateQuantity(item.variantId, item.quantity - 1)}>
                                                    <Minus size={12} />
                                                </button>
                                                <span className="qty-value" style={{ fontSize: '0.9rem', minWidth: 20 }}>{item.quantity}</span>
                                                <button className="qty-btn" style={{ width: 28, height: 28 }} onClick={() => updateQuantity(item.variantId, item.quantity + 1)}>
                                                    <Plus size={12} />
                                                </button>
                                            </div>
                                            <button onClick={() => removeFromCart(item.variantId)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {cart.length > 0 && (
                    <div style={{ padding: '24px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
                        <div style={{ marginBottom: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: 8 }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Total Estimado:</span>
                                <div style={{ textAlign: 'right', flex: 1 }}>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)' }}>{formatUSD(totalUSD)}</div>
                                    {totalARS && <div style={{ color: 'var(--green)', fontWeight: 700 }}>{formatARS(totalARS)}</div>}
                                </div>
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
                                * Los precios en pesos son referenciales al Dólar Blue del día.
                            </p>
                        </div>
                        <button className="btn btn-primary btn-full btn-lg" onClick={handleConfirmOrder} style={{ background: '#25D366', color: '#fff', border: 'none' }}>
                            <MessageCircle size={20} />
                            Confirmar pedido por WhatsApp
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
