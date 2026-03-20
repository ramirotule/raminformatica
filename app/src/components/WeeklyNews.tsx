'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { WeeklyNews as NewsType } from '@/lib/database.types'

export default function WeeklyNews({ isHero = false }: { isHero?: boolean }) {
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
                
                if (data) {
                    // Solo mostramos los que tienen imagen
                    const onlyWithImages = (data as NewsType[]).filter(item => item.image_url)
                    setNews(onlyWithImages)
                }
            } catch (error) {
                console.error("Error fetching news:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchNews()
    }, [])

    const nextStep = () => {
        if (news.length === 0) return
        setDirection(1)
        setIndex((prev) => (prev + 1) % news.length)
    }

    const prevStep = () => {
        if (news.length === 0) return
        setDirection(-1)
        setIndex((prev) => (prev - 1 + news.length) % news.length)
    }

    if (!loading && news.length === 0) return null

    const currentItem = news[index]

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? '100%' : '-100%',
            opacity: 0,
            scale: 0.9,
            z: -100,
            filter: 'blur(10px)'
        }),
        center: {
            x: 0,
            opacity: 1,
            scale: 1,
            z: 0,
            filter: 'blur(0px)',
            transition: {
                x: { type: 'spring' as any, stiffness: 260, damping: 26 },
                opacity: { duration: 0.5 },
                scale: { duration: 0.5 },
                z: { duration: 0.5 },
                filter: { duration: 0.5 }
            }
        },
        exit: (direction: number) => ({
            x: direction < 0 ? '100%' : '-100%',
            opacity: 0,
            scale: 0.9,
            z: -100,
            filter: 'blur(10px)',
            transition: {
                x: { type: 'spring' as any, stiffness: 260, damping: 26 },
                opacity: { duration: 0.4 }
            }
        })
    }

    return (
        <section style={{ 
            paddingTop: isHero ? '0px' : '0px', 
            paddingBottom: isHero ? '0px' : '80px', 
            overflow: 'hidden', 
            position: 'relative',
            background: isHero ? 'transparent' : 'var(--bg-primary)'
        }}>
            <div className="container" style={{ position: 'relative', zIndex: 1 }}>
                {!isHero && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32, textAlign: 'center' }}>
                        <h2 style={{ 
                            fontSize: 'clamp(2rem, 5vw, 3.5rem)', 
                            fontWeight: 950, 
                            letterSpacing: '0.02em', 
                            lineHeight: 1.1,
                        }}>
                            Novedades & Ofertas <span style={{ color: 'var(--green)' }}>{new Date().toLocaleString('es-AR', { month: 'long' }).toUpperCase()}</span>
                        </h2>
                    </div>
                )}

                {loading ? (
                    <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Loader2 className="animate-spin" size={48} color="var(--green)" />
                    </div>
                ) : (
                    <div style={{ position: 'relative', maxWidth: '1400px', margin: '0 auto' }}>
                        <div style={{ position: 'relative', height: 'auto', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: '2000px' }}>
                            <AnimatePresence initial={false} custom={direction} mode="popLayout">
                                <motion.div
                                    key={currentItem?.id}
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
                                        maxWidth: isHero ? '100%' : '1100px',
                                        cursor: 'grab'
                                    }}
                                >
                                    <div style={{
                                        width: '100%',
                                        background: 'var(--bg-card)',
                                        borderRadius: 24,
                                        border: '1px solid var(--border)',
                                        overflow: 'hidden',
                                        boxShadow: 'var(--shadow-lg)',
                                        position: 'relative'
                                    }}>
                                        <div style={{ width: '100%', position: 'relative', background: '#000', overflow: 'hidden', cursor: (currentItem as any).link_url ? 'pointer' : 'grab' }}>
                                            {(currentItem as any).link_url ? (
                                                <Link href={(currentItem as any).link_url}>
                                                    <motion.div 
                                                        whileHover={{ opacity: 0.95, scale: 1.01 }}
                                                        transition={{ duration: 0.2 }}
                                                    >
                                                        <img 
                                                            src={currentItem.image_url!} 
                                                            alt={currentItem.title || ''} 
                                                            style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }} 
                                                        />
                                                    </motion.div>
                                                </Link>
                                            ) : (
                                                <img 
                                                    src={currentItem.image_url!} 
                                                    alt={currentItem.title || ''} 
                                                    style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }} 
                                                />
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* Bottom Navigation */}
                        {news.length > 1 && (
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'center', 
                                alignItems: 'center',
                                gap: 24, 
                                marginTop: 40 
                            }}>
                                <button 
                                    onClick={prevStep}
                                    className="carousel-nav-btn" 
                                    style={{ 
                                        width: 50, 
                                        height: 50, 
                                        flexShrink: 0,
                                        background: 'var(--bg-card)', 
                                        borderRadius: '50%',
                                        border: '1px solid var(--border-light)',
                                        color: 'var(--text-primary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                                        boxShadow: 'var(--shadow-card)',
                                        position: 'relative',
                                        zIndex: 2
                                    }}
                                >
                                    <ChevronLeft size={24} />
                                </button>

                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                    {news.map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                setDirection(i > index ? 1 : -1)
                                                setIndex(i)
                                            }}
                                            style={{
                                                width: i === index ? 36 : 10,
                                                height: 10,
                                                borderRadius: 10,
                                                background: i === index ? 'var(--green)' : 'var(--text-muted)',
                                                opacity: i === index ? 1 : 0.25,
                                                border: 'none',
                                                transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                                                cursor: 'pointer'
                                            }}
                                        />
                                    ))}
                                </div>

                                <button 
                                    onClick={nextStep}
                                    className="carousel-nav-btn" 
                                    style={{ 
                                        width: 50, 
                                        height: 50, 
                                        flexShrink: 0,
                                        background: 'var(--bg-card)', 
                                        borderRadius: '50%',
                                        border: '1px solid var(--border-light)',
                                        color: 'var(--text-primary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                                        boxShadow: 'var(--shadow-card)',
                                        position: 'relative',
                                        zIndex: 2
                                    }}
                                >
                                    <ChevronRight size={24} />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style jsx>{`
                .carousel-nav-btn:hover {
                    transform: scale(1.15) translateY(-2px);
                    background: var(--green) !important;
                    border-color: var(--green) !important;
                    color: white !important;
                    box-shadow: 0 10px 20px rgba(52, 199, 89, 0.3) !important;
                }
                .carousel-nav-btn:active {
                    transform: scale(0.95);
                }
            `}</style>
        </section>
    )
}
