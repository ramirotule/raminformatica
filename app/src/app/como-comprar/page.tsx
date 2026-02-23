import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Cómo comprar | RAM Informática',
    description: 'Guía paso a paso sobre cómo comprar en nuestra tienda online.',
}

export default function ComoComprarPage() {
    return (
        <div className="container" style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '24px', textAlign: 'center' }}>
                Cómo comprar
            </h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ background: 'var(--bg-glass)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '12px', color: 'var(--accent)' }}>
                        1. Elegí tus productos
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        Navegá por nuestro catálogo o usá el buscador para encontrar lo que necesitás. Podés ver las características y elegir la variante (color, capacidad, etc.) antes de agregar al carrito.
                    </p>
                </div>

                <div style={{ background: 'var(--bg-glass)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '12px', color: 'var(--accent)' }}>
                        2. Agregá al carrito
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        Una vez que te decidas, hacé clic en "Agregar al carrito". Podés seguir navegando y sumando productos o ir directamente a tu carrito para finalizar la compra.
                    </p>
                </div>

                <div style={{ background: 'var(--bg-glass)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '12px', color: 'var(--accent)' }}>
                        3. Finalizá la compra
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        Desde el carrito, iniciá el proceso de checkout mediante el botón de WhatsApp. Esto nos enviará un mensaje con tu pedido.
                    </p>
                </div>

                <div style={{ background: 'var(--bg-glass)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '12px', color: 'var(--accent)' }}>
                        4. Medios de pago y entrega
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        Una vez recibido el mensaje, nos pondremos en contacto con vos para coordinar el pago y la entrega de forma segura en Santa Rosa o el envío a todo el país.
                    </p>
                </div>
            </div>
        </div>
    )
}
