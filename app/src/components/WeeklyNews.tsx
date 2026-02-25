'use client'

import { useRef } from 'react'
import { ChevronLeft, ChevronRight, Bell, Zap, Cpu, Sparkles } from 'lucide-react'

const NEWS = [
    {
        id: 1,
        title: "Ingreso iPhone 16 Pro",
        desc: "Ya llegaron las primeras unidades. Retiro inmediato en Santa Rosa.",
        icon: <Zap size={20} />,
        color: "#34C759", // Verde RAM
        tag: "NUEVO"
    },
    {
        id: 2,
        title: "Plan Canje Activo",
        desc: "Tomamos tu iPhone o Samsung usado como parte de pago. Consultanos.",
        icon: <Sparkles size={20} />,
        color: "#5856D6", // Violeta
        tag: "OFERTA"
    },
    {
        id: 3,
        title: "Notebooks para Estudiantes",
        desc: "Llevate tu laptop con 12 cuotas sin interés y mochila de regalo.",
        icon: <Cpu size={20} />,
        color: "#007AFF", // Azul
        tag: "PROMO"
    },
    {
        id: 4,
        title: "Servicio Técnico RAM",
        desc: "Reparación de pantallas y cambio de batería en solo 60 minutos.",
        icon: <Bell size={20} />,
        color: "#FF9500", // Naranja
        tag: "SERVICIO"
    }
]

export default function WeeklyNews() {
    const scrollRef = useRef<HTMLDivElement>(null)

    const scroll = (dir: 'left' | 'right') => {
        if (!scrollRef.current) return
        const amt = 300
        scrollRef.current.scrollBy({ left: dir === 'left' ? -amt : amt, behavior: 'smooth' })
    }

    return (
        <section style={{ padding: '40px 0', overflow: 'hidden' }}>
            <div className="container">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 4 }}>Novedades de la Semana</h3>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="carousel-nav-btn" onClick={() => scroll('left')}><ChevronLeft size={18} /></button>
                        <button className="carousel-nav-btn" onClick={() => scroll('right')}><ChevronRight size={18} /></button>
                    </div>
                </div>

                <div
                    ref={scrollRef}
                    style={{
                        display: 'flex',
                        gap: 16,
                        overflowX: 'auto',
                        paddingBottom: 10,
                        WebkitOverflowScrolling: 'touch',
                        scrollbarWidth: 'none'
                    }}
                    className="no-scrollbar"
                >
                    {NEWS.map((item) => (
                        <div
                            key={item.id}
                            style={{
                                minWidth: 280,
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border)',
                                borderRadius: 16,
                                padding: 20,
                                position: 'relative',
                                transition: 'transform 0.2s',
                                cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <div style={{
                                background: `${item.color}15`,
                                color: item.color,
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 16
                            }}>
                                {item.icon}
                            </div>

                            <div style={{
                                position: 'absolute',
                                top: 20,
                                right: 20,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 4,
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-muted)',
                                border: '1px solid var(--border)'
                            }}>
                                {item.tag}
                            </div>

                            <h4 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>{item.title}</h4>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                {item.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
