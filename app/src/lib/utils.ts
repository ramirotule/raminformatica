import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Price } from './database.types'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatUSD(amount: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount)
}

export function formatARS(amount: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount)
}

export function getPriceUSD(prices: Price[] | undefined, priceUSD?: number | null): number | null {
    if (priceUSD !== undefined && priceUSD !== null) return Number(priceUSD)
    if (!prices) return null
    const price = prices.find((p) => p.currency === 'USD')
    return price ? Number(price.amount) : null
}

export function getPriceARS(priceUSD: number, dolarVenta: number): number {
    return Math.round(priceUSD * dolarVenta)
}

export function conditionLabel(condition: string): string {
    const map: Record<string, string> = {
        new: 'Nuevo',
        oem: 'OEM',
        refurbished: 'Reacondicionado',
        used: 'Usado',
    }
    return map[condition] ?? condition
}

export function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}
