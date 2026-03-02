"use server";

import { createClient } from "@supabase/supabase-js";
import { slugify, smartCapitalize } from "@/lib/utils";

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
    status: 'pending' | 'matched' | 'new' | 'deactivate';
    similarity?: number;
    currentPrice?: number;
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
                    name: smartCapitalize(p.nombre),
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
                        name: smartCapitalize(name),
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
 * Algoritmo Jaro-Winkler para similitud de strings (0 a 1)
 */
function getSimilarity(s1: string, s2: string): number {
    let m = 0;
    if (s1.length === 0 || s2.length === 0) return 0;
    if (s1 === s2) return 1;

    let range = (Math.floor(Math.max(s1.length, s2.length) / 2)) - 1;
    let s1Matches = new Array(s1.length);
    let s2Matches = new Array(s2.length);

    for (let i = 0; i < s1.length; i++) {
        let low = Math.max(0, i - range);
        let high = Math.min(i + range + 1, s2.length);
        for (let j = low; j < high; j++) {
            if (!s2Matches[j] && s1[i] === s2[j]) {
                s1Matches[i] = true;
                s2Matches[j] = true;
                m++;
                break;
            }
        }
    }

    if (m === 0) return 0;

    let t = 0;
    let k = 0;
    for (let i = 0; i < s1.length; i++) {
        if (s1Matches[i]) {
            while (!s2Matches[k]) k++;
            if (s1[i] !== s2[k]) t++;
            k++;
        }
    }

    let jaro = ((m / s1.length) + (m / s2.length) + ((m - t / 2) / m)) / 3;
    return jaro;
}

/**
 * Busca coincidencias para una lista de nombres de productos usando Fuzzy Matching.
 */
export async function searchMatches(items: ParsedItem[]) {
    const results: ParsedItem[] = [];

    const { data: dbProducts } = await supabaseAdmin
        .from("products")
        .select(`
            id, 
            name,
            product_variants (
                id,
                prices (amount)
            )
        `)
        .eq('active', true);

    if (!dbProducts) return { success: false, message: "No se pudieron cargar los productos de la DB.", items };

    for (const item of items) {
        let bestMatch: any = null;
        let highestScore = 0;

        for (const dbP of dbProducts) {
            const score = getSimilarity(item.name.toLowerCase(), dbP.name.toLowerCase());
            if (score > highestScore) {
                highestScore = score;
                bestMatch = dbP;
            }
        }

        const isMatched = highestScore > 0.70;
        let currentPrice = undefined;
        if (isMatched && bestMatch.product_variants?.[0]?.prices?.[0]) {
            currentPrice = bestMatch.product_variants[0].prices[0].amount;
        }

        results.push({
            ...item,
            matchId: isMatched ? bestMatch.id : undefined,
            matchName: isMatched ? bestMatch.name : undefined,
            similarity: Math.round(highestScore * 100),
            currentPrice,
            status: isMatched ? 'matched' : 'new'
        });
    }

    return { success: true, items: results, message: "Búsqueda de coincidencias inteligente finalizada." };
}

/**
 * Obtiene los productos que se VAN A DESACTIVAR porque no están en la lista
 */
export async function getMissingProducts(matchedIds: string[], providerId: string) {
    if (!providerId) return [];

    // Convertir el Set o Array de IDs a string para el filtro 'in'
    const idsInList = matchedIds.filter(id => !!id);

    let query = supabaseAdmin
        .from('products')
        .select('id, name')
        .eq('provider_id', providerId)
        .eq('active', true);

    if (idsInList.length > 0) {
        query = query.not('id', 'in', `(${idsInList.join(',')})`);
    }

    const { data: missing } = await query;

    return missing?.map(p => ({
        name: p.name,
        cost: 0,
        finalPrice: 0,
        matchId: p.id,
        status: 'deactivate' as const
    })) || [];
}

/**
 * Procesa la importación final (crea, actualiza o desactiva).
 */
