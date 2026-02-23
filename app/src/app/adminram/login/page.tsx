'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { LogIn, Lock, Mail, Chrome, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react'

export default function LoginPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [view, setView] = useState<'login' | 'mfa'>('login')
    const [mfaCode, setMfaCode] = useState('')

    // Verificar si ya está logueado
    useEffect(() => {
        async function checkSession() {
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
                // Check MFA status
                const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
                if (data?.currentLevel === 'aal2') {
                    router.push('/adminram')
                } else if (data?.nextLevel === 'aal2') {
                    setView('mfa')
                } else {
                    // No hay MFA configurado? Deberíamos forzarlo si queremos 2FA
                    router.push('/adminram')
                }
            }
        }
        checkSession()
    }, [router])

    async function handleGoogleLogin() {
        setLoading(true)
        setError(null)
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/adminram`,
            },
        })
        if (error) {
            setError(error.message)
            setLoading(false)
        }
    }

    async function handleEmailLogin(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) throw error

            const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
            if (mfaData?.nextLevel === 'aal2') {
                setView('mfa')
            } else {
                router.push('/adminram')
            }
        } catch (err: any) {
            setError(err.message || 'Error al iniciar sesión')
        } finally {
            setLoading(false)
        }
    }

    async function handleVerifyMfa(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            // Obtener el factor activo
            const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors()
            if (factorsError) throw factorsError

            const factor = factors.totp[0] // Asumimos el primero
            if (!factor) throw new Error('No se encontró factor de autenticación configurado')

            const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
                factorId: factor.id,
                code: mfaCode
            })

            if (verifyError) throw verifyError

            router.push('/adminram')
        } catch (err: any) {
            setError(err.message || 'Código inválido')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
        }}>
            <div className="card" style={{ maxWidth: 400, width: '100%', padding: 40, position: 'relative' }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{
                        width: 64,
                        height: 64,
                        background: 'rgba(52, 199, 89, 0.1)',
                        borderRadius: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px',
                        color: 'var(--green)'
                    }}>
                        {view === 'login' ? <LogIn size={32} /> : <ShieldCheck size={32} />}
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                        {view === 'login' ? 'Acceso Administrador' : 'Verificación 2FA'}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 8 }}>
                        {view === 'login' ? 'Inicia sesión para gestionar tu tienda' : 'Ingresa el código de 6 dígitos de tu app'}
                    </p>
                </div>

                {error && (
                    <div className="alert alert-error" style={{ marginBottom: 24, fontSize: '0.85rem' }}>
                        <AlertCircle size={14} />
                        {error}
                    </div>
                )}

                {view === 'login' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {/* Google Auth */}
                        <button
                            className="btn btn-ghost btn-full"
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid var(--border)',
                                height: 48,
                                gap: 10
                            }}
                        >
                            <Chrome size={20} />
                            Continuar con Google
                        </button>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            color: 'var(--text-muted)',
                            fontSize: '0.8rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            <div style={{ flex: 1, height: 1, background: 'var(--border)' }}></div>
                            <span>O con correo</span>
                            <div style={{ flex: 1, height: 1, background: 'var(--border)' }}></div>
                        </div>

                        {/* Email Form */}
                        <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.8rem' }}>Correo Electrónico</label>
                                <div style={{ position: 'relative' }}>
                                    <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="email"
                                        className="form-input"
                                        style={{ paddingLeft: 42 }}
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        placeholder="admin@raminformatica.com"
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.8rem' }}>Contraseña</label>
                                <div style={{ position: 'relative' }}>
                                    <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="password"
                                        className="form-input"
                                        style={{ paddingLeft: 42 }}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                className="btn btn-primary btn-full"
                                disabled={loading}
                                style={{ height: 48, marginTop: 8 }}
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Iniciar Sesión'}
                            </button>
                        </form>
                    </div>
                ) : (
                    /* MFA Form */
                    <form onSubmit={handleVerifyMfa} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div className="form-group">
                            <input
                                type="text"
                                className="form-input"
                                style={{
                                    textAlign: 'center',
                                    fontSize: '2rem',
                                    letterSpacing: '0.5em',
                                    fontWeight: 800,
                                    height: 64
                                }}
                                maxLength={6}
                                value={mfaCode}
                                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                                placeholder="000000"
                                required
                                autoFocus
                            />
                        </div>
                        <button
                            type="submit"
                            className="btn btn-primary btn-full"
                            disabled={loading || mfaCode.length < 6}
                            style={{ height: 48 }}
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Verificar y Continuar'}
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost btn-full"
                            onClick={() => {
                                supabase.auth.signOut()
                                setView('login')
                            }}
                        >
                            Volver al inicio
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}
