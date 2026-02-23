import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Para el Panel de Admin, lo ideal es usar la SERVICE ROLE KEY para evadir el RLS,
// pero si no está disponible o el RLS no está activo aún en tu tabla de `prices`, usamos la ANON_KEY
const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
