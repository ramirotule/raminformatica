'use client'

import { SearchableSelect } from '@/components/SearchableSelect'
import { 
    Smartphone, 
    Headphones, 
    Gamepad2, 
    Watch, 
    Tablet, 
    Laptop, 
    Tv, 
    Speaker, 
    Package,
    LayoutGrid,
    Search
} from 'lucide-react'
import type { Category } from '@/lib/database.types'

interface CategoryHeaderProps {
    categories: Category[];
    selectedCategory: string;
    onCategoryChange: (slug: string) => void;
    searchQuery: string;
    onSearchChange: (q: string) => void;
}

export function CategoryHeader({ 
    categories, 
    selectedCategory, 
    onCategoryChange,
    searchQuery,
    onSearchChange
}: CategoryHeaderProps) {
    
    const iconMap: Record<string, any> = {
        'celulares-iphone': Smartphone,
        'celulares-samsung': Smartphone,
        'celulares-motorola': Smartphone,
        'celulares-infinix': Smartphone,
        'celulares-xiaomi': Smartphone,
        'jbl-parlantes-auriculares': Speaker,
        'video-juegos': Gamepad2,
        'airpods': Headphones,
        'apple-watch': Watch,
        'ipad': Tablet,
        'macbook': Laptop,
        'televisores': Tv,
    }

    const categoryOptions = [
        { value: '', label: 'Todas las categorías', icon: <LayoutGrid size={18} /> },
        ...categories.map(cat => {
            const IconComp = iconMap[cat.slug] || Package
            let iconNode = <IconComp size={18} />
            
            if (cat.icon_url) {
                if (cat.icon_url.startsWith('http')) {
                    iconNode = <img src={cat.icon_url} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
                } else {
                    iconNode = <span style={{ fontSize: '1.1rem' }}>{cat.icon_url}</span>
                }
            }

            return {
                value: cat.slug,
                label: cat.name,
                icon: iconNode
            }
        })
    ]

    return (
        <div style={{ marginBottom: 32 }}>
            <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 20, 
                maxWidth: 800, 
                margin: '0 auto' 
            }}>
                {/* Categoría Selector */}
                <div style={{ flex: 1 }}>
                    <label style={{ 
                        display: 'block', 
                        fontSize: '0.85rem', 
                        fontWeight: 600, 
                        color: 'var(--text-muted)',
                        marginBottom: 8,
                        textAlign: 'center'
                    }}>
                        ¿Qué estás buscando?
                    </label>
                    <SearchableSelect
                        value={selectedCategory}
                        onChange={onCategoryChange}
                        options={categoryOptions}
                        placeholder="Elegí una categoría..."
                        style={{ 
                            height: 60, 
                            borderRadius: 16,
                            fontSize: '1.1rem',
                            boxShadow: 'var(--shadow-md)'
                        }}
                    />
                </div>

                {/* Búsqueda rápida */}
                <div style={{ position: 'relative' }}>
                    <Search 
                        size={18} 
                        style={{ 
                            position: 'absolute', 
                            left: 16, 
                            top: '50%', 
                            transform: 'translateY(-50%)',
                            color: 'var(--text-muted)'
                        }} 
                    />
                    <input
                        type="text"
                        placeholder="Buscar modelo, marca o característica..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        style={{
                            width: '100%',
                            height: 50,
                            padding: '0 16px 0 48px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            borderRadius: 12,
                            fontSize: '1rem',
                            outline: 'none',
                            transition: 'border-color 0.2s',
                            color: 'var(--text-primary)'
                        }}
                    />
                </div>
            </div>
        </div>
    )
}
