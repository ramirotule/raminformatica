/**
 * analytics.ts — Eventos GA4 para RAM Informática
 *
 * Todos los eventos siguen la nomenclatura estándar de Google Analytics 4
 * para e-commerce, más eventos custom propios del negocio.
 */

export const GA_ID = 'G-SL953TM4S3'

declare global {
    interface Window {
        gtag?: (...args: any[]) => void
    }
}

function gtag(...args: any[]) {
    if (typeof window !== 'undefined' && window.gtag) {
        window.gtag(...args)
        if (process.env.NODE_ENV === 'development') {
            const [cmd, eventName, params] = args
            if (cmd === 'event') {
                console.log(`[GA4] ${eventName}`, params ?? '')
            }
        }
    }
}

// ─── ECOMMERCE ESTÁNDAR ───────────────────────────────────────────────────────

/** Producto abierto (página de detalle) */
export function trackViewItem(product: {
    id: string
    name: string
    category?: string
    brand?: string
    price?: number
}) {
    gtag('event', 'view_item', {
        currency: 'USD',
        value: product.price,
        items: [{
            item_id: product.id,
            item_name: product.name,
            item_category: product.category,
            item_brand: product.brand,
            price: product.price,
            quantity: 1,
        }],
    })
}

/** Producto agregado al carrito */
export function trackAddToCart(product: {
    id: string
    name: string
    category?: string
    brand?: string
    price?: number
    quantity?: number
}) {
    gtag('event', 'add_to_cart', {
        currency: 'USD',
        value: (product.price ?? 0) * (product.quantity ?? 1),
        items: [{
            item_id: product.id,
            item_name: product.name,
            item_category: product.category,
            item_brand: product.brand,
            price: product.price,
            quantity: product.quantity ?? 1,
        }],
    })
}

/** Click en producto desde el listado */
export function trackSelectItem(product: {
    id: string
    name: string
    category?: string
    brand?: string
    price?: number
    index?: number
}) {
    gtag('event', 'select_item', {
        item_list_name: product.category ?? 'Listado general',
        items: [{
            item_id: product.id,
            item_name: product.name,
            item_category: product.category,
            item_brand: product.brand,
            price: product.price,
            index: product.index ?? 0,
        }],
    })
}

/** Vista de listado de productos */
export function trackViewItemList(items: {
    id: string
    name: string
    category?: string
    brand?: string
    price?: number
}[], listName?: string) {
    gtag('event', 'view_item_list', {
        item_list_name: listName ?? 'Catálogo',
        items: items.map((p, i) => ({
            item_id: p.id,
            item_name: p.name,
            item_category: p.category,
            item_brand: p.brand,
            price: p.price,
            index: i,
        })),
    })
}

// ─── EVENTOS CUSTOM RAM INFORMÁTICA ──────────────────────────────────────────

/**
 * Click en botón de WhatsApp
 * @param source — desde dónde se clickeó (ej: 'producto', 'footer', 'promo_modal')
 */
export function trackWhatsappClick(source: 'producto' | 'footer' | 'promo_modal', productName?: string) {
    gtag('event', 'whatsapp_click', {
        event_category: 'contacto',
        event_label: source,
        product_name: productName,
    })
}

/** Búsqueda de producto */
export function trackSearch(searchTerm: string) {
    gtag('event', 'search', {
        search_term: searchTerm,
    })
}

/** Filtro aplicado en el catálogo */
export function trackFilterApply(filterType: 'categoria' | 'marca' | 'condicion' | 'orden', value: string) {
    gtag('event', 'filter_apply', {
        event_category: 'catalogo',
        filter_type: filterType,
        filter_value: value,
    })
}

/** Inicio de checkout (click en "Confirmar pedido" o flujo final) */
export function trackBeginCheckout(items: {
    id: string
    name: string
    price?: number
    quantity?: number
}[], totalValue: number) {
    gtag('event', 'begin_checkout', {
        currency: 'USD',
        value: totalValue,
        items: items.map(p => ({
            item_id: p.id,
            item_name: p.name,
            price: p.price,
            quantity: p.quantity ?? 1,
        })),
    })
}
