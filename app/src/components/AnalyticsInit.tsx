'use client'

/**
 * AnalyticsInit — Inicialización avanzada de GA4
 *
 * Ejecuta una sola vez por sesión (sessionStorage cache):
 *   1. Obtiene IP + ISP vía ipapi.co
 *   2. Si la IP coincide con NEXT_PUBLIC_DEVELOPER_IP → traffic_type: 'internal'
 *   3. Envía ISP como Custom Dimension (user_isp) para cruzar datos de ciudades
 *   4. Habilita Google Signals y User Data
 *   5. En desarrollo: loguea todos los parámetros a consola
 */

import { useEffect } from 'react'
import { GA_ID } from '@/lib/analytics'

const DEV_IP = process.env.NEXT_PUBLIC_DEVELOPER_IP
const CACHE_KEY = 'ram_analytics_init'

interface IpapiResponse {
    ip: string
    city: string
    region: string
    country_name: string
    org: string    // ISP — ej: "AS7303 Telecom Argentina S.A."
}

export default function AnalyticsInit() {
    useEffect(() => {
        // Evitar llamadas repetidas en la misma sesión
        if (sessionStorage.getItem(CACHE_KEY)) return

        async function init() {
            try {
                const res = await fetch('https://ipapi.co/json/')
                if (!res.ok) throw new Error(`ipapi status ${res.status}`)
                const data: IpapiResponse = await res.json()

                const { ip, city, region, org: isp } = data
                const isInternal = !!DEV_IP && ip === DEV_IP

                // Config GA4 con parámetros avanzados
                const configParams: Record<string, any> = {
                    allow_google_signals: true,
                    allow_ad_personalization_signals: true,
                    user_isp: isp,
                    ...(isInternal && { traffic_type: 'internal' }),
                }

                if (window.gtag) {
                    // Re-configurar con los parámetros extendidos
                    window.gtag('config', GA_ID, configParams)

                    // ISP como User Property (persiste entre sesiones en GA4)
                    window.gtag('set', 'user_properties', { user_isp: isp })
                }

                // Log de desarrollo
                if (process.env.NODE_ENV === 'development') {
                    const marker = isInternal ? '🏠 INTERNO' : '🌐 externo'
                    console.group(`[GA4 Init] ${marker}`)
                    console.log('IP detectada:', ip)
                    console.log('Ciudad / Región:', `${city}, ${region}`)
                    console.log('ISP:', isp)
                    console.log('traffic_type:', isInternal ? 'internal' : '(normal)')
                    console.log('GA4 config enviada:', configParams)
                    console.groupEnd()
                }

                sessionStorage.setItem(CACHE_KEY, '1')
            } catch (err) {
                // No bloquear el sitio si falla la detección de IP
                if (process.env.NODE_ENV === 'development') {
                    console.warn('[GA4 Init] No se pudo detectar IP/ISP:', err)
                }
            }
        }

        init()
    }, [])

    return null
}
