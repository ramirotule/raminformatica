import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Nosotros | RAM Informática',
    description: 'Conocé nuestra historia, desde nuestros comienzos en Santa Rosa hasta nuestra tienda online actual.',
}

export default function NosotrosPage() {
    return (
        <div className="container" style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '24px', textAlign: 'center' }}>
                Quiénes somos
            </h1>

            <section style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>Nuestra Historia</h2>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 600, marginBottom: '8px', color: 'var(--accent)' }}>Los Comienzos</h3>
                <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    RAM Informática nació con un local físico ubicado en la Calle Ayala 604 de Santa Rosa, La Pampa, en Agosto del 2008. Durante 13 años, fuimos un punto de referencia en la ciudad para todo lo relacionado con tecnología e informática, brindando asesoramiento especializado y productos de calidad a la comunidad.
                </p>
                <div style={{ marginBottom: '16px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                    <img
                        src="/local.png"
                        alt="Local RAM Informática"
                        style={{ width: '100%', display: 'block' }}
                    />
                </div>
                <p style={{ fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center' }}>
                    *Nuestro local en Calle Ayala 604, Santa Rosa, La Pampa allá por el año 2021*
                </p>
            </section>

            <section style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 600, marginBottom: '8px', color: 'var(--accent)' }}>Una Era que Termina</h3>
                <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                    Nuestro local estuvo abierto al público hasta Octubre del 2021, brindando atención personalizada y productos de calidad a toda la comunidad pampeana. Fue una etapa llena de aprendizajes, crecimiento y vínculos especiales con nuestros clientes, quienes confiaron en nosotros para sus necesidades tecnológicas.
                </p>
            </section>

            <section style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 600, marginBottom: '8px', color: 'var(--accent)' }}>Reinventándose en el Futuro</h3>
                <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                    Hoy nos reinventamos en modo ecommerce, adaptándonos a los nuevos tiempos sin perder nuestra esencia. Mantenemos los mismos valores que nos caracterizaron desde el primer día: honestidad, precios competitivos y un compromiso genuino con la satisfacción de nuestros clientes.
                </p>
            </section>

            <section style={{ marginBottom: '40px' }}>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 600, marginBottom: '8px', color: 'var(--accent)' }}>Nuestro Compromiso</h3>
                <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    La misma calidad y confianza de siempre, ahora al alcance de un click. Continuamos ofreciendo productos de tecnología con el mismo nivel de excelencia y atención personalizada que nos caracterizó durante todos estos años.
                </p>
                <div style={{ background: 'var(--bg-glass)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
                        ¿Tenés alguna consulta? No dudes en contactarnos
                    </p>
                    <a href="/?contacto" className="btn btn-primary">
                        Contactanos
                    </a>
                </div>
            </section>
        </div>
    )
}
