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
            <section className="section" style={{ marginTop: -60 }}>
                <div className="container">
                    <div style={{ marginBottom: 48, textAlign: 'center' }}>
                        <h1 className="hero-title" style={{ fontSize: '3rem', marginBottom: 16 }}>
                            <span>{dict.categorias.titulo}</span>
                        </h1>
                        <p className="hero-desc" style={{ maxWidth: 600, marginInline: 'auto' }}>
                            Explorá nuestra amplia variedad de productos tecnológicos organizados por categorías.
                        </p>
                    </div>

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
