'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Bell, Zap, Cpu, Sparkles, Loader2, X, MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { WeeklyNews as NewsType } from '@/lib/database.types'
import { phone } from '@/const/phone'

const iconMap: Record<string, React.ReactNode> = {
    Zap: <Zap size={20} />,
    Sparkles: <Sparkles size={20} />,
    Cpu: <Cpu size={20} />,
    Bell: <Bell size={20} />,
}

export default function WeeklyNews() {
    const [news, setNews] = useState<NewsType[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedNews, setSelectedNews] = useState<NewsType | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        async function fetchNews() {
            setLoading(true)
            const { data } = await supabase
                .from('weekly_news')
                .select('*')
                .eq('active', true)
                .order('sort_order', { ascending: true })
            if (data) setNews(data)
            setLoading(false)
        }
        fetchNews()
    }, [])

    const scroll = (dir: 'left' | 'right') => {
        if (!scrollRef.current) return
        const amt = 300
        scrollRef.current.scrollBy({ left: dir === 'left' ? -amt : amt, behavior: 'smooth' })
    }

    if (!loading && news.length === 0) return null

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
                    {loading ? (
                        <div style={{ padding: '20px', width: '100%', display: 'flex', justifyContent: 'center' }}>
                            <Loader2 className="animate-spin" size={24} color="var(--green)" />
                        </div>
                    ) : (
                        news.map((item) => (
                            <div
                                key={item.id}
                                style={{
                                    minWidth: 320,
                                    maxWidth: 320,
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 16,
                                    padding: 20,
                                    position: 'relative',
                                    transition: 'transform 0.2s',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setSelectedNews(item)}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                {item.image_url && (
                                    <div style={{
                                        margin: '-20px -20px 16px -20px',
                                        height: 160,
                                        overflow: 'hidden',
                                        borderRadius: '16px 16px 0 0',
                                        borderBottom: '1px solid var(--border)',
                                        background: 'var(--bg-secondary)'
                                    }}>
                                        <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                )}

                                {!item.image_url && (
                                    <div style={{
                                        background: `${item.color}15`,
                                        color: item.color || '#34C759',
                                        width: 40,
                                        height: 40,
                                        borderRadius: 10,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: 16
                                    }}>
                                        {iconMap[item.icon_name || 'Bell'] || <Bell size={20} />}
                                    </div>
                                )}



                                <h4 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>{item.title}</h4>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {item.description}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Modal de Detalle */}
            {selectedNews && (
                <div
                    className="modal-overlay animate-fade-in-fast"
                    style={{ zIndex: 1000, position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
                    onClick={() => setSelectedNews(null)}
                >
                    <div
                        className="modal animate-scale-up"
                        style={{ maxWidth: 500, width: '100%', background: 'var(--bg-card)', borderRadius: 24, overflow: 'hidden', position: 'relative', border: '1px solid var(--border)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setSelectedNews(null)}
                            style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}
                        >
                            <X size={18} />
                        </button>

                        {selectedNews.image_url && (
                            <div style={{ width: '100%', height: 320, background: 'var(--bg-secondary)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img src={selectedNews.image_url} alt={selectedNews.title} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                            </div>
                        )}

                        <div style={{ padding: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                {!selectedNews.image_url && (
                                    <div style={{
                                        background: `${selectedNews.color}15`,
                                        color: selectedNews.color || '#34C759',
                                        width: 48,
                                        height: 48,
                                        borderRadius: 12,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        {iconMap[selectedNews.icon_name || 'Bell'] || <Bell size={24} />}
                                    </div>
                                )}
                                <div>
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.2 }}>{selectedNews.title}</h2>
                                </div>
                            </div>

                            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
                                {selectedNews.description}
                            </p>

                            <a
                                href={`https://wa.me/${phone}?text=${encodeURIComponent(`Hola! Vi la novedad "${selectedNews.title}" en la web y quería consultarles más información.`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary"
                                style={{ width: '100%', justifyContent: 'center', gap: 10, padding: '14px 0', fontSize: '1rem', background: '#25D366', borderColor: '#25D366' }}
                            >
                                <MessageCircle size={20} />
                                Consultar por WhatsApp
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </section>
    )
}

