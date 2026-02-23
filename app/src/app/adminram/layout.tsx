'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import { Loader2, ShieldAlert } from 'lucide-react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const [status, setStatus] = useState<'loading' | 'authorized' | 'unauthorized'>('loading')

    useEffect(() => {
        if (pathname === '/adminram/login') {
            setStatus('authorized')
            return
        }

        async function checkAuth() {
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                router.push('/adminram/login')
                return
            }

            // Check if user is the authorized admin
            const authorizedEmails = ['raminformatik@gmail.com']
            if (!authorizedEmails.includes(session.user.email!)) {
                await supabase.auth.signOut()
                router.push('/adminram/login?error=unauthorized')
                return
            }

            // Check MFA
            const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

            if (error) {
                console.error('Error checking MFA:', error)
                setStatus('unauthorized')
                return
            }

            if (data?.currentLevel === 'aal2') {
                setStatus('authorized')
            } else if (data?.nextLevel === 'aal2') {
                // Hay MFA configurado pero no verificado en esta sesión
                router.push('/adminram/login')
                return
            } else {
                // No hay MFA configurado. 
                // Por ahora permitimos entrar pero podrías redirigir a un flujo de "Setup 2FA"
                setStatus('authorized')
            }
        }

        checkAuth()
    }, [router, pathname])

    if (status === 'loading') {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'var(--bg-primary)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 20
            }}>
                <Loader2 size={48} className="animate-spin" color="var(--green)" />
                <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Verificando credenciales...</p>
            </div>
        )
    }

    if (status === 'unauthorized') {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'var(--bg-primary)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
                textAlign: 'center'
            }}>
                <ShieldAlert size={64} color="var(--red)" style={{ marginBottom: 24 }} />
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 12 }}>Acceso Denegado</h1>
                <p style={{ color: 'var(--text-muted)', maxWidth: 400 }}>
                    No tienes permisos para acceder a esta sección o tu sesión ha expirado.
                </p>
                <button
                    className="btn btn-primary"
                    style={{ marginTop: 32 }}
                    onClick={() => router.push('/adminram/login')}
                >
                    Volver al login
                </button>
            </div>
        )
    }

    return <>{children}</>
}
