export const SHIPPING_COST_USD = 25;
export const PROFIT_MARGIN_FACTOR = 0.9;

export function round5(value: number) {
    return Math.ceil(value / 5) * 5;
}

export function calculateSellingPrice(cost: number) {
    if (!cost || isNaN(cost)) return 0;
    const calculated = (cost / PROFIT_MARGIN_FACTOR) + SHIPPING_COST_USD;
    return round5(calculated);
}
