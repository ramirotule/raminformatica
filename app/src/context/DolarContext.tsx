'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { DolarBlue } from '@/lib/database.types'

const DOLAR_API = 'https://dolarapi.com/v1/dolares/blue'
const REFRESH_MS = 10 * 60 * 1000 // 10 minutos

interface DolarContextType {
    dolar: DolarBlue | null
    loading: boolean
    error: string | null
    lastUpdate: Date | null
    refetch: () => Promise<void>
}

const DolarContext = createContext<DolarContextType | undefined>(undefined)

export function DolarProvider({ children }: { children: React.ReactNode }) {
    const [dolar, setDolar] = useState<DolarBlue | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

    const fetchDolar = useCallback(async () => {
        try {
            setError(null)
            const res = await fetch(DOLAR_API, { next: { revalidate: 600 } })
            if (!res.ok) throw new Error('Error al obtener cotización')
            const data: DolarBlue = await res.json()
            setDolar(data)
            setLastUpdate(new Date())
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchDolar()
        const interval = setInterval(fetchDolar, REFRESH_MS)
        return () => clearInterval(interval)
    }, [fetchDolar])

    return (
        <DolarContext.Provider value={{ dolar, loading, error, lastUpdate, refetch: fetchDolar }}>
            {children}
        </DolarContext.Provider>
    )
}

export function useDolar() {
    const context = useContext(DolarContext)
    if (context === undefined) {
        throw new Error('useDolar debe usarse dentro de un DolarProvider')
    }
    return context
}
