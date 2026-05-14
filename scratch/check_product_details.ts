import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '/Users/ramirotule/Documents/1.Proyectos/Personales/raminformatica/app/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function check() {
  const { data: recent, error } = await supabase.from('products').select('*, brands(*), categories(*)').order('created_at', { ascending: false }).limit(1)
  console.log(JSON.stringify(recent, null, 2))
}

check()
