'use client'

import { useState, useEffect } from 'react'
import { X, Bell, ChevronRight } from 'lucide-react'
import { dict } from '@/lib/dict'
import { phone } from '@/const/phone'
import { trackWhatsappClick } from '@/lib/analytics'

export default function PromoModal() {
    const [isOpen, setIsOpen] = useState(false)
    const [currentSlide, setCurrentSlide] = useState(0)

    const MODAL_SLIDES = [
        {
            id: 's26',
            tag: 'PRÓXIMO LANZAMIENTO',
            title: 'Samsung S26 Ultra',
            desc: 'Preventa exclusiva la próxima semana. Cupos limitados para reserva.',
            image: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&q=80&w=1000',
            btnText: 'Info Preventa',
            whatsapp: '¡Hola RAM! Me interesa la preventa del Samsung S26 Ultra.'
        },
        {
            id: 'canje',
            tag: 'PLAN CANJE',
            title: 'Traé tu usado',
            desc: 'Tomamos tu iPhone o Samsung como parte de pago. ¡Renovate hoy!',
            image: 'https://images.unsplash.com/photo-1556656793-062ff987820d?auto=format&fit=crop&q=80&w=1000',
            btnText: 'Consultar Cotización',
            whatsapp: '¡Hola RAM! Quisiera cotizar mi equipo usado para el Plan Canje.'
        },
        {
            id: 'service',
            tag: 'SERVICIO TÉCNICO',
            title: 'Reparación Express',
            desc: 'Cambiamos tu pantalla o batería en el día con repuestos originales.',
            image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&q=80&w=1000',
            btnText: 'Pedir Turno',
            whatsapp: '¡Hola RAM! Necesito reparar mi equipo, ¿me dan turno?'
        }
    ]

    const handleWhatsApp = (msg: string, slideId?: string) => {
        trackWhatsappClick('promo_modal', slideId)
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
        window.open(url, '_blank')
        handleClose()
    }

    useEffect(() => {
        const hasSeenPromo = sessionStorage.getItem('promo_v2_seen')
        if (!hasSeenPromo) {
            const timer = setTimeout(() => setIsOpen(true), 2500)
            return () => clearTimeout(timer)
        }
    }, [])

    // Lógica de auto-slide
    useEffect(() => {
        if (!isOpen) return
        const timer = setInterval(() => {
            setCurrentSlide(prev => (prev + 1) % MODAL_SLIDES.length)
        }, 5000)
        return () => clearInterval(timer)
    }, [isOpen])

    const handleClose = () => {
        setIsOpen(false)
        sessionStorage.setItem('promo_v2_seen', 'true')
    }

    if (!isOpen) return null

    const slide = MODAL_SLIDES[currentSlide]

    return (
        <div className="modal-overlay animate-fade-in" style={{ zIndex: 9999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }} onClick={(e) => e.target === e.currentTarget && handleClose()}>
            <div className="modal animate-scale-up" style={{ maxWidth: 400, padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg-card)' }}>
                {/* Botón Cerrar */}
                <button aria-label="Cerrar" onClick={handleClose} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 50 }}>
                    <X size={16} />
                </button>

                {/* Área de Slide (Imagen) */}
                <div style={{ position: 'relative', width: '100%', height: 220, background: '#000' }}>
                    {MODAL_SLIDES.map((s, i) => (
                        <div key={s.id} style={{ position: 'absolute', inset: 0, opacity: i === currentSlide ? 1 : 0, transition: 'opacity 0.6s ease', overflow: 'hidden' }}>
                            <img src={s.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(to top, var(--bg-card), transparent)' }} />
                        </div>
                    ))}

                    {/* Dots / Indicadores */}
                    <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6, zIndex: 20 }}>
                        {MODAL_SLIDES.map((_, i) => (
                            <div key={i} onClick={() => setCurrentSlide(i)} style={{ width: i === currentSlide ? 20 : 6, height: 6, borderRadius: 10, background: i === currentSlide ? 'var(--green)' : 'rgba(255,255,255,0.3)', cursor: 'pointer', transition: 'all 0.3s' }} />
                        ))}
                    </div>
                </div>

                {/* Contenido Dinámico */}
                <div style={{ padding: '24px 32px 32px', textAlign: 'center' }}>
                    <div style={{ background: 'rgba(52,199,89,0.1)', color: 'var(--green)', padding: '3px 10px', borderRadius: 100, fontSize: '0.65rem', fontWeight: 700, display: 'inline-block', marginBottom: 12, letterSpacing: '0.05em' }}>
                        {slide.tag}
                    </div>

                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 8, lineHeight: 1.1 }}>
                        {slide.title}
                    </h2>

                    <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.85rem', lineHeight: 1.5, minHeight: 40 }}>
                        {slide.desc}
                    </p>

                    <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', height: 48 }} onClick={() => handleWhatsApp(slide.whatsapp, slide.id)}>
                        {slide.btnText}
                        <ChevronRight size={18} style={{ marginLeft: 6 }} />
                    </button>

                    <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8, fontSize: '0.8rem', opacity: 0.6 }} onClick={handleClose}>
                        Ver el resto del sitio
                    </button>
                </div>
            </div>
        </div>
    )
}