export async function processSync(items: ParsedItem[], providerId?: string) {
    let updated = 0;
    let created = 0;
    let deactivated = 0;
    const errors: string[] = [];
    const matchedIds = new Set<string>();

    const DEFAULT_CAT_NAME = "Sin Asignar";
    const DEFAULT_BRAND_NAME = "Sin Asignar";

    // ASEGURAR CATEGORÍA POR DEFECTO
    let { data: defCat } = await supabaseAdmin.from('categories').select('id').eq('name', DEFAULT_CAT_NAME).maybeSingle();
    if (!defCat) {
        const { data: newCat } = await supabaseAdmin.from('categories').insert({ name: DEFAULT_CAT_NAME, slug: 'sin-asignar' }).select().single();
        defCat = newCat;
    }

    // ASEGURAR MARCA POR DEFECTO
    let { data: defBrand } = await supabaseAdmin.from('brands').select('id').eq('name', DEFAULT_BRAND_NAME).maybeSingle();
    if (!defBrand) {
        const { data: newBrand } = await supabaseAdmin.from('brands').insert({ name: DEFAULT_BRAND_NAME, slug: 'sin-asignar' }).select().single();
        defBrand = newBrand;
    }

    for (const item of items) {
        try {
            if (item.status === 'matched' && item.matchId) {
                matchedIds.add(item.matchId);
                const { data: variants } = await supabaseAdmin
                    .from('product_variants')
                    .select('id')
                    .eq('product_id', item.matchId);

                if (variants && variants.length > 0) {
                    // 1. Guardar en provider_costs para el comparador
                    if (providerId) {
                        await supabaseAdmin
                            .from('provider_costs')
                            .upsert({
                                product_id: item.matchId,
                                provider_id: providerId,
                                cost_price: item.cost,
                                updated_at: new Date().toISOString()
                            }, { onConflict: 'product_id,provider_id' });
                    }

                    for (const v of variants) {
                        // Usamos RPC o Upsert directo según la versión de Supabase/PostgREST
                        const { error: priceErr } = await supabaseAdmin
                            .from('prices')
                            .upsert({
                                variant_id: v.id,
                                currency: 'USD',
                                amount: item.finalPrice,
                                updated_at: new Date().toISOString()
                            }, { onConflict: 'variant_id,currency' });

                        if (priceErr) throw priceErr;
                    }
                    if (providerId) {
                        await supabaseAdmin.from('products').update({
                            provider_id: providerId,
                            active: true,
                            cost_price: item.cost
                        }).eq('id', item.matchId);
                    } else {
                        // Si no hay providerId, igualmente actualizamos el costo
                        await supabaseAdmin.from('products').update({
                            cost_price: item.cost
                        }).eq('id', item.matchId);
                    }
                    updated++;
                } else {
                    errors.push(`El producto ${item.name} no tiene variantes para actualizar precio.`);
                }
            } else if (item.status === 'new') {
                const slugCandidate = slugify(item.name) + '-' + Math.random().toString(36).substring(2, 5);
                const { data: newProd, error: prodErr } = await supabaseAdmin
                    .from('products')
                    .insert({
                        name: item.name,
                        slug: slugCandidate,
                        category_id: defCat?.id,
                        brand_id: defBrand?.id,
                        provider_id: providerId || null,
                        cost_price: item.cost,
                        active: true
                    }).select().single();

                if (prodErr) throw prodErr;

                const { data: variant, error: varErr } = await supabaseAdmin
                    .from('product_variants')
                    .insert({ product_id: (newProd as any).id, active: true })
                    .select().single();

                if (varErr) throw varErr;

                await supabaseAdmin.from('prices').insert({
                    variant_id: (variant as any).id,
                    currency: 'USD',
                    amount: item.finalPrice
                });

                await supabaseAdmin.from('inventory').insert({
                    variant_id: (variant as any).id,
                    qty_available: 0
                });

                created++;
            } else if (item.status === 'deactivate' && item.matchId) {
                await supabaseAdmin.from('products').update({ active: false }).eq('id', item.matchId);
                deactivated++;
            }
        } catch (e: any) {
            console.error(`Error procesando ${item.name}:`, e);
            errors.push(`Error con ${item.name}: ${e.message || 'Error desconocido'}`);
        }
    }

    // Doble check de seguridad para desactivación masiva si no se hizo por status explícito
    if (providerId && items.every(item => item.status !== 'deactivate')) {
        const { data: providerProducts } = await supabaseAdmin
            .from('products')
            .select('id')
            .eq('provider_id', providerId)
            .eq('active', true);

        if (providerProducts) {
            for (const p of providerProducts) {
                if (!matchedIds.has(p.id)) {
                    await supabaseAdmin.from('products').update({ active: false }).eq('id', p.id);
                    deactivated++;
                }
            }
        }
    }

    return {
        success: errors.length < items.length, // Si fallaron todos es fracaso total
        message: `Sincronización finalizada. Actualizados: ${updated}, Creados: ${created}, Desactivados: ${deactivated}.`,
        errors: errors.length > 0 ? errors : undefined
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

/**
 * Obtiene todos los productos con sus costos de diferentes proveedores para el comparador.
 */
export async function getComparisonData() {
    try {
        const [pRes, provRes, costsRes] = await Promise.all([
            supabaseAdmin.from('products').select('id, name, cost_price, provider_id').eq('active', true).order('name'),
            supabaseAdmin.from('providers').select('id, name').eq('active', true),
            supabaseAdmin.from('provider_costs').select('*')
        ]);

        if (pRes.error) throw pRes.error;

        return {
            success: true,
            products: pRes.data || [],
            providers: provRes.data || [],
            costs: costsRes.data || []
        };
    } catch (err: any) {
        console.error("Error fetching comparison data:", err);
        return { success: false, message: err.message };
    }
}

/**
 * Aplica el mejor precio (mínimo) a un producto específico.
 */
export async function applyBestPrice(productId: string, bestProviderId: string, bestCost: number) {
    try {
        // 1. Recalcular precio de venta
        const finalPrice = calculateFinalPrice(bestCost);

        // 2. Actualizar producto (costo y proveedor actual)
        const { error: pErr } = await supabaseAdmin.from('products').update({
            cost_price: bestCost,
            provider_id: bestProviderId,
        }).eq('id', productId);

        if (pErr) throw pErr;

        // 3. Actualizar precios de las variantes
        const { data: variants } = await supabaseAdmin.from('product_variants').select('id').eq('product_id', productId);
        if (variants) {
            for (const v of variants) {
                await supabaseAdmin.from('prices').upsert({
                    variant_id: v.id,
                    currency: 'USD',
                    amount: finalPrice,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'variant_id,currency' });
            }
        }

        return { success: true };
    } catch (err: any) {
        console.error("Error applying best price:", err);
        return { success: false, message: err.message };
    }
}

/**
 * Aplica los mejores precios a TODOS los productos que tengan costos de proveedores.
 */
export async function applyAllBestPrices() {
    try {
        const { data: allCosts } = await supabaseAdmin.from('provider_costs').select('*');
        if (!allCosts || allCosts.length === 0) return { success: false, message: "No hay costos guardados para comparar." };

        // Agrupar por producto y encontrar el mínimo
        const bestPrices: Record<string, { provider_id: string, cost: number }> = {};
        for (const c of allCosts) {
            if (!bestPrices[c.product_id] || c.cost_price < bestPrices[c.product_id].cost) {
                bestPrices[c.product_id] = {
                    provider_id: c.provider_id,
                    cost: c.cost_price
                };
            }
        }

        const productIds = Object.keys(bestPrices);
        let updated = 0;

        for (const pid of productIds) {
            const best = bestPrices[pid];
            const res = await applyBestPrice(pid, best.provider_id, best.cost);
            if (res.success) updated++;
        }

        return { success: true, message: `Se actualizaron ${updated} productos con su mejor precio.` };
    } catch (err: any) {
        return { success: false, message: err.message };
    }
}
