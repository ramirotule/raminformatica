import { supabase } from '@/lib/supabase'
import CategoriasClient from './CategoriasClient'

export const dynamic = 'force-dynamic'

export default async function CategoriasPage() {
    const { data: categories } = await supabase
        .from('categories')
        .select('*')
        .order('name')

    return <CategoriasClient categories={categories ?? []} />
}
