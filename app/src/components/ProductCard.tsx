'use client'

import { useDolarBlue } from '@/hooks/useDolarBlue'
import { formatUSD, formatARS, getPriceUSD, getPriceARS, conditionLabel } from '@/lib/utils'
import type { ProductWithDetails } from '@/lib/database.types'

const CATEGORY_EMOJI: Record<string, string> = {
    'celulares-iphone': '📱',
    'celulares-samsung': '📱',
    'celulares-motorola': '📱',
    'celulares-infinix': '📱',
    'celulares-xiaomi': '📱',
    'jbl-parlantes-auriculares': '🎵',
    'video-juegos': '🎮',
    'airpods': '🎧',
    'apple-watch': '⌚',
    'ipad': '📲',
    'macbook': '💻',
    'televisores': '📺',
}

interface ProductCardProps {
    product: ProductWithDetails
    onClick?: (product: ProductWithDetails) => void
}

import Link from 'next/link'

export default function ProductCard({ product }: ProductCardProps) {
    const { dolar } = useDolarBlue()

    const images = [...(product.product_images || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    const variant = product.product_variants?.[0]
    const priceUSD = getPriceUSD(variant?.prices, product.price_usd)
    const priceARS = priceUSD && dolar ? getPriceARS(priceUSD, dolar.venta) : null
    const stock = (variant?.inventory as any)?.[0]?.qty_available ?? null
    const image = product.product_images && product.product_images.length > 0
        ? [...product.product_images].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))[0]
        : null
    const emoji = CATEGORY_EMOJI[(product.categories as any)?.slug] ?? '📦'

    const conditionClass: Record<string, string> = {
        new: 'badge-new',
        oem: 'badge-oem',
        refurbished: 'badge-refurbished',
        used: 'badge-used',
    }

    return (
        <Link
            href={`/productos/${product.slug}`}
            className="product-card animate-fade-in"
            aria-label={`Ver detalles de ${product.name}`}
        >
            {/* Imagen */}
            <div className="product-image-wrap">
                {image?.public_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={image.public_url}
                        alt={image.alt || product.name}
                        loading="lazy"
                    />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        {(product as any).categories?.icon_url && (product as any).categories.icon_url.startsWith('http') ? (
                            <img
                                src={(product as any).categories.icon_url}
                                alt={(product as any).categories.name}
                                style={{ width: 64, height: 64, objectFit: 'contain', padding: 0 }}
                            />
                        ) : (
                            <span className="product-emoji" role="img" aria-label={(product as any).name}>
                                {(product as any).categories?.icon_url || emoji}
                            </span>
                        )}
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Imagen no disponible
                        </span>
                    </div>
                )}

                {/* Badge condición */}
                <div style={{ position: 'absolute', top: 10, left: 10 }}>
                    <span className={`badge ${conditionClass[(product as any).condition || 'new'] ?? 'badge-new'}`}>
                        {conditionLabel((product as any).condition || 'new')}
                    </span>
                </div>

                {/* Badge stock bajo REMOVED */}
            </div>

            {/* Info */}
            <div className="product-info">
                <p className="product-brand">{(product as any).brands?.name ?? 'Marca'}</p>
                <h3 className="product-name">{(product as any).name}</h3>

                {variant?.storage && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {[variant.storage, variant.color, variant.connectivity].filter(Boolean).join(' · ')}
                    </p>
                )}

                <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                    {priceARS !== null ? (
                        <>
                            <p className="product-price-usd" style={{ fontSize: '1.25rem' }}>{formatARS(priceARS)}</p>
                            {priceUSD !== null && (
                                <p className="product-price-ars" style={{ fontSize: '0.85rem', marginTop: 4 }}>{formatUSD(priceUSD)} USD</p>
                            )}
                        </>
                    ) : priceUSD !== null ? (
                        <p className="product-price-usd" style={{ fontSize: '1.25rem' }}>{formatUSD(priceUSD)} USD</p>
                    ) : (
                        <p className="product-price-usd" style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
                            Consultar precio
                        </p>
                    )}

                    {/* Stock message REMOVED */}
                </div>
            </div>
        </Link>
    )
}

// Versión skeleton para loading
export function ProductCardSkeleton() {
    return (
        <div className="product-card" style={{ pointerEvents: 'none' }}>
            <div className="product-image-wrap skeleton" style={{ aspectRatio: '1' }} />
            <div className="product-info">
                <div className="skeleton" style={{ height: 12, width: '40%', borderRadius: 4 }} />
                <div className="skeleton" style={{ height: 16, width: '90%', borderRadius: 4, marginTop: 6 }} />
                <div className="skeleton" style={{ height: 12, width: '60%', borderRadius: 4 }} />
                <div className="skeleton" style={{ height: 20, width: '50%', borderRadius: 4, marginTop: 12 }} />
            </div>
        </div>
    )
}
