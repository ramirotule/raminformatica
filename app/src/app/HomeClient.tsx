'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronRight, ChevronLeft, Zap, TrendingUp, Star } from 'lucide-react'
import ProductCard from '@/components/ProductCard'
import { dict } from '@/lib/dict'
import type { ProductWithDetails, HomeSlide, BrandLogo } from '@/lib/database.types'

interface HomeClientProps {
    products: ProductWithDetails[]
    slides: HomeSlide[]
    brandLogos: BrandLogo[]
}

// ─── Hero Carousel (from DB slides) ──────────────────────────────
function HeroCarousel({ slides, products }: { slides: HomeSlide[]; products: ProductWithDetails[] }) {
    const [current, setCurrent] = useState(0)
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Si no hay slides configurados en admin, usar productos con imágenes como fallback
    const fallbackSlides: HomeSlide[] = products
        .filter(p => p.product_images && p.product_images.length > 0)
        .slice(0, 5)
        .map((p) => ({
            id: p.id,
            title: p.name,
            subtitle: `${p.brands?.name || ''} · ${p.categories?.name || ''}`,
            image_url: p.product_images!.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0].public_url,
            storage_path: null,
            product_id: p.id,
            link_url: `/productos/${p.slug}`,
            sort_order: 0,
            active: true,
            created_at: p.created_at,
        }))

    const activeSlides = slides.length > 0 ? slides : fallbackSlides

    const resetTimer = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
            setCurrent((c) => (c + 1) % activeSlides.length)
        }, 5000)
    }, [activeSlides.length])

    useEffect(() => {
        resetTimer()
        return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
    }, [current, resetTimer])

    const goTo = (i: number) => setCurrent(i)
    const prev = () => { setCurrent((c) => (c - 1 + activeSlides.length) % activeSlides.length) }
    const next = () => { setCurrent((c) => (c + 1) % activeSlides.length) }

    if (activeSlides.length === 0) return null

    return (
        <section className="hero-carousel">
            <div className="carousel-track">
                {activeSlides.map((slide, i) => {
                    const isActive = i === current
                    const href = slide.link_url || (slide.product_id ? `/productos/${slide.products?.slug || slide.product_id}` : '#')
                    return (
                        <Link
                            href={href}
                            key={slide.id}
                            className={`carousel-slide ${isActive ? 'active' : ''}`}
                            style={{
                                transform: `translateX(${(i - current) * 100}%)`,
                            }}
                        >
                            <div className="carousel-slide-bg">
                                <img src={slide.image_url} alt={slide.title || ''} />
                                <div className="carousel-gradient" />
                            </div>
                            <div className="carousel-slide-content">
                                <div className="carousel-badge">
                                    <Star size={12} />
                                    <span>Destacado</span>
                                </div>
                                <h2 className="carousel-product-name">{slide.title}</h2>
                                {slide.subtitle && (
                                    <p className="carousel-product-brand">{slide.subtitle}</p>
                                )}
                                <span className="carousel-cta">
                                    Ver más <ChevronRight size={16} />
                                </span>
                            </div>
                        </Link>
                    )
                })}
            </div>

            {activeSlides.length > 1 && (
                <>
                    <button className="carousel-arrow carousel-arrow-left" onClick={prev} aria-label="Anterior">
                        <ChevronLeft size={24} />
                    </button>
                    <button className="carousel-arrow carousel-arrow-right" onClick={next} aria-label="Siguiente">
                        <ChevronRight size={24} />
                    </button>
                    <div className="carousel-dots">
                        {activeSlides.map((_, i) => (
                            <button
                                key={i}
                                className={`carousel-dot ${i === current ? 'active' : ''}`}
                                onClick={() => goTo(i)}
                                aria-label={`Slide ${i + 1}`}
                            />
                        ))}
                    </div>
                </>
            )}
        </section>
    )
}

