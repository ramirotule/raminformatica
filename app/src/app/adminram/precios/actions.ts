"use server";

import { createClient } from "@supabase/supabase-js";
import { slugify, smartCapitalize } from "@/lib/utils";
import { calculateSellingPrice } from "@/lib/constants";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export interface ParsedItem {
    name: string;
    originalDescription: string;
    categoryName?: string;
    cost: number;
    finalPrice: number;
    matchId?: string;
    matchName?: string;
    status: 'pending' | 'matched' | 'new' | 'deactivate';
    similarity?: number;
    currentPrice?: number;
    currentCost?: number;
}

function calculateFinalPrice(cost: number, isGcGroup = false, originalJsonPrice?: number) {
    if (isGcGroup && originalJsonPrice !== undefined) {
        // According to previous UI, GCGroup might take direct price, but to enforce rule:
        // Actually the rule was to enforce (cost / 0.90) + 25 on ALL. Let's just calculate it:
        const exactAllowed = (cost / 0.90) + 25;
        return Math.round(exactAllowed / 5) * 5;
    }
    const exactAllowed = (cost / 0.90) + 25;
    return Math.round(exactAllowed / 5) * 5;
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
                const cost = p.precio_costo || p.precio;
                items.push({
                    name: smartCapitalize(p.nombre),
                    originalDescription: p.nombre,
                    categoryName: p.categoria,
                    cost: cost,
                    finalPrice: calculateFinalPrice(cost, true, p.precio),
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
                        originalDescription: trimmed,
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
    if (s1.length === 0 || s2.length === 0) return 0;
    if (s1 === s2) return 1;

    let m = 0;
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

    return ((m / s1.length) + (m / s2.length) + ((m - t / 2) / m)) / 3;
}

/**
 * Busca coincidencias para una lista de productos.
 */
export async function searchMatches(items: ParsedItem[], providerId?: string) {
    const results: ParsedItem[] = [];

    let query = supabaseAdmin.from("products").select(`
        id, 
        name,
        descripcion_original,
        cost_price,
        active,
        product_variants (
            id,
            prices (amount)
        )
    `);

    const { data: dbProducts } = await query;
    if (!dbProducts) return { success: false, message: "No se pudieron cargar los productos.", items };

    for (const item of items) {
        let bestMatch: any = null;
        let highestScore = 0;

        // 1. Exacto por descripción original
        const exactMatch = dbProducts.find(dbP => 
            dbP.descripcion_original && 
            dbP.descripcion_original.trim().toLowerCase() === item.originalDescription.trim().toLowerCase()
        );

        if (exactMatch) {
            bestMatch = exactMatch;
            highestScore = 1;
        } else {
            // 2. Fuzzy por nombre
            for (const dbP of dbProducts) {
                const score = getSimilarity(item.name.toLowerCase(), dbP.name.toLowerCase());
                if (score > highestScore) {
                    highestScore = score;
                    bestMatch = dbP;
                }
            }
        }

        const isMatched = highestScore >= 0.85; // Aceptamos > 85% para actualizar en vez de crear nuevos, conservando así las fotos
        
        let currentPrice = undefined;
        if (isMatched && bestMatch?.product_variants?.[0]?.prices?.[0]) {
            currentPrice = bestMatch.product_variants[0].prices[0].amount;
        }

        results.push({
            ...item,
            matchId: isMatched ? bestMatch.id : undefined,
            matchName: isMatched ? bestMatch.name : undefined,
            similarity: Math.round(highestScore * 100),
            currentPrice,
            currentCost: isMatched ? bestMatch.cost_price : undefined,
            status: isMatched ? 'matched' : 'new'
        });
    }

    return { success: true, items: results, message: "Búsqueda finalizada." };
}

/**
 * Obtiene productos a desactivar.
 */
export async function getMissingProducts(matchedIds: string[], providerId: string) {
    if (!providerId) return [];
    const idsInList = matchedIds.filter(id => !!id);

    let query = supabaseAdmin.from('products').select('id, name, descripcion_original, cost_price').eq('provider_id', providerId).eq('active', true);
    if (idsInList.length > 0) query = query.not('id', 'in', `(${idsInList.join(',')})`);

    const { data: missing } = await query;
    return missing?.map(p => ({
        name: p.name,
        originalDescription: p.descripcion_original || '',
        cost: 0,
        finalPrice: 0,
        matchId: p.id,
        currentCost: p.cost_price,
        status: 'deactivate' as const
    })) || [];
}

/**
 * Procesa la sincronización final.
 */
export async function processSync(items: ParsedItem[], providerId?: string) {
    let updated = 0;
    let created = 0;
    let deactivated = 0;
    const errors: string[] = [];

    const DEFAULT_CAT_NAME = "Sin Asignar";
    const DEFAULT_BRAND_NAME = "Sin Asignar";

    try {
        const { data: defCat } = await supabaseAdmin.from('categories').select('id').eq('name', DEFAULT_CAT_NAME).maybeSingle();
        const { data: defBrand } = await supabaseAdmin.from('brands').select('id').eq('name', DEFAULT_BRAND_NAME).maybeSingle();
        
        const safeCategoryId = defCat?.id;
        const safeBrandId = defBrand?.id;

        // Preparar arrays para operaciones en lote
        const providerCostsToUpsert: any[] = [];
        const pricesToUpsert: any[] = [];
        const productsToUpdate: any[] = [];
        const matchedIds = new Set<string>();

        // Optimización: Obtener TODAS las variantes de los productos matcheados de una vez
        const matchedIdsToFetch = items.filter(i => i.status === 'matched' && i.matchId).map(i => i.matchId as string);
        let variantsMap: Record<string, string[]> = {};
        
        if (matchedIdsToFetch.length > 0) {
            const { data: allVariants } = await supabaseAdmin.from('product_variants').select('id, product_id').in('product_id', matchedIdsToFetch);
            if (allVariants) {
                allVariants.forEach(v => {
                    if (!variantsMap[v.product_id]) variantsMap[v.product_id] = [];
                    variantsMap[v.product_id].push(v.id);
                });
            }
        }

        for (const item of items) {
            try {
                if (item.status === 'matched' && item.matchId) {
                    matchedIds.add(item.matchId);
                    
                    if (providerId) {
                        providerCostsToUpsert.push({
                            product_id: item.matchId,
                            provider_id: providerId,
                            cost_price: item.cost,
                            updated_at: new Date().toISOString()
                        });
                    }

                    // Doble validación y cálculo exacto de la fórmula del cliente para asegurar
                    const exactAllowed = (item.cost / 0.90) + 25;
                    const recalculatedFinalPrice = Math.round(exactAllowed / 5) * 5;

                    // Usar el mapa de variantes precargado
                    const variants = variantsMap[item.matchId] || [];
                    if (variants.length > 0) {
                        for (const variantId of variants) {
                            pricesToUpsert.push({
                                variant_id: variantId,
                                currency: 'USD',
                                amount: recalculatedFinalPrice,
                                updated_at: new Date().toISOString()
                            });
                        }
                    } else {
                        // Si no hay variantes, el producto no se puede actualizar correctamente en precios
                        console.warn(`Producto ${item.name} (${item.matchId}) no tiene variantes.`);
                    }

                    productsToUpdate.push({
                        id: item.matchId,
                        provider_id: providerId || null,
                        active: true,
                        cost_price: item.cost,
                        price_usd: recalculatedFinalPrice,
                        descripcion_original: item.originalDescription
                    });

                    updated++;
                } else if (item.status === 'new') {
                    // La creación de nuevos sigue siendo individual por ahora para obtener el ID, 
                    // pero podemos mejorarla si son muchos. Normalmente son menos que las actualizaciones.
                    let categoryId = safeCategoryId;
                    if (item.categoryName) {
                        const { data: cat } = await supabaseAdmin.from('categories').select('id').eq('name', item.categoryName).maybeSingle();
                        if (cat) categoryId = cat.id;
                        else {
                            const { data: nCat } = await supabaseAdmin.from('categories').insert({ name: item.categoryName, slug: slugify(item.categoryName) }).select().single();
                            if (nCat) categoryId = (nCat as any).id;
                        }
                    }

                    let brandId = safeBrandId;
                    const potBrand = item.name.split(' ')[0];
                    if (potBrand && potBrand.length > 2) {
                        const { data: br } = await supabaseAdmin.from('brands').select('id').eq('name', potBrand).maybeSingle();
                        if (br) brandId = br.id;
                        else {
                            const { data: nBr } = await supabaseAdmin.from('brands').insert({ name: smartCapitalize(potBrand), slug: slugify(potBrand) }).select().single();
                            if (nBr) brandId = (nBr as any).id;
                        }
                    }

                    const { data: newP, error: pErr } = await supabaseAdmin.from('products').insert({
                        name: item.name,
                        slug: slugify(item.name) + '-' + Math.random().toString(36).substring(2, 7),
                        category_id: categoryId || safeCategoryId,
                        brand_id: brandId || safeBrandId,
                        provider_id: providerId || null,
                        descripcion_original: item.originalDescription,
                        cost_price: item.cost,
                        active: true,
                        condition: 'new'
                    }).select().single();

                    if (pErr) throw new Error(pErr.message);

                    const { data: v } = await supabaseAdmin.from('product_variants').insert({ product_id: (newP as any).id, active: true }).select().single();
                    if (v) {
                        await supabaseAdmin.from('prices').insert({ variant_id: (v as any).id, currency: 'USD', amount: item.finalPrice });
                        await supabaseAdmin.from('inventory').insert({ variant_id: (v as any).id, qty_available: 10 });
                    }

                    created++;
                } else if (item.status === 'deactivate' && item.matchId) {
                    await supabaseAdmin.from('products').update({ active: false }).eq('id', item.matchId);
                    deactivated++;
                }
            } catch (e: any) {
                console.error(`Error procesando item ${item.name}:`, e);
                errors.push(`${item.name}: ${e.message}`);
            }
        }

        // --- EJECUTAR OPERACIONES EN LOTE ---
        
        // 1. Upsert provider_costs
        if (providerCostsToUpsert.length > 0) {
            console.log(`Upserting ${providerCostsToUpsert.length} provider costs...`);
            const { error } = await supabaseAdmin.from('provider_costs').upsert(providerCostsToUpsert, { onConflict: 'product_id,provider_id' });
            if (error) console.error("Error bulk upserting provider costs:", error);
        }

        // 2. Upsert prices
        if (pricesToUpsert.length > 0) {
            console.log(`Upserting ${pricesToUpsert.length} prices...`);
            const { error } = await supabaseAdmin.from('prices').upsert(pricesToUpsert, { onConflict: 'variant_id,currency' });
            if (error) console.error("Error bulk upserting prices:", error);
        }

        // 3. Update products (Supabase no tiene bulk update con diferentes valores, así que usamos Promise.all en trozos)
        if (productsToUpdate.length > 0) {
            console.log(`Updating ${productsToUpdate.length} products...`);
            // Procesamos en trozos de 20 para no saturar
            const CHUNK_SIZE = 20;
            for (let i = 0; i < productsToUpdate.length; i += CHUNK_SIZE) {
                const chunk = productsToUpdate.slice(i, i + CHUNK_SIZE);
                await Promise.all(chunk.map(p => 
                    supabaseAdmin.from('products').update({
                        provider_id: p.provider_id,
                        active: p.active,
                        cost_price: p.cost_price,
                        price_usd: p.price_usd,
                        descripcion_original: p.descripcion_original
                    }).eq('id', p.id)
                ));
            }
        }

        // 4. Deactivaciones masivas (productos que NO están en la lista actual)
        if (providerId && matchedIds.size > 0 && items.some(i => i.status !== 'deactivate')) {
            console.log("Checking for products to deactivate...");
            const { data: actives } = await supabaseAdmin.from('products').select('id').eq('provider_id', providerId).eq('active', true);
            if (actives) {
                const idsToDeactivate = actives.filter(p => !matchedIds.has(p.id)).map(p => p.id);
                if (idsToDeactivate.length > 0) {
                    console.log(`Deactivating ${idsToDeactivate.length} missing products...`);
                    await supabaseAdmin.from('products').update({ active: false }).in('id', idsToDeactivate);
                    deactivated += idsToDeactivate.length;
                }
            }
        }

    } catch (globalErr: any) {
        console.error("Global Sync Error:", globalErr);
        errors.push(`Error general: ${globalErr.message}`);
    }

    return {
        success: errors.length < items.length || items.length === 0,
        message: `Completado. Act: ${updated}, Nuevos: ${created}, Des: ${deactivated}.`,
        errors: errors.length > 0 ? errors : undefined
    };
}

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
 * Acciones para el COMPARADOR
 */
export async function getComparisonData() {
    try {
        const { data: products, error: pErr } = await supabaseAdmin.from('products').select('id, name, cost_price, provider_id').eq('active', true).order('name');
        const { data: providers, error: provErr } = await supabaseAdmin.from('providers').select('id, name').eq('active', true).order('name');
        const { data: costs, error: cErr } = await supabaseAdmin.from('provider_costs').select('product_id, provider_id, cost_price, updated_at');

        if (pErr || provErr || cErr) throw new Error("Error cargando datos de comparador");

        return { success: true, products, providers, costs };
    } catch (err: any) {
        return { success: false, message: err.message };
    }
}

export async function applyBestPrice(productId: string, bestProviderId: string, bestCost: number) {
    try {
        const sellingPrice = calculateFinalPrice(bestCost);
        
        // Update product
        await supabaseAdmin.from('products').update({
            cost_price: bestCost,
            provider_id: bestProviderId,
        }).eq('id', productId);

        // Update variant prices (assuming 1 variant per product for simplicity in this tool)
        const { data: variants } = await supabaseAdmin.from('product_variants').select('id').eq('product_id', productId);
        if (variants) {
            for (const v of variants) {
                await supabaseAdmin.from('prices').upsert({
                    variant_id: v.id,
                    currency: 'USD',
                    amount: sellingPrice,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'variant_id,currency' });
            }
        }

        return { success: true };
    } catch (err: any) {
        return { success: false, message: err.message };
    }
}

export async function applyAllBestPrices() {
    try {
        const { products, costs } = await getComparisonData() as any;
        if (!products || !costs) throw new Error("No hay datos para procesar.");

        let count = 0;
        for (const p of products) {
            const productCosts = costs.filter((c: any) => c.product_id === p.id);
            if (productCosts.length === 0) continue;

            const best = productCosts.reduce((prev: any, curr: any) => (prev.cost_price < curr.cost_price ? prev : curr));
            
            // Only update if it's different and better (or if current is null)
            if (p.provider_id !== best.provider_id || p.cost_price !== best.cost_price) {
                await applyBestPrice(p.id, best.provider_id, best.cost_price);
                count++;
            }
        }

        return { success: true, message: `Se actualizaron ${count} productos con el mejor precio.` };
    } catch (err: any) {
        return { success: false, message: err.message };
    }
}
