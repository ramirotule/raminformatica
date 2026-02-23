'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

interface CartItem {
    id: string
    name: string
    priceUSD: number
    quantity: number
    image?: string
    variantId: string
}

interface CartContextType {
    cart: CartItem[]
    addToCart: (item: CartItem) => void
    removeFromCart: (variantId: string) => void
    updateQuantity: (variantId: string, quantity: number) => void
    clearCart: () => void
    totalItems: number
    isDrawerOpen: boolean
    setDrawerOpen: (open: boolean) => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [cart, setCart] = useState<CartItem[]>([])

    // Load from localStorage
    useEffect(() => {
        const savedCart = localStorage.getItem('ram_cart')
        if (savedCart) {
            try {
                setCart(JSON.parse(savedCart))
            } catch (e) {
                console.error('Error loading cart', e)
            }
        }
    }, [])

    // Save to localStorage
    useEffect(() => {
        localStorage.setItem('ram_cart', JSON.stringify(cart))
    }, [cart])

    const [isDrawerOpen, setDrawerOpen] = useState(false)

    const addToCart = (newItem: CartItem) => {
        setCart((prev) => {
            const existing = prev.find((item) => item.variantId === newItem.variantId)
            if (existing) {
                return prev.map((item) =>
                    item.variantId === newItem.variantId
                        ? { ...item, quantity: item.quantity + newItem.quantity }
                        : item
                )
            }
            return [...prev, newItem]
        })
    }

    const removeFromCart = (variantId: string) => {
        setCart((prev) => prev.filter((item) => item.variantId !== variantId))
    }

    const updateQuantity = (variantId: string, quantity: number) => {
        if (quantity <= 0) {
            removeFromCart(variantId)
            return
        }
        setCart((prev) =>
            prev.map((item) =>
                item.variantId === variantId ? { ...item, quantity } : item
            )
        )
    }

    const clearCart = () => setCart([])

    const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0)

    return (
        <CartContext.Provider
            value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, isDrawerOpen, setDrawerOpen }}
        >
            {children}
        </CartContext.Provider>
    )
}

export function useCart() {
    const context = useContext(CartContext)
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider')
    }
    return context
}
