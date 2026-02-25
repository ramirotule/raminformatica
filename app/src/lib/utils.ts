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

const ACRONYMS = ['SSD', 'RAM', 'USB', 'RGB', 'LED', 'GB', 'TB', 'MB', 'HD', 'FHD', 'UHD', 'QHD', '4K', 'WIFI', 'BT', 'PC', 'CPU', 'GPU', 'SATA', 'NVME', 'DDR', 'VGA', 'HDMI', 'DP', 'OLED', 'IPS', 'VA', 'HZ', 'MHZ', 'TDP', 'ARGB', 'VRAM'];

export function smartCapitalize(str: string): string {
    if (!str) return str;

    const smallWords = ['de', 'con', 'para', 'y', 'a', 'en', 'o', 'la', 'el'];

    return str.toLowerCase().split(' ').map((word, index) => {
        const upper = word.toUpperCase();

        // Always capitalize first word fully if it's an acronym, OR just first letter
        if (index === 0) {
            if (ACRONYMS.includes(upper)) return upper;
            // Check for numbers + unit (e.g. 64GB, 1TB)
            if (/^\d+(GB|TB|MB|SSD|RAM|HZ|MHZ|DDR|GBPS)$/i.test(word)) return upper;
            return word.charAt(0).toUpperCase() + word.slice(1);
        }

        // Small words in lowercase (unless they are acronyms)
        if (smallWords.includes(word) && !ACRONYMS.includes(upper)) return word;

        // Known acronyms to keep in uppercase
        if (ACRONYMS.includes(upper)) return upper;

        // Handle alphanumeric units (e.g. 64gb -> 64GB, 3200mhz -> 3200MHz/3200MHZ)
        // For simplicity, we'll uppercase the whole alphanumeric block if it ends in a known unit
        if (/^\d+(GB|TB|MB|SSD|RAM|HZ|MHZ|DDR|GBPS)$/i.test(word)) {
            return upper;
        }

        // Normal capitalization
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}
