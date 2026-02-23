'use client'

import React from 'react'
import Link from 'next/link'
import { dict } from '@/lib/dict'
import type { Category } from '@/lib/database.types'

interface CategoriasClientProps {
    categories: Category[]
}

export default function CategoriasClient({ categories }: CategoriasClientProps) {
    return (
        <main className="page">
            <section className="hero" style={{ minHeight: '30vh' }}>
                <div className="container hero-content" style={{ marginTop: '160px' }}>
                    <h1 className="hero-title">
                        <span>{dict.categorias.titulo}</span>
                    </h1>
                    <p className="hero-desc">
                        Explorá nuestra amplia variedad de productos tecnológicos organizados por categorías.
                    </p>
                </div>
            </section>

            <section className="section">
                <div className="container">

                    <div className="cat-grid">
                        {categories.map((cat) => (
                            <Link
                                key={cat.id}
                                href={`/productos?categoria=${cat.slug}`}
                                className="cat-card"
                            >
                                <span className="cat-emoji" role="img" aria-label={cat.name}>
                                    {cat.icon_url && cat.icon_url.startsWith('http') ? (
                                        <img
                                            src={cat.icon_url}
                                            alt={cat.name}
                                            style={{ width: 64, height: 64, objectFit: 'contain' }}
                                        />
                                    ) : (
                                        cat.icon_url || '📁'
                                    )}
                                </span>
                                <span className="cat-name" style={{ fontSize: '1rem', marginTop: 8 }}>
                                    {cat.name}
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>
        </main>
    )
}
