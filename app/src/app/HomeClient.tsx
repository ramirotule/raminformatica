'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronRight, ChevronLeft, Zap, TrendingUp, Star } from 'lucide-react'
import ProductCard from '@/components/ProductCard'
import WeeklyNews from '@/components/WeeklyNews'
import { dict } from '@/lib/dict'
import type { ProductWithDetails, HomeSlide, BrandLogo } from '@/lib/database.types'

interface HomeClientProps {
    products: ProductWithDetails[]
    slides: HomeSlide[]
    brandLogos: BrandLogo[]
    news: WeeklyNews[]
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

// ─── Brand Logos Section (Infinite Ticker) ───────────────────────
function BrandTicker({ logos }: { logos: BrandLogo[] }) {
    if (logos.length === 0) return null

    const slugify = (text: string) =>
        text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

    // Duplicamos para asegurar el loop infinito sin saltos
    const doubledLogos = [...logos, ...logos, ...logos]

    return (
        <section style={{ padding: '60px 0', overflow: 'hidden', borderTop: '1px solid var(--border)' }}>
            {/* <div className="container" style={{ marginBottom: 32 }}>
                <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 4 }}>Nuestras Marcas</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Socios estratégicos de RAM</p>
                </div>
            </div> */}

            {/* <div className="container">
                <div className="brand-ticker-container" style={{ position: 'relative', width: '100%', overflow: 'hidden', padding: '40px 0' }}>
                    <div
                        className="brand-ticker-track"
                        style={{
                            display: 'flex',
                            gap: 20,
                            width: 'max-content',
                            padding: '10px 0'
                        }}
                    >
                        {doubledLogos.map((logo, i) => (
                            <Link
                                key={`${logo.id}-${i}`}
                                href={`/productos?marca=${slugify(logo.name)}`}
                                style={{
                                    minWidth: 160,
                                    height: 100,
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 16,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 20,
                                    transition: 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                    cursor: 'pointer',
                                    textDecoration: 'none',
                                    position: 'relative'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'scale(1.2) translateY(-8px)'
                                    e.currentTarget.style.borderColor = 'var(--accent)'
                                    e.currentTarget.style.zIndex = '10'
                                    e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.2)'
                                    const img = e.currentTarget.querySelector('img')
                                    if (img) img.style.transform = 'scale(1.3)'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'scale(1) translateY(0)'
                                    e.currentTarget.style.borderColor = 'var(--border)'
                                    e.currentTarget.style.zIndex = '1'
                                    e.currentTarget.style.boxShadow = 'none'
                                    const img = e.currentTarget.querySelector('img')
                                    if (img) img.style.transform = 'scale(1)'
                                }}
                            >
                                <img
                                    src={logo.logo_url}
                                    alt={logo.name}
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        objectFit: 'contain',
                                        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                    }}
                                />
                            </Link>
                        ))}
                    </div>
                </div>
            </div> */}
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

export default function HomeClient({ products, slides, brandLogos, news }: HomeClientProps) {
    console.log('DEBUG [HomeClient] Total products:', products?.length)
    console.log('DEBUG [HomeClient] Featured products:', products?.filter(p => !!p.is_featured).length)
    if (products?.length > 0) {
        console.log('DEBUG [HomeClient] Sample product keys:', Object.keys(products[0]))
        console.log('DEBUG [HomeClient] Sample product is_featured:', products[0].is_featured)
    }

    // "Más vendidos" – filtrados por is_featured (usamos doble negación para asegurar booleano)
    const masVendidos = (products || []).filter(p => !!p.is_featured).slice(0, 10)

    return (
        <>
            {/* ─── HERO CAROUSEL ───────────────────────────── */}
            {/* <HeroCarousel slides={slides} products={products} /> */}

            {/* ─── HERO TEXT ──────────────────────────────────── */}
            <section className="hero" style={{ 
                minHeight: '80vh', 
                padding: '160px 0 60px', 
                background: 'var(--bg-primary)',
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden'
            }}>
                <div className="container hero-grid-layout">
                    {/* Left Column: Hero Text */}
                    <div className="hero-content-left">
                        <div className="hero-eyebrow" style={{ justifyContent: 'flex-start' }}>
                            <Zap size={13} />
                            <span>Toda la Tecnología que buscas</span>
                        </div>

                        <h1 className="hero-title" style={{ 
                            fontSize: 'clamp(2.2rem, 3.8vw, 4.2rem)',
                            lineHeight: 1.1,
                            marginBottom: 24,
                            textAlign: 'left'
                        }}>
                            <span>{dict.hero.titulo}</span>
                            <br />
                            {dict.hero.subtitulo}
                        </h1>

                        <p className="hero-desc" style={{ 
                            fontSize: '1.15rem', 
                            maxWidth: '100%', 
                            marginBottom: 44, 
                            opacity: 0.92,
                            textAlign: 'left',
                            marginInline: 0 
                        }}>
                            {dict.hero.descripcion}
                        </p>

                        <div className="hero-actions" style={{ justifyContent: 'flex-start' }}>
                            <Link href="/productos" className="btn btn-primary">
                                {dict.hero.cta}
                                <ChevronRight size={16} />
                            </Link>
                            <Link href="/categorias" className="btn btn-secondary">
                                {dict.hero.ctaSecundario}
                            </Link>
                        </div>
                    </div>

                    {/* Right Column: WeeklyNews Component */}
                    <div className="hero-slide-right">
                        <WeeklyNews isHero initialNews={news} />
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

            {/* ─── SEO FOOTER CONTENT ──────────────────────── */}
            <section className="section" style={{ paddingTop: 40, paddingBottom: 80, opacity: 0.8 }}>
                <div className="container">
                    <div style={{ maxWidth: '800px', marginInline: 'auto', textAlign: 'center' }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 16 }}>Tu aliado tecnológico en Santa Rosa, La Pampa</h2>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                            En RAM Informática nos especializamos en acercar lo último en tecnología a la Patagonia.
                            Si estás buscando comprar una <strong>PlayStation</strong>, un <strong>iPhone</strong> o renovar tu <strong>Notebook</strong> en Santa Rosa,
                            ofrecemos asesoramiento personalizado y los mejores precios del mercado.
                            Nuestra trayectoria desde 2008 avala nuestro compromiso con la innovación y la satisfacción del cliente.
                            Realizamos envíos garantizados a todo el país.
                        </p>
                    </div>
                </div>
            </section>

            {/* ─── BRAND LOGOS TICKER ──────────────────────── */}
            <BrandTicker logos={brandLogos} />
        </>
    )
}
