import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Middleware para redirigir URLs legacy de productos.
 *
 * Patrón legacy:  /productos/:slug          (un solo segmento → ruta vieja)
 * Patrón nuevo:   /productos/:categoria/:slug
 *
 * El middleware detecta si la URL tiene exactamente un segmento bajo /productos/,
 * consulta la categoría del producto en Supabase y redirige con 301.
 */
export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Solo actúa sobre /productos/*
    if (!pathname.startsWith('/productos/')) {
        return NextResponse.next()
    }

    // Cuenta los segmentos después de /productos/
    const afterProductos = pathname.replace(/^\/productos\//, '')
    const segments = afterProductos.split('/').filter(Boolean)

    // Si hay exactamente 1 segmento → URL legacy → buscar categoría y redirigir
    if (segments.length === 1) {
        const slug = segments[0]

        try {
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/products?select=slug,categories(slug)&slug=eq.${slug}&limit=1`,
                {
                    headers: {
                        apikey: SUPABASE_ANON_KEY,
                        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                    },
                    // Edge runtime requiere cache: 'no-store' para no cachear redirecciones
                    cache: 'no-store',
                }
            )

            if (res.ok) {
                const data = await res.json() as Array<{ slug: string; categories?: { slug?: string } | null }>
                const product = data[0]

                if (product) {
                    const categorySlug = (product.categories as any)?.slug || 'sin-categoria'
                    const redirectUrl = new URL(`/productos/${categorySlug}/${slug}`, request.url)
                    return NextResponse.redirect(redirectUrl, { status: 301 })
                }
            }
        } catch {
            // Si falla el lookup, dejamos pasar (404 natural)
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: '/productos/:path*',
}
