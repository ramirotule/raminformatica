'use client'

import { useState, useEffect } from 'react'
import { useCart } from '@/context/CartContext'
import { trackViewItem, trackAddToCart } from '@/lib/analytics'
import { useDolarBlue } from '@/hooks/useDolarBlue'
import { formatUSD, formatARS, getPriceUSD, getPriceARS, conditionLabel } from '@/lib/utils'
import type { ProductWithDetails, ProductImage } from '@/lib/database.types'
import { ShoppingCart, ChevronLeft, Minus, Plus, ShieldCheck, Truck, X, ChevronRight, House, ChevronDown, CreditCard } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import AddedToCartModal from '@/components/AddedToCartModal'

const CUOTAS_CONFIG = [
    { cuotas: 3,  recargo: 0.147499 }, // 12.19% + IVA
    { cuotas: 6,  recargo: 0.230989 }, // 19.09% + IVA
    { cuotas: 9,  recargo: 0.330209 }, // 27.29% + IVA
    { cuotas: 12, recargo: 0.390709 }, // 32.29% + IVA
]

const FEE_COBRO_INSTANTE = 0.0761 // 6.29% + IVA (MP usa 7.61% exacto)

interface ProductDetailClientProps {
    product: ProductWithDetails
}

export default function ProductDetailClient({ product }: ProductDetailClientProps) {
    const { dolar } = useDolarBlue()
    const { addToCart, setDrawerOpen } = useCart()
    const [quantity, setQuantity] = useState(1)
    const images = [...(product.product_images || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    const [mainImage, setMainImage] = useState<string>(images[0]?.public_url || '')

    // Modals state
    const [lightboxOpen, setLightboxOpen] = useState(false)
    const [lightboxIndex, setLightboxIndex] = useState(0)
    const [addedModalOpen, setAddedModalOpen] = useState(false)

    const [cuotasOpen, setCuotasOpen] = useState(false)
    const [specsOpen, setSpecsOpen] = useState(false)

    const variant = product.product_variants?.[0]
    const priceUSD = getPriceUSD(variant?.prices, product.price_usd)
    const priceARS = priceUSD && dolar ? getPriceARS(priceUSD, dolar.venta) : null
    const priceARSTransfer = priceARS ? Math.round(priceARS * 1.03) : null
    const stock = variant?.inventory?.[0]?.qty_available ?? 0

    // Evento view_item al cargar la página de producto
    useEffect(() => {
        trackViewItem({
            id: product.id,
            name: product.name,
            category: (product as any).categories?.name,
            brand: (product as any).brands?.name,
            price: priceUSD ?? undefined,
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [product.id])

    const handleAddToCart = () => {
        if (!variant) return
        addToCart({
            id: product.id,
            name: product.name,
            priceUSD: priceUSD || 0,
            quantity,
            image: mainImage,
            variantId: variant.id
        })
        setAddedModalOpen(true)
        // Analytics no debe bloquear el flujo del carrito
        try {
            trackAddToCart({
                id: product.id,
                name: product.name,
                category: (product as any).categories?.name,
                brand: (product as any).brands?.name,
                price: priceUSD ?? undefined,
                quantity,
            })
        } catch {}
    }

    const openLightbox = (imgUrl: string) => {
        const index = images.findIndex(img => img.public_url === imgUrl)
        setLightboxIndex(index >= 0 ? index : 0)
        setLightboxOpen(true)
    }

    const nextImage = (e?: React.MouseEvent) => {
        e?.stopPropagation()
        setLightboxIndex((prev) => (prev + 1) % images.length)
    }

    const prevImage = (e?: React.MouseEvent) => {
        e?.stopPropagation()
        setLightboxIndex((prev) => (prev - 1 + images.length) % images.length)
    }

    const handleViewCart = () => {
        setAddedModalOpen(false)
        setDrawerOpen(true)
    }

    return (
        <div className="product-detail-grid">
            {/* ─── Breadcrumb ───────────────────────────────────── */}
            <div className="detail-breadcrumb" style={{ gridColumn: '1 / -1', marginBottom: 24 }}>
                <Link href="/productos" className="btn-back">
                    <ChevronLeft size={16} />
                    Volver al catálogo
                </Link>
            </div>

            {/* ─── Galería ────────────────────────────────────────── */}
            <div className="detail-gallery">
                <div
                    className="main-image-wrap"
                    style={{ cursor: 'zoom-in' }}
                    onClick={() => openLightbox(mainImage)}
                >
                    {mainImage ? (
                        <Image 
                            src={mainImage} 
                            alt={product.name} 
                            width={800} 
                            height={800} 
                            priority 
                            className="main-image"
                            style={{ objectFit: 'contain', width: '100%', height: 'auto' }}
                            sizes="(max-width: 768px) 100vw, 50vw"
                        />
                    ) : (
                        <div className="main-image-placeholder">📦</div>
                    )}
                </div>
                {images.length > 1 && (
                    <div className="thumbnails-grid">
                        {images.map((img: ProductImage) => (
                            <button
                                key={img.id}
                                className={`thumb-btn ${mainImage === img.public_url ? 'active' : ''}`}
                                onClick={() => setMainImage(img.public_url || '')}
                            >
                                <Image 
                                    src={img.public_url || ''} 
                                    alt={product.name} 
                                    width={100} 
                                    height={100}
                                    style={{ objectFit: 'contain', width: '100%', height: 'auto' }}
                                />
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ─── Info ───────────────────────────────────────────── */}
            <div className="detail-info">
                <div style={{ marginBottom: 8 }}>
                    <span className={`badge badge-${product.condition || 'new'}`}>
                        {conditionLabel(product.condition || 'new')}
                    </span>
                </div>
                <p className="detail-brand">{product.brands?.name || 'Genérico'}</p>
                <h1 className="detail-name">{product.name}</h1>

                {variant?.storage && (
                    <p className="detail-specs">
                        {[variant.storage, variant.color, variant.connectivity].filter(Boolean).join(' · ')}
                    </p>
                )}

                <div className="detail-price-box">
                    {priceARS !== null ? (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
                                <div className="detail-price-usd">{formatARS(priceARS)}</div>
                                <span style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    color: 'var(--accent)',
                                    background: 'rgba(var(--accent-rgb, 34,197,94), 0.1)',
                                    border: '1px solid rgba(var(--accent-rgb, 34,197,94), 0.25)',
                                    borderRadius: 99,
                                    padding: '5px 12px',
                                    whiteSpace: 'nowrap',
                                    lineHeight: 1,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                }}>
                                    Precio contado efectivo
                                </span>
                            </div>
                            {priceUSD !== null && (
                                <div className="detail-price-ars" style={{ fontSize: '1.15rem', marginTop: 0 }}>
                                    {formatUSD(priceUSD)} USD
                                </div>
                            )}
                        </>
                    ) : priceUSD !== null ? (
                        <div className="detail-price-usd">{formatUSD(priceUSD)} USD</div>
                    ) : (
                        <div className="detail-price-usd">Consultar precio</div>
                    )}

                    {/* Nota transferencia */}
                    {priceARS !== null && priceARSTransfer !== null && (
                        <div style={{
                            marginTop: 10,
                            padding: '10px 14px',
                            borderRadius: 'var(--radius-md)',
                            background: 'rgba(var(--accent-rgb, 99,102,241), 0.07)',
                            border: '1px solid rgba(var(--accent-rgb, 99,102,241), 0.2)',
                            fontSize: '0.82rem',
                            lineHeight: '1.6',
                            color: 'var(--text-secondary)'
                        }}>
                            Transferencia bancaria o MercadoPago suma un 3%:{' '}
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                                {formatARS(priceARSTransfer)} ARS
                            </span>
                        </div>
                    )}

                    {/* Simulador de cuotas */}
                    {priceARS !== null && (
                        <div style={{ marginTop: 10 }}>
                            <button
                                onClick={() => setCuotasOpen(o => !o)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    width: '100%',
                                    padding: '10px 14px',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid var(--border-light)',
                                    cursor: 'pointer',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    transition: 'background 0.2s'
                                }}
                            >
                                <CreditCard size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                Simular pago en cuotas
                                <ChevronDown
                                    size={15}
                                    style={{
                                        marginLeft: 'auto',
                                        transition: 'transform 0.25s',
                                        transform: cuotasOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                                    }}
                                />
                            </button>

                            {cuotasOpen && (
                                <div style={{
                                    marginTop: 4,
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border-light)',
                                    overflow: 'hidden',
                                    animation: 'fadeIn 0.2s ease-out'
                                }}>
                                    {/* Encabezado tabla */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1.8fr 1fr',
                                        padding: '8px 14px',
                                        background: 'rgba(255,255,255,0.04)',
                                        borderBottom: '1px solid var(--border-light)',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        color: 'var(--text-secondary)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.04em',
                                        textAlign: 'center'
                                    }}>
                                        <span>Cantidad de Cuotas</span>
                                        <span>Valor por cuota</span>
                                    </div>
                                    {/* Filas */}
                                    {CUOTAS_CONFIG.map(({ cuotas, recargo }) => {
                                        // Fórmula financiera de Mercado Pago: Monto = Neto / (1 - Suma de comisiones)
                                        const totalComisiones = FEE_COBRO_INSTANTE + recargo
                                        const totalConRecargo = Math.round(priceARS / (1 - totalComisiones))
                                        const valorCuota = Math.round(totalConRecargo / cuotas)
                                        return (
                                            <div
                                                key={cuotas}
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: '1.8fr 1fr',
                                                    padding: '10px 14px',
                                                    borderBottom: '1px solid var(--border-light)',
                                                    fontSize: '0.85rem',
                                                    alignItems: 'center',
                                                    textAlign: 'center'
                                                    
                                                }}
                                            >
                                                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                                    {cuotas}
                                                </span>
                                                <span style={{ color: 'var(--text-secondary)' }}>
                                                    {formatARS(valorCuota)} por mes
                                                </span>
                                            </div>
                                        )
                                    })}
                                    <div style={{
                                        padding: '8px 14px',
                                        fontSize: '0.72rem',
                                        color: 'var(--text-secondary)',
                                        opacity: 0.7
                                    }}>
                                        * Precios en pesos según cotización del día. Cuotas sujetas a intereses bancarios.
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <p className="price-notice">* Precio sujeto a cambios sin previo aviso</p>
                </div>

                {product.short_description && (
                    <button
                        onClick={() => setSpecsOpen(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            width: '100%',
                            marginBottom: 24,
                            padding: '11px 16px',
                            borderRadius: 'var(--radius-md)',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid var(--border-light)',
                            cursor: 'pointer',
                            color: 'var(--text-primary)',
                            fontSize: '0.88rem',
                            fontWeight: 600,
                            transition: 'background 0.2s, border-color 0.2s'
                        }}
                    >
                        📋 Ver especificaciones principales
                    </button>
                )}


                {/* Acciones */}
                <div className="detail-actions">
                    <div className="qty-selector">
                        <button
                            onClick={() => setQuantity(q => Math.max(1, q - 1))}
                            className="qty-btn"
                            disabled={quantity <= 1}
                            aria-label="Disminuir cantidad"
                        >
                            <Minus size={16} />
                        </button>
                        <span className="qty-value">{quantity}</span>
                        <button
                            onClick={() => setQuantity(q => Math.min(99, q + 1))}
                            className="qty-btn"
                            disabled={quantity >= 99}
                            aria-label="Aumentar cantidad"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                    <button className="btn btn-primary btn-full btn-lg" onClick={handleAddToCart}>
                        <ShoppingCart size={18} />
                        Agregar al carrito
                    </button>
                </div>

                {/* Mini cards info */}
                <div className="detail-features">
                    <div className="feature-item">
                        <House size={20} className="feature-icon" />
                        <div>
                            <p className="feature-title">Retiro por domicilio</p>
                            <p className="feature-desc">Entrega dentro de las 48hs. hábiles</p>
                        </div>
                    </div>
                    <div className="feature-item">
                        <Truck size={20} className="feature-icon" />
                        <div>
                            <p className="feature-title">Envíos a todo el país</p>
                            <p className="feature-desc">Por servcio Andreani</p>
                        </div>
                    </div>
                    <div className="feature-item">
                        <ShieldCheck size={20} className="feature-icon" />
                        <div>
                            <p className="feature-title">Garantía oficial</p>
                            <p className="feature-desc">Producto 100% original</p>
                        </div>
                    </div>
                </div>
            </div>
            {/* ─── Descripción (Ancho completo debajo) ────────────────────── */}
            <div
                id="descripcion-producto"
                style={{ 
                    gridColumn: '1 / -1', 
                    marginTop: 48, 
                    paddingTop: 48, 
                    borderTop: '1px solid var(--border)',
                    animation: 'fadeIn 0.6s ease-out forwards',
                    scrollMarginTop: 185
                }}
            >
                <h3 style={{ 
                    fontSize: '1.5rem', 
                    fontWeight: 800, 
                    marginBottom: 24, 
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.02em'
                }}>
                    Descripción del producto
                </h3>
                <div style={{
                    color: 'var(--text-secondary)',
                    lineHeight: '1.8',
                    fontSize: '1.05rem',
                    whiteSpace: 'pre-wrap', // Esto respeta los saltos de línea
                    maxWidth: '900px' // Opcional: para que no sea excesivamente ancho en pantallas gigantes
                }}>
                    {product.long_description || 'Sin descripción disponible.'}
                </div>
            </div>

            {/* Specs Modal */}
            {specsOpen && product.short_description && (
                <div
                    onClick={() => setSpecsOpen(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1000,
                        background: 'rgba(0,0,0,0.8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '24px',
                        backdropFilter: 'blur(6px)',
                        animation: 'fadeIn 0.2s ease-out'
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '28px 32px',
                            maxWidth: 560,
                            width: '100%',
                            maxHeight: '80vh',
                            overflowY: 'auto',
                            position: 'relative',
                            boxShadow: 'var(--shadow-lg)'
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                                📋 Especificaciones principales
                            </h3>
                            <button
                                onClick={() => setSpecsOpen(false)}
                                style={{
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-light)',
                                    borderRadius: '50%',
                                    width: 32,
                                    height: 32,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: 'var(--text-secondary)',
                                    flexShrink: 0
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                        {/* Nombre del producto */}
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                            {product.name}
                        </p>
                        {/* Contenido */}
                        <div style={{
                            fontSize: '0.92rem',
                            lineHeight: '1.75',
                            color: 'var(--text-secondary)',
                            whiteSpace: 'pre-wrap',
                            borderTop: '1px solid var(--border-light)',
                            paddingTop: 16,
                            marginBottom: 24
                        }}>
                            {product.short_description}
                        </div>
                        {/* Botón ir a descripción */}
                        <button
                            onClick={() => {
                                setSpecsOpen(false)
                                setTimeout(() => {
                                    document.getElementById('descripcion-producto')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                }, 150)
                            }}
                            style={{
                                width: '100%',
                                padding: '12px 20px',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--accent)',
                                border: 'none',
                                color: '#fff',
                                fontSize: '0.92rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8
                            }}
                        >
                            Ver descripción completa ↓
                        </button>
                    </div>
                </div>
            )}

            {/* Lightbox Modal */}
            {lightboxOpen && images.length > 0 && (
                <div className="lightbox-overlay" onClick={() => setLightboxOpen(false)}>
                    <button className="lightbox-close" onClick={() => setLightboxOpen(false)}>
                        <X size={32} />
                    </button>

                    {images.length > 1 && (
                        <>
                            <button className="lightbox-nav lightbox-prev" onClick={prevImage}>
                                <ChevronLeft size={48} />
                            </button>
                            <button className="lightbox-nav lightbox-next" onClick={nextImage}>
                                <ChevronRight size={48} />
                            </button>
                        </>
                    )}

                    <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
                        <img
                            src={images[lightboxIndex]?.public_url || ''}
                            alt={product.name}
                        />
                        <div className="lightbox-counter">
                            {lightboxIndex + 1} / {images.length}
                        </div>
                    </div>
                </div>
            )}

            {/* Added to Cart Modal */}
            <AddedToCartModal
                isOpen={addedModalOpen}
                onClose={() => setAddedModalOpen(false)}
                productName={product.name}
                productImage={mainImage}
                onViewCart={handleViewCart}
            />
        </div>
    )
}
