import Link from 'next/link'
import { dict } from '@/lib/dict'

export default function NotFound() {
    return (
        <div
            style={{
                minHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                gap: 16,
                padding: 24,
            }}
        >
            <div style={{ fontSize: '5rem' }}>😕</div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>{dict.errores.noEncontrado}</h1>
            <p style={{ color: 'var(--text-muted)', maxWidth: 400 }}>
                La página que buscás no existe o fue movida.
            </p>
            <Link href="/" className="btn btn-primary" style={{ marginTop: 8 }}>
                Volver al inicio
            </Link>
        </div>
    )
}
