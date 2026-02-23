'use client'

import Link from 'next/link'
import { dict } from '@/lib/dict'
import { MapPin, Clock, Phone, Instagram, Facebook } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'

export default function Footer() {
    const { theme } = useTheme()

    return (
        <footer className="site-footer">
            <div className="container">
                <div className="footer-grid">
                    {/* Columna 1: Marca */}
                    <div>
                        <img
                            src={theme === 'dark' ? '/logo_transparent_dark.png' : '/logo_transparent_light.png'}
                            alt="RAM Informática"
                            className="footer-brand-logo"
                        />
                        <p className="footer-desc">
                            Tu tienda de tecnología de confianza en Santa Rosa, La Pampa. <br />
                            Celulares, Consolas de Videojuegos, Notebooks y mucho más.
                        </p>
                        <div className="footer-social-links">
                            <a
                                href="https://www.instagram.com/ram.informatica"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="footer-social-link"
                                title="Instagram"
                            >
                                <Instagram size={20} />
                            </a>
                            <a
                                href="https://www.facebook.com/raminformatica"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="footer-social-link"
                                title="Facebook"
                            >
                                <Facebook size={20} />
                            </a>
                        </div>
                    </div>

                    {/* Columna 2: Navegación */}
                    <div>
                        <h4 className="footer-heading">Navegación</h4>
                        <ul className="footer-links">
                            <li><Link href="/">Inicio</Link></li>
                            <li><Link href="/productos">Productos</Link></li>
                            <li><Link href="/categorias">Categorías</Link></li>
                            <li><Link href="/nosotros">Nosotros</Link></li>
                            <li><Link href="/como-comprar">Cómo comprar</Link></li>
                        </ul>
                    </div>

                    {/* Columna 3: Horarios */}
                    <div>
                        <h4 className="footer-heading">Horarios</h4>
                        <ul className="footer-links">
                            <li>
                                <Clock size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--green)' }} />
                                <div>
                                    <strong style={{ color: 'var(--text-primary)' }}>Lunes a Viernes</strong>
                                    <br />9:00 a 17:00 hs
                                </div>
                            </li>
                            <li>
                                <Clock size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--green)' }} />
                                <div>
                                    <strong style={{ color: 'var(--text-primary)' }}>Sábados</strong>
                                    <br />10:00 a 13:00 hs
                                </div>
                            </li>
                        </ul>
                    </div>

                    {/* Columna 4: Contacto */}
                    <div>
                        <h4 className="footer-heading">Contacto</h4>
                        <ul className="footer-links">
                            <li>
                                <MapPin size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--green)' }} />
                                <div>
                                    Lebensohn 3980
                                    <br />Santa Rosa, La Pampa
                                </div>
                            </li>
                            <li>
                                <img src="/whatsapp-logo.png" alt="" style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2 }} />
                                <div>
                                    <a href="https://wa.me/5492954621345" target="_blank" rel="noopener noreferrer">
                                        WhatsApp (Ramiro)
                                    </a>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="footer-bottom">
                    <p>{dict.footer.derechos}</p>
                    <p>Lebensohn 3980, Santa Rosa, La Pampa · Tel: 2954-227622</p>
                </div>
            </div>
        </footer>
    )
}
