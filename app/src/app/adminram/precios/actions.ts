"use server";

import { createClient } from "@supabase/supabase-js";
import { slugify } from "@/lib/utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

import { calculateSellingPrice } from "@/lib/constants";

export interface ParsedItem {
    name: string;
    cost: number;
    finalPrice: number;
    matchId?: string;
    matchName?: string;
    status: 'pending' | 'matched' | 'new';
}

function calculateFinalPrice(cost: number) {
    return calculateSellingPrice(cost);
}

/**
 * Parsea el texto o JSON y devuelve una lista de Items para previsualizar.
 */
export async function parseImportData(input: string, provider: 'gcgroup' | 'zentek') {
    const items: ParsedItem[] = [];

    try {
        if (provider === 'gcgroup') {
            const data = JSON.parse(input);
            const productos = Array.isArray(data.productos) ? data.productos : [];
            for (const p of productos) {
                if (!p.nombre || p.precio === undefined) continue;
                items.push({
                    name: p.nombre,
                    cost: p.precio_costo || p.precio,
                    finalPrice: p.precio, // En JSON de GCgroup el precio ya suele ser el final o se toma tal cual
                    status: 'pending'
                });
            }
        } else {
            const lines = input.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.length < 5) continue;

                const priceRegex = /[\$]?\s?(\d+[\.\,]?\d*)/g;
                const matches = [...trimmed.matchAll(priceRegex)];

                if (matches.length > 0) {
                    const lastMatch = matches[matches.length - 1];
                    const priceStr = lastMatch[1].replace(',', '.');
                    const cost = parseFloat(priceStr);

                    if (isNaN(cost) || cost < 10) continue;

                    let name = trimmed.substring(0, lastMatch.index).trim();
                    if (name.length < 3) continue;
                    name = name.replace(/^[\d\.\-\)\>]+\s?/, '');

                    items.push({
                        name,
                        cost,
                        finalPrice: calculateFinalPrice(cost),
                        status: 'pending'
                    });
                }
            }
        }

        return { success: true, items, message: "Datos parseados correctamente." };
    } catch (err: any) {
        return { success: false, message: `Error al parsear: ${err.message}`, items: [] };
    }
}

/**
 * Busca coincidencias para una lista de nombres de productos.
 */
export async function searchMatches(items: ParsedItem[]) {
    const results: ParsedItem[] = [];

    for (const item of items) {
        // Buscamos por palabras clave (primera palabra y coincidencia parcial)
        const firstWord = item.name.split(' ')[0].replace(/[^\w]/g, '');

        const { data: dbProducts } = await supabaseAdmin
            .from("products")
            .select("id, name")
            .ilike("name", `%${firstWord}%`)
            .limit(5);

        let match: any = null;
        if (dbProducts && dbProducts.length > 0) {
            // Buscamos exacto o el que más se parezca
            match = dbProducts.find(p =>
                p.name.toLowerCase() === item.name.toLowerCase() ||
                p.name.toLowerCase().includes(item.name.toLowerCase()) ||
                item.name.toLowerCase().includes(p.name.toLowerCase())
            );
        }

        results.push({
            ...item,
            matchId: match?.id,
            matchName: match?.name,
            status: match ? 'matched' : 'new'
        });
    }

    return { success: true, items: results, message: "Búsqueda de coincidencias finalizada." };
}

/**
 * Procesa la importación final (crea o actualiza).
 */
export async function processSync(items: ParsedItem[], providerId?: string) {
    let updated = 0;
    let created = 0;
    const errors: string[] = [];

    // Necesitamos una categoría y marca por defecto para nuevos productos si no existen
    const DEFAULT_CAT_NAME = "Sin Asignar";
    const DEFAULT_BRAND_NAME = "Sin Asignar";

    let { data: defCat } = await supabaseAdmin.from('categories').select('id').eq('name', DEFAULT_CAT_NAME).maybeSingle();
    if (!defCat) {
        const { data: newCat } = await supabaseAdmin.from('categories').insert({ name: DEFAULT_CAT_NAME, slug: 'sin-asignar' }).select().single();
        defCat = newCat;
    }

    let { data: defBrand } = await supabaseAdmin.from('brands').select('id').eq('name', DEFAULT_BRAND_NAME).maybeSingle();
    if (!defBrand) {
        const { data: newBrand } = await supabaseAdmin.from('brands').insert({ name: DEFAULT_BRAND_NAME, slug: 'sin-asignar' }).select().single();
        defBrand = newBrand;
    }

    for (const item of items) {
        try {
            if (item.status === 'matched' && item.matchId) {
                // ACTUALIZAR PRECIO
                const { data: variants } = await supabaseAdmin
                    .from('product_variants')
                    .select('id')
                    .eq('product_id', item.matchId);

                if (variants && variants.length > 0) {
                    for (const v of variants) {
                        await ((supabaseAdmin as any).from('prices') as any)
                            .upsert({
                                variant_id: v.id,
                                currency: 'USD',
                                amount: item.finalPrice,
                                updated_at: new Date().toISOString()
                            }, { onConflict: 'variant_id,currency' });
                    }

                    // También actualizar el proveedor en el producto si se proporcionó
                    if (providerId) {
                        await (supabaseAdmin as any).from('products').update({ provider_id: providerId }).eq('id', item.matchId);
                    }

                    updated++;
                } else {
                    errors.push(`Producto ${item.name} encontrado pero sin variantes.`);
                }
            } else if (item.status === 'new') {
                // CREAR NUEVO PRODUCTO
                const slugCandidate = slugify(item.name);

                const { data: newProd, error: prodErr } = await supabaseAdmin
                    .from('products')
                    .insert({
                        name: item.name,
                        slug: slugCandidate,
                        category_id: defCat?.id,
                        brand_id: defBrand?.id,
                        provider_id: providerId || null,
                        active: true
                    }).select().single();

                if (prodErr) throw prodErr;

                // Crear variante base
                const { data: variant, error: varErr } = await supabaseAdmin
                    .from('product_variants')
                    .insert({
                        product_id: (newProd as any).id,
                        active: true
                    }).select().single();

                if (varErr) throw varErr;

                // Crear precio
                await ((supabaseAdmin as any).from('prices') as any).insert({
                    variant_id: (variant as any).id,
                    currency: 'USD',
                    amount: item.finalPrice
                });

                // Crear inventario base (0)
                await supabaseAdmin.from('inventory').insert({
                    variant_id: (variant as any).id,
                    qty_available: 0
                });

                created++;
            }
        } catch (e: any) {
            errors.push(`Error con ${item.name}: ${e.message}`);
        }
    }

    return {
        success: true,
        message: `Sincronización finalizada. Actualizados: ${updated}, Creados: ${created}.`,
        errors
    };
}

// Retrocompatibilidad (opcional, para no romper si alguien llama las viejas)
export async function updatePricesFromJson(jsonText: string) {
    const { items } = await parseImportData(jsonText, 'gcgroup');
    const { items: matched } = await searchMatches(items);
    return processSync(matched);
}

export async function updatePricesFromRawText(rawText: string, provider: string) {
    const { items } = await parseImportData(rawText, provider as any);
    const { items: matched } = await searchMatches(items);
    return processSync(matched);
}