// ─── Brand Logos Ticker ─────────────────────────────────────────
function BrandTicker({ logos }: { logos: BrandLogo[] }) {
    if (logos.length === 0) return null

    // Duplicamos para loop infinito
    const doubled = [...logos, ...logos]

    const slugify = (text: string) =>
        text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

    return (
        <section className="brand-ticker-section">
            <div className="container" style={{ marginBottom: 24 }}>
                <p style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                    Marcas que trabajamos
                </p>
            </div>
            <div className="brand-ticker-wrapper">
                <div className="brand-ticker-track">
                    {doubled.map((logo, i) => (
                        <Link
                            key={`${logo.id}-${i}`}
                            href={`/productos?marca=${slugify(logo.name)}`}
                            className="brand-ticker-item"
                            title={logo.name}
                        >
                            <img src={logo.logo_url} alt={logo.name} />
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    )
}

// ─── Product Row Section ────────────────────────────────────────
function ProductRow({
    title,
    subtitle,
    icon,
    products,
    viewAllHref,
    accentColor = 'var(--green)',
}: {
    title: string
    subtitle: string
    icon: React.ReactNode
    products: ProductWithDetails[]
    viewAllHref: string
    accentColor?: string
}) {
    const scrollRef = useRef<HTMLDivElement>(null)

    const scroll = (dir: 'left' | 'right') => {
        if (!scrollRef.current) return
        const amount = 320
        scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' })
    }

    if (products.length === 0) return null

    return (
        <section className="section" style={{ paddingBlock: 0 }}>
            <div className="container">
                <div className="product-row-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div className="product-row-icon" style={{ background: `${accentColor}15`, color: accentColor }}>
                            {icon}
                        </div>
                        <div>
                            <h2 className="product-row-title">{title}</h2>
                            <p className="product-row-subtitle">{subtitle}</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button className="carousel-nav-btn" onClick={() => scroll('left')} aria-label="Anterior">
                            <ChevronLeft size={18} />
                        </button>
                        <button className="carousel-nav-btn" onClick={() => scroll('right')} aria-label="Siguiente">
                            <ChevronRight size={18} />
                        </button>
                        <Link href={viewAllHref} className="btn btn-ghost btn-sm" style={{ color: accentColor, border: `1px solid ${accentColor}30` }}>
                            Ver todos <ChevronRight size={14} />
                        </Link>
                    </div>
                </div>
                <div className="product-row-scroll" ref={scrollRef}>
                    {products.map((p) => (
                        <div key={p.id} className="product-row-card">
                            <ProductCard product={p} />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

export default function HomeClient({ products, slides, brandLogos }: HomeClientProps) {
    // "Más vendidos" – filtrados por is_featured
    const masVendidos = products.filter(p => p.is_featured).slice(0, 10)

    return (
        <>
            {/* ─── HERO CAROUSEL ───────────────────────────── */}
            {/* <HeroCarousel slides={slides} products={products} /> */}

            {/* ─── HERO TEXT ──────────────────────────────────── */}
            <section className="hero" style={{ minHeight: 'auto', padding: '64px 0', paddingTop: '200px' }}>
                <div className="container hero-content">
                    <div className="hero-eyebrow">
                        <Zap size={13} />
                        <span>Toda la Tecnología que buscas en un solo lugar</span>
                    </div>

                    <h1 className="hero-title">
                        <span>{dict.hero.titulo}</span>
                        <br />
                        {dict.hero.subtitulo}
                    </h1>

                    <p className="hero-desc">{dict.hero.descripcion}</p>

                    <div className="hero-actions">
                        <Link href="/productos" className="btn btn-primary">
                            {dict.hero.cta}
                            <ChevronRight size={16} />
                        </Link>
                        <Link href="/categorias" className="btn btn-secondary">
                            {dict.hero.ctaSecundario}
                        </Link>
                    </div>
                </div>
            </section>

            {/* ─── PRODUCTOS MÁS VENDIDOS ──────────────────── */}
            <ProductRow
                title="Productos más vendidos"
                subtitle="Los favoritos de nuestros clientes"
                icon={<TrendingUp size={22} />}
                products={masVendidos}
                viewAllHref="/productos"
                accentColor="var(--green)"
            />

            {/* ─── BRAND LOGOS TICKER ──────────────────────── */}
            <BrandTicker logos={brandLogos} />
        </>
    )
}
