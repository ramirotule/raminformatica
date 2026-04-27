/**
 * Genera la URL canónica de un producto.
 * Formato: /productos/:categoriaSlug/:productoSlug
 *
 * @param productSlug - el slug único del producto
 * @param categorySlug - el slug de la categoría (puede venir del join categories)
 */
export function productUrl(productSlug: string, categorySlug?: string | null): string {
    const cat = categorySlug?.trim() || 'sin-categoria'
    return `/productos/${cat}/${productSlug}`
}
