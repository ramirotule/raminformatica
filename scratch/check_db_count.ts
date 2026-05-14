import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '/Users/ramirotule/Documents/1.Proyectos/Personales/raminformatica/app/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function check() {
  const { count, error } = await supabase.from('products').select('*', { count: 'exact', head: true })
  const { data: recent, error: errorRecent } = await supabase.from('products').select('name, created_at').order('created_at', { ascending: false }).limit(5)
  
  console.log('Total products:', count)
  console.log('Recent products:', recent)
}

check()
