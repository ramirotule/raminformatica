'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

interface SearchContextType {
    searchQuery: string
    setSearchQuery: (query: string) => void
    showFilters: boolean
    setShowFilters: (show: boolean) => void
    sortBy: string
    setSortBy: (sort: any) => void
    resetSearch: () => void
}

const SearchContext = createContext<SearchContextType | undefined>(undefined)

export function SearchProvider({ children }: { children: ReactNode }) {
    const [searchQuery, setSearchQuery] = useState('')
    const [showFilters, setShowFilters] = useState(false)
    const [sortBy, setSortBy] = useState('reciente')

    const resetSearch = () => {
        setSearchQuery('')
        setShowFilters(false)
        setSortBy('reciente')
    }

    return (
        <SearchContext.Provider value={{
            searchQuery,
            setSearchQuery,
            showFilters,
            setShowFilters,
            sortBy,
            setSortBy,
            resetSearch
        }}>
            {children}
        </SearchContext.Provider>
    )
}

export function useSearch() {
    const context = useContext(SearchContext)
    if (context === undefined) {
        throw new Error('useSearch must be used within a SearchProvider')
    }
    return context
}
