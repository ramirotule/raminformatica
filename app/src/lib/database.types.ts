export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            categories: {
                Row: Category
                Insert: Omit<Category, 'id' | 'created_at'>
                Update: Partial<Omit<Category, 'id' | 'created_at'>>
            }
            brands: {
                Row: Brand
                Insert: Omit<Brand, 'id' | 'created_at'>
                Update: Partial<Omit<Brand, 'id' | 'created_at'>>
            }
            products: {
                Row: Product
                Insert: Omit<Product, 'id' | 'created_at'>
                Update: Partial<Omit<Product, 'id' | 'created_at'>>
            }
            product_images: {
                Row: ProductImage
                Insert: Omit<ProductImage, 'id' | 'created_at'>
                Update: Partial<Omit<ProductImage, 'id' | 'created_at'>>
            }
            product_variants: {
                Row: ProductVariant
                Insert: Omit<ProductVariant, 'id' | 'created_at'>
                Update: Partial<Omit<ProductVariant, 'id' | 'created_at'>>
            }
            prices: {
                Row: Price
                Insert: Omit<Price, 'id' | 'created_at'>
                Update: Partial<Omit<Price, 'id' | 'created_at'>>
            }
            inventory: {
                Row: Inventory
                Insert: Omit<Inventory, 'id' | 'created_at'>
                Update: Partial<Omit<Inventory, 'id' | 'created_at'>>
            }
            home_slides: {
                Row: HomeSlide
                Insert: Omit<HomeSlide, 'id' | 'created_at'>
                Update: Partial<Omit<HomeSlide, 'id' | 'created_at'>>
            }
            brand_logos: {
                Row: BrandLogo
                Insert: Omit<BrandLogo, 'id' | 'created_at'>
                Update: Partial<Omit<BrandLogo, 'id' | 'created_at'>>
            }
        }
    }
}

export interface Category {
    id: string
    name: string
    slug: string
    description: string | null
    icon_url: string | null
    created_at: string
}

export interface Brand {
    id: string
    name: string
    slug: string
    description: string | null
    logo_url: string | null
    created_at: string
}

export interface Product {
    id: string
    name: string
    slug: string
    short_description: string | null
    long_description: string | null
    condition: string | null
    brand_id: string | null
    category_id: string | null
    tags: string[] | null
    is_featured: boolean
    active: boolean
    created_at: string
}

export interface ProductImage {
    id: string
    product_id: string
    storage_path: string
    public_url: string
    alt: string | null
    sort_order: number | null
    is_primary: boolean
    created_at: string
}

export interface ProductVariant {
    id: string
    product_id: string
    sku: string | null
    name: string | null
    options: Json | null
    color?: string | null
    storage?: string | null
    connectivity?: string | null
    created_at: string
    prices?: Price[]
}

export interface Price {
    id: string
    variant_id: string
    currency: string
    amount: number
    original_amount: number | null
    created_at: string
}

export interface Inventory {
    id: string
    variant_id: string
    qty_available: number
    qty_reserved: number
    low_stock_threshold: number
    created_at: string
    product_variants?: ProductVariant
}

export interface ProductWithDetails extends Product {
    categories?: Category
    brands?: Brand
    product_images?: ProductImage[]
    product_variants?: (ProductVariant & {
        prices: Price[]
        inventory: Inventory[]
    })[]
}

export interface DolarBlue {
    id: string
    compra: number
    venta: number
    fecha: string
}

export interface HomeSlide {
    id: string
    title: string | null
    subtitle: string | null
    image_url: string
    storage_path: string | null
    product_id: string | null
    link_url: string | null
    sort_order: number
    active: boolean
    created_at: string
    products?: Product
}

export interface BrandLogo {
    id: string
    name: string
    logo_url: string
    storage_path: string | null
    sort_order: number
    active: boolean
    created_at: string
}
