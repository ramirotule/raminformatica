import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/adminram/', '/api/'],
        },
        sitemap: 'https://raminformatica.com.ar/sitemap.xml',
    }
}
