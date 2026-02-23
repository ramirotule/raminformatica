"use server";

import { createClient } from "@supabase/supabase-js";

// Creamos un cliente que intente usar la clave de SERVICE ROLE si existe
// para poder sobrepasar RLS en modo admin desde un Server Action.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export async function updatePricesFromJson(jsonText: string) {
    try {
        const data = JSON.parse(jsonText);
        const productos = data.productos;

        if (!Array.isArray(productos)) {
            return { success: false, message: "El JSON debe contener un arreglo de 'productos'" };
        }

        let updatedCount = 0;
        const errors: string[] = [];

        for (const item of productos) {
            if (!item.nombre || item.precio === undefined) continue;

            // Buscar el producto por nombre exacto (ignorando mayúsculas/minúsculas)
            const { data: product, error: findError } = await supabaseAdmin
                .from("products")
                .select("id, product_variants(id)")
                .ilike("name", item.nombre)
                .maybeSingle();

            if (findError) {
                errors.push(`Error al buscar ${item.nombre}: ${findError.message}`);
                continue;
            }

            if (!product || !product.product_variants || product.product_variants.length === 0) {
                errors.push(`No se encontró el producto o variante en BD para: ${item.nombre}`);
                continue;
            }

            // Tomamos la primera variante
            const variantId = (product.product_variants[0] as any).id;

            // Actualizar el precio (solo aseguramos USD por ahora)
            const { error: updateError } = await ( (supabaseAdmin as any).from("prices") as any)
                .update({ amount: item.precio, updated_at: new Date().toISOString() })
                .eq("variant_id", variantId)
                .eq("currency", "USD");

            if (updateError) {
                errors.push(`No se pudo actualizar el precio de ${item.nombre}: ${updateError.message}`);
            } else {
                updatedCount++;
            }
        }

        return {
            success: true,
            message: `Se actualizaron correctamente ${updatedCount} productos en la base de datos.`,
            errors,
        };
    } catch (err: any) {
        return { success: false, message: `Error analizando el JSON: ${err.message}` };
    }
}
