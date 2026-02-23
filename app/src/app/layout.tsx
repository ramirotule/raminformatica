import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { dict } from '@/lib/dict'
import LayoutShell from '@/components/LayoutShell'

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: {
    default: `${dict.marca.nombre} — ${dict.marca.tagline}`,
    template: `%s | ${dict.marca.nombre}`,
  },
  description: dict.marca.descripcion,
  keywords: ['tecnología', 'celulares', 'iPhone', 'Samsung', 'notebooks', 'gaming', 'Argentina'],
  openGraph: {
    title: dict.marca.nombre,
    description: dict.marca.descripcion,
    type: 'website',
    locale: 'es_AR',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={inter.variable}>
      <body style={{ fontFamily: 'var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif' }}>
        <LayoutShell>
          {children}
        </LayoutShell>
      </body>
    </html>
  )
}
