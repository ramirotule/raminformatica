import type { Metadata } from 'next'
import { Inter, Outfit } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { dict } from '@/lib/dict'
import LayoutShell from '@/components/LayoutShell'
import AnalyticsInit from '@/components/AnalyticsInit'

const GA_ID = 'G-SL953TM4S3'

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-inter',
})

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-outfit',
})

export const metadata: Metadata = {
  title: {
    default: `${dict.marca.nombre} — ${dict.marca.tagline}`,
    template: `%s | ${dict.marca.nombre}`,
  },
  description: dict.marca.descripcion,
  keywords: ['RAM Informática', 'Santa Rosa', 'La Pampa', 'tecnología', 'celulares', 'iPhone', 'PlayStation', 'PS5', 'Samsung', 'Motorola', 'notebooks', 'gaming', 'Argentina'],
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: dict.marca.nombre,
    description: dict.marca.descripcion,
    type: 'website',
    locale: 'es_AR',
  },
  verification: {
    google: 'I1RxZWpJ4BxyENDEw98DQALpk3bGEl3u9oWkAqwrpQU',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "ElectronicsStore",
    "name": "RAM Informática",
    "image": "https://raminformatica.com.ar/logo.png",
    "@id": "https://raminformatica.com.ar",
    "url": "https://raminformatica.com.ar",
    "telephone": "+54929542276225",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Lebenson 3980",
      "addressLocality": "Santa Rosa",
      "addressRegion": "La Pampa",
      "postalCode": "6300",
      "addressCountry": "AR"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": -36.6425277,
      "longitude": -64.3294774
    },
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": [
          "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"
        ],
        "opens": "09:00",
        "closes": "17:00"
      },
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": "Saturday",
        "opens": "10:00",
        "closes": "13:00"
      }
    ],
    "sameAs": [
      "https://www.facebook.com/ram.informatica",
      "https://www.instagram.com/ram.informatica"
    ]
  };

  return (
    <html lang="es" className={`${inter.variable} ${outfit.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
      </head>
      <body style={{ fontFamily: 'var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif' }}>
        {/* Google Analytics 4 */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}', {
              allow_google_signals: true,
              allow_ad_personalization_signals: true
            });
          `}
        </Script>
        <AnalyticsInit />
        <LayoutShell>
          {children}
        </LayoutShell>
      </body>
    </html>
  )
}

