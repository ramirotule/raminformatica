'use client'

import { useState } from 'react'
import { useCart } from '@/context/CartContext'
import { useDolarBlue } from '@/hooks/useDolarBlue'
import { formatUSD, formatARS, getPriceUSD, getPriceARS, conditionLabel } from '@/lib/utils'
import type { ProductWithDetails, ProductImage } from '@/lib/database.types'
import { ShoppingCart, ChevronLeft, Minus, Plus, ShieldCheck, Truck, X, ChevronRight, House } from 'lucide-react'
import Link from 'next/link'
import AddedToCartModal from '@/components/AddedToCartModal'

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

    const variant = product.product_variants?.[0]
    const priceUSD = getPriceUSD(variant?.prices, product.price_usd)
    const priceARS = priceUSD && dolar ? getPriceARS(priceUSD, dolar.venta) : null
    const stock = variant?.inventory?.[0]?.qty_available ?? 0

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
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mainImage} alt={product.name} className="main-image" />
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
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={img.public_url || ''} alt={product.name} />
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
                    {priceUSD !== null ? (
                        <>
                            <div className="detail-price-usd">{formatUSD(priceUSD)}</div>
                            {priceARS !== null && (
                                <div className="detail-price-ars">{formatARS(priceARS)} ARS</div>
                            )}
                        </>
                    ) : (
                        <div className="detail-price-usd">Consultar precio</div>
                    )}
                    <p className="price-notice">* Precio sujeto a cambios sin previo aviso</p>
                </div>

                <div className="detail-description">
                    <h3 style={{ fontSize: '1rem', marginBottom: 8, color: 'var(--text-primary)' }}>Descripción</h3>
                    <p>{product.short_description || 'Sin descripción disponible.'}</p>
                </div>

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
