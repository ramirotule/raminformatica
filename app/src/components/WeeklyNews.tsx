'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Bell, Zap, Cpu, Sparkles, Loader2, MessageCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import type { WeeklyNews as NewsType } from '@/lib/database.types'
import { phone } from '@/const/phone'

const iconMap: Record<string, React.ReactNode> = {
    Zap: <Zap size={32} />,
    Sparkles: <Sparkles size={32} />,
    Cpu: <Cpu size={32} />,
    Bell: <Bell size={32} />,
}

export default function WeeklyNews() {
    const [news, setNews] = useState<NewsType[]>([])
    const [loading, setLoading] = useState(true)
    const [index, setIndex] = useState(0)
    const [direction, setDirection] = useState(0)

    useEffect(() => {
        async function fetchNews() {
            setLoading(true)
            try {
                const { data } = await supabase
                    .from('weekly_news')
                    .select('*')
                    .eq('active', true)
                    .order('sort_order', { ascending: true })
                if (data && data.length > 0) setNews(data)
            } catch (error) {
                console.error("Error fetching news:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchNews()
    }, [])

    const nextStep = () => {
        setDirection(1)
        setIndex((prev) => (prev + 1) % news.length)
    }

    const prevStep = () => {
        setDirection(-1)
        setIndex((prev) => (prev - 1 + news.length) % news.length)
    }

    if (!loading && news.length === 0) return null

    const currentItem = news[index]

    const variants = {
        enter: (direction: number) => ({
            y: -800,
            x: direction > 0 ? 100 : -100,
            opacity: 0,
            scale: 1.5,
            rotate: direction > 0 ? 30 : -30,
            rotateY: direction > 0 ? 45 : -45,
            z: 200
        }),
        center: {
            zIndex: 1,
            y: 0,
            x: 0,
            opacity: 1,
            scale: 1,
            rotate: 0,
            rotateY: 0,
            z: 0,
            transition: {
                type: 'spring' as any,
                stiffness: 70,
                damping: 15,
                mass: 1,
                restDelta: 0.001
            }
        },
        exit: (direction: number) => ({
            zIndex: 0,
            y: 800,
            x: direction < 0 ? 100 : -100,
            opacity: 0,
            scale: 0.5,
            rotate: direction < 0 ? 30 : -30,
            rotateY: direction < 0 ? 45 : -45,
            z: -200,
            transition: {
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1] as any
            }
        })
    }

    return (
        <section style={{ 
            paddingTop: '0px', 
            paddingBottom: '100px', 
            overflow: 'hidden', 
            position: 'relative',
            background: 'var(--bg-primary)'
        }}>
            {/* Background Glow */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentItem?.id}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 0.15, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.2 }}
                    transition={{ duration: 1 }}
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        x: '-50%',
                        y: '-50%',
                        width: '800px',
                        height: '800px',
                        background: (currentItem?.color || '#34c759') as string,
                        filter: 'blur(160px)',
                        borderRadius: '100%',
                        zIndex: 0,
                        pointerEvents: 'none'
                    }}
                />
            </AnimatePresence>

            <div className="container" style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40, flexWrap: 'wrap', gap: 20 }}>
                    <div style={{ textAlign: 'left' }}>
                        <motion.div 
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: 10, 
                                background: 'rgba(52, 199, 89, 0.1)', 
                                padding: '8px 20px', 
                                borderRadius: 100, 
                                color: 'var(--green)',
                                fontSize: '0.8rem',
                                fontWeight: 800,
                                letterSpacing: '0.15em',
                                textTransform: 'uppercase',
                                marginBottom: 16,
                                border: '1px solid rgba(52, 199, 89, 0.2)'
                            }}
                        >
                            <Sparkles size={16} /> Oportunidades Directas
                        </motion.div>
                        <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 1.1 }}>
                            Novedades de la <span style={{ color: 'var(--green)', position: 'relative' }}>Semana</span>
                        </h2>
                    </div>

                    <div style={{ display: 'flex', gap: 12 }}>
                        <button 
                            onClick={prevStep}
                            className="carousel-nav-btn" 
                            style={{ 
                                width: 56, 
                                height: 56, 
                                background: 'var(--bg-secondary)', 
                                borderRadius: '50%',
                                border: '1px solid var(--border)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <button 
                            onClick={nextStep}
                            className="carousel-nav-btn" 
                            style={{ 
                                width: 56, 
                                height: 56, 
                                background: 'var(--bg-secondary)', 
                                borderRadius: '50%',
                                border: '1px solid var(--border)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            <ChevronRight size={24} />
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Loader2 className="animate-spin" size={48} color="var(--green)" />
                    </div>
                ) : (
                    <div style={{ position: 'relative', maxWidth: '1200px', margin: '0 auto' }}>
                        <div style={{ position: 'relative', height: 'auto', minHeight: '600px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: '2000px', padding: '40px 0' }}>
                            <AnimatePresence initial={false} custom={direction} mode="popLayout">
                                <motion.div
                                    key={index}
                                    custom={direction}
                                    variants={variants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    drag="x"
                                    dragConstraints={{ left: 0, right: 0 }}
                                    dragElastic={1}
                                    onDragEnd={(e, { offset, velocity }) => {
                                        const swipe = Math.abs(offset.x) > 100 || Math.abs(velocity.x) > 500;
                                        if (swipe) {
                                            if (offset.x > 0) prevStep();
                                            else nextStep();
                                        }
                                    }}
                                    style={{
                                        position: 'relative',
                                        width: '100%',
                                        maxWidth: '520px',
                                        cursor: 'grab'
                                    }}
                                >
                                    <div style={{
                                        width: '100%',
                                        background: 'var(--bg-card)',
                                        borderRadius: 32,
                                        border: '1px solid var(--border-light)',
                                        overflow: 'hidden',
                                        boxShadow: '0 50px 100px -20px rgba(0,0,0,0.7)',
                                        position: 'relative',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}>
                                        {currentItem.image_url ? (
                                            <div style={{ width: '100%', position: 'relative', background: '#000', aspectRatio: '4/5' }}>
                                                <img 
                                                    src={currentItem.image_url} 
                                                    alt={currentItem.title} 
                                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                                                />
                                            </div>
                                        ) : (
                                            <div style={{ 
                                                width: '100%', 
                                                aspectRatio: '4/5',
                                                display: 'flex', 
                                                flexDirection: 'column', 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                padding: 60,
                                                textAlign: 'center',
                                                background: `linear-gradient(135deg, var(--bg-card) 0%, ${currentItem.color || 'var(--green)'}10 100%)`
                                            }}>
                                                <motion.div 
                                                    animate={{ 
                                                        y: [0, -10, 0],
                                                        rotate: [0, 5, -5, 0]
                                                    }}
                                                    transition={{ repeat: Infinity, duration: 4 }}
                                                    style={{ 
                                                        width: 100, 
                                                        height: 100, 
                                                        borderRadius: 30, 
                                                        background: `${currentItem.color || '#34c759'}20`, 
                                                        color: currentItem.color || 'var(--green)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        marginBottom: 40,
                                                        boxShadow: `0 20px 40px ${currentItem.color || 'var(--green)'}20`
                                                    }}>
                                                    {iconMap[currentItem.icon_name || 'Bell'] || <Bell size={32} />}
                                                </motion.div>
                                                <h3 style={{ fontSize: '2.5rem', fontWeight: 950, marginBottom: 20, letterSpacing: '-0.03em' }}>{currentItem.title}</h3>
                                                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.1rem' }}>{currentItem.description}</p>
                                            </div>
                                        )}

                                        {/* Footer Content */}
                                        <div style={{ 
                                            padding: '24px 32px 32px',
                                            background: 'var(--bg-card)',
                                            borderTop: '1px solid var(--border)',
                                            zIndex: 2
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 16 }}>
                                                <div style={{ flex: 1 }}>
                                                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white' }}>{currentItem.title}</h3>
                                                    <p style={{ 
                                                        fontSize: '0.85rem', 
                                                        color: 'var(--text-secondary)', 
                                                        display: '-webkit-box', 
                                                        WebkitLineClamp: 1, 
                                                        WebkitBoxOrient: 'vertical', 
                                                        overflow: 'hidden' 
                                                    }}>
                                                        {currentItem.description}
                                                    </p>
                                                </div>
                                                {currentItem.tag && (
                                                    <span style={{ 
                                                        padding: '4px 12px', 
                                                        borderRadius: 8, 
                                                        background: currentItem.color || 'var(--green)', 
                                                        color: 'white', 
                                                        fontSize: '0.65rem', 
                                                        fontWeight: 900,
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        {currentItem.tag}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <motion.a
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                href={`https://wa.me/${phone}?text=${encodeURIComponent(`Hola! Vi el producto "${currentItem.title}" en la web y quería consultarles.`)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-primary"
                                                style={{ 
                                                    width: '100%', 
                                                    justifyContent: 'center', 
                                                    background: '#25D366', 
                                                    borderColor: '#25D366',
                                                    height: 56,
                                                    fontSize: '1rem',
                                                    boxShadow: '0 20px 40px rgba(37, 211, 102, 0.2)',
                                                    borderRadius: 16
                                                }}
                                            >
                                                <MessageCircle size={20} /> ¡Lo quiero ya!
                                            </motion.a>
                                        </div>
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* Dots */}
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'center', 
                            gap: 12, 
                            marginTop: 20 
                        }}>
                            {news.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => {
                                        setDirection(i > index ? 1 : -1)
                                        setIndex(i)
                                    }}
                                    style={{
                                        width: i === index ? 40 : 12,
                                        height: 12,
                                        borderRadius: 10,
                                        background: i === index ? 'var(--green)' : 'rgba(255,255,255,0.1)',
                                        border: 'none',
                                        transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                                        cursor: 'pointer'
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                .carousel-nav-btn:hover {
                    transform: scale(1.1);
                    background: var(--green) !important;
                    border-color: var(--green) !important;
                }
            `}</style>
        </section>
    )
}
