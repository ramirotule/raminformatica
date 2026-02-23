'use client'

import { usePathname } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { CartProvider } from '@/context/CartContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { DolarProvider } from '@/context/DolarContext'
import { SearchProvider } from '@/context/SearchContext'

export default function LayoutShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const isAdmin = pathname.startsWith('/adminram')

    // En rutas de admin: sin Header, sin footer, sin padding de .page
    if (isAdmin) {
        return <>{children}</>
    }
    const isHome = pathname === '/'
    const isCategorias = pathname === '/categorias'

    // Padding-top por ruta
    const pageStyle = isCategorias
        ? { paddingTop: 100 }
        : undefined

    return (
        <>
            <ThemeProvider>
                <DolarProvider>
                    <SearchProvider>
                        <CartProvider>
                            <Header />
                            {isHome ? (
                                <main>{children}</main>
                            ) : (
                                <main className="page" style={pageStyle}>{children}</main>
                            )}
                        </CartProvider>
                    </SearchProvider>
                </DolarProvider>
                <Footer />
            </ThemeProvider>
        </>
    )
}
