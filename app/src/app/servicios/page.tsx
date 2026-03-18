import { Metadata } from 'next'
import { Zap, ShieldCheck, Truck, Smartphone, Gamepad2, Laptop, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
    title: 'Nuestros Servicios | RAM Informática Santa Rosa',
    description: 'Descubrí todo lo que RAM Informática tiene para ofrecerte en Santa Rosa, La Pampa: Venta de iPhones, PlayStation, Notebooks, servicio técnico y más.',
    keywords: ['RAM Informática', 'servicios', 'iPhones Santa Rosa', 'PlayStation Santa Rosa', 'tecnología La Pampa', 'comprar celulares'],
}

export default function ServiciosPage() {
    const services = [
        {
            title: 'Expertos en Celulares',
            desc: 'Contamos con el catálogo más completo de Celulares iPhones, Motorola, Samsung, Infinix, Xiaomi. Todos los equipos son nuevos, sellados y con garantía oficial. Te asesoramos para que encuentres el modelo que mejor se adapta a tus necesidades y presupuesto.',
            icon: <Smartphone className="text-accent" size={32} />,
            keywords: 'iPhone 15, iPhone 14, iPhone 13, Apple Watch, AirPods'
        },
        {
            title: 'Universo Gaming & PlayStation',
            desc: 'Somos referentes en consolas de Videojuegos en Santa Rosa. Encontrá Playstation 5, Nintendo Switch, Xbox, Joysticks y accesorios con garantía oficial y el mejor asesoramiento para gamers.',
            icon: <Gamepad2 className="text-accent" size={32} />,
            keywords: 'PlayStation 5, PS5, DualSense, Juegos PS5'
        },
        {
            title: 'iPads & Tablets',
            desc: 'La herramienta definitiva para diseño y productividad. Ofrecemos iPads en todas sus versiones y las mejores tablets del mercado, junto con Apple Pencil, Magic Mouse y Magic Keyboard para completar tu workstation móvil.',
            icon: <Smartphone className="text-accent" size={32} />, // Note: Could use Tablet but Smartphone is consistent with user's style
            keywords: 'iPad Pro, iPad Air, Apple Pencil, Magic Keyboard, Galaxy Tab'
        },
        {
            title: 'Fotografía & Drones',
            desc: 'Capturá momentos únicos con equipos profesionales. Contamos con cámaras fotográficas de última generación y drones DJI para perspectivas increíbles, ideales para creadores de contenido.',
            icon: <Zap className="text-accent" size={32} />,
            keywords: 'Cámaras Reflex, Mirrorless, Drones DJI, Estabilizadores'
        },
        {
            title: 'Audio Premium JBL',
            desc: 'Sumergite en el mejor sonido. Todo en audio JBL: desde parlantes portátiles resistentes al agua hasta sistemas de sonido para el hogar y los infaltables AirPods para tu ecosistema Apple.',
            icon: <Zap className="text-accent" size={32} />,
            keywords: 'JBL Flip, JBL Charge, AirPods Pro, AirPods Max, Sonido Hi-Fi'
        },
        {
            title: 'Smart Life & Wearables',
            desc: 'Llevá la tecnología con vos. Encontrá lo último en Smart Watches (Apple Watch, Samsung Gear) y los innovadores lentes inteligentes Ray-Ban Meta para capturar tu mundo con manos libres.',
            icon: <ShieldCheck className="text-accent" size={32} />,
            keywords: 'Apple Watch Series, Ray-Ban Meta, Smartwatch, Lentes Inteligentes'
        },
        {
            title: 'Cómputo de Alto Rendimiento',
            desc: 'Equipos de alto rendimiento para trabajar y crear sin límites. iMac, MacBook Pro, MacBook Air, notebooks gamers y estaciones de trabajo diseñadas para edición, arquitectura y uso profesional.',
            icon: <Laptop className="text-accent" size={32} />,
            keywords: 'iMac, Mac Studio, PC Master Race, Diseño Gráfico'
        },
        {
            title: 'Gaming Avanzado & VR',
            desc: 'Viví el futuro hoy con realidad virtual. Además de consolas, somos distribuidores de Meta Quest y Sony VR2  para una inmersión total. El paraíso para el gamer exigente.',
            icon: <Gamepad2 className="text-accent" size={32} />,
            keywords: 'Meta Quest 3, VR, Realidad Virtual, Gaming Gear'
        },
        {
            title: 'Smart TV & Tv Box',
            desc: 'Viví el mejor entretenimiento en casa. Televisores 4K desde 32" a 100" y equipos ideales para disfrutar tus series, películas y deportes favoritos.',
            icon: <Laptop className="text-accent" size={32} />,
            keywords: 'Smart TV 4K, Android TV, Domótica, Chromecast'
        },
        {
            title: 'Envíos a Todo el País',
            desc: 'Llegamos a cada rincón de Argentina con envíos rápidos y seguros. En Santa Rosa y zonas aledañas, coordinamos entregas personalizadas para tu mayor comodidad.',
            icon: <Truck className="text-accent" size={32} />,
            keywords: 'Envíos a La Pampa, Envíos nacionales, Mercado Envíos'
        },
        {
            title: 'Seguridad y Confianza',
            desc: 'Desde 2008 brindamos soluciones tecnológicas reales. Todos nuestros productos cuentan con garantía y soporte post-venta personalizado.',
            icon: <ShieldCheck className="text-accent" size={32} />,
            keywords: 'Garantía escrita, Soporte técnico, RAM Informática Trayectoria'
        }
    ]

    return (
        <main>
            {/* Hero Section */}
            <section className="hero" style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', paddingTop: '40px' }}>
                <div className="container hero-content">
                    <div className="hero-eyebrow">
                        <Zap size={13} />
                        <span>Innovación y Compromiso</span>
                    </div>
                    <h1 className="hero-title">
                        <span>Qué ofrecemos en</span>
                        <br />
                        RAM Informática
                    </h1>
                    <p className="hero-desc">
                        Mucho más que una tienda de tecnología. Somos tu aliado estratégico en Santa Rosa para acceder a lo último del mundo digital con confianza y respaldo.
                    </p>
                </div>
            </section>

            {/* Services Web UI */}
            <section className="section">
                <div className="container">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
                        {services.map((service, index) => (
                            <div
                                key={index}
                                className="card"
                                style={{
                                    padding: '40px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '20px',
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border)',
                                    transition: 'transform 0.3s ease'
                                }}
                            >
                                <div style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '16px',
                                    background: 'rgba(52, 199, 89, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {service.icon}
                                </div>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{service.title}</h3>
                                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{service.desc}</p>
                                <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                        Tags: {service.keywords}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Call to Action */}
            <section className="section" style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
                <div className="container" style={{ textAlign: 'center' }}>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '24px' }}>¿Listo para dar el salto tecnológico?</h2>
                    <p style={{ maxWidth: '600px', margin: '0 auto 40px', color: 'var(--text-secondary)' }}>
                        Visitá nuestro catálogo completo o consultanos por WhatsApp para un asesoramiento personalizado. Estamos en Santa Rosa, listos para ayudarte.
                    </p>
                    <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Link href="/productos" className="btn btn-primary btn-lg">
                            Explorar Productos <ArrowRight size={18} />
                        </Link>
                        <Link href="/nosotros" className="btn btn-secondary btn-lg">
                            Nuestra Historia
                        </Link>
                    </div>
                </div>
            </section>
        </main>
    )
}
