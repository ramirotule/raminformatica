import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '/Users/ramirotule/Documents/1.Proyectos/Personales/raminformatica/app/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function check() {
  const { data: categories, error: errorCat } = await supabase.from('categories').select('name, slug')
  const { data: brands, error: errorBrands } = await supabase.from('brands').select('name, slug')
  
  console.log('Categories:', categories)
  console.log('Brands:', brands)
}

check()
