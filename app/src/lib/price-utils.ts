import { getPriceUSD } from './utils'
import type { ProductWithDetails } from './database.types'

export interface PriceBracket {
    min: number;
    max: number;
    label: string;
}

export function calculatePriceRanges(products: ProductWithDetails[]): PriceBracket[] {
    if (!products.length) return []

    const prices = products
        .map(p => getPriceUSD(p.product_variants?.[0]?.prices, p.price_usd))
        .filter((price): price is number => price !== null && price !== undefined)

    if (!prices.length) return []

    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)

    // Predefined logic for brackets
    if (maxPrice <= 100) {
        return [
            { min: 0, max: 50, label: 'Hasta $50' },
            { min: 50, max: 100, label: '$50 a $100' }
        ]
    }

    const ranges: PriceBracket[] = []
    
    // Logic: Under 100, 100-500, 500-1000, 1000-2000, 2000+
    const thresholds = [100, 500, 1000, 2000, 5000]
    
    let currentMin = 0
    for (const t of thresholds) {
        if (minPrice < t) {
            ranges.push({ 
                min: currentMin, 
                max: t, 
                label: currentMin === 0 ? `Hasta $${t}` : `$${currentMin} a $${t}` 
            })
            currentMin = t
        }
        if (maxPrice <= t) break
    }

    if (maxPrice > currentMin) {
        ranges.push({ min: currentMin, max: Infinity, label: `Más de $${currentMin}` })
    }

    return ranges
}
