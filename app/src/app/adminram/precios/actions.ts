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
        if (provider === 'gcgroup' || provider === 'zentek') {
            // Zentek now also uses JSON for specific products (MacBook, IPad, RayBan)
            let data;
            try {
                data = JSON.parse(input);
            } catch (e) {
                // Fallback for raw text if zentek
                if (provider === 'zentek') {
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
                    return { success: true, items, message: "Datos parseados (Raw Text)." };
                }
                throw e; // Reraise if gcgroup fails
            }

            const productos = Array.isArray(data.productos) ? data.productos : [];
            for (const p of productos) {
                if (!p.nombre || p.precio === undefined) continue;
                const cost = p.precio_costo || p.precio;
                items.push({
                    name: smartCapitalize(p.nombre),
                    originalDescription: p.nombre,
                    categoryName: p.categoria,
                    cost: cost,
                    finalPrice: calculateFinalPrice(cost, true),
                    status: 'pending'
                });
            }
            return { success: true, items, message: "Datos parseados (JSON)." };
        }

        return { success: true, items, message: "Datos parseados correctamente." };
    } catch (err: any) {
        return { success: false, message: `Error al parsear: ${err.message}`, items: [] };
    }
}

// ─────────────────────────────────────────────────────────────
// MATCHING INTELIGENTE POR SPECS (reemplaza Jaro-Winkler)
// Pesos: modelo 40% | storage 25% | RAM 15% | pantalla 10% | marca 10%
// ─────────────────────────────────────────────────────────────

const BRAND_ALIASES: Record<string, string> = {
    MI: 'XIAOMI', REDMI: 'XIAOMI', POCO: 'XIAOMI', XIAOMI: 'XIAOMI',
    APPLE: 'APPLE', IPHONE: 'APPLE', IPAD: 'APPLE', MACBOOK: 'APPLE', AIRPODS: 'APPLE',
    SAMSUNG: 'SAMSUNG', MOTOROLA: 'MOTOROLA', MOTO: 'MOTOROLA',
    INFINIX: 'INFINIX', TECNO: 'TECNO', TECHNO: 'TECNO', ITEL: 'ITEL',
    REALME: 'REALME', OPPO: 'OPPO', VIVO: 'VIVO',
    HUAWEI: 'HUAWEI', HONOR: 'HONOR', NOKIA: 'NOKIA', LG: 'LG', SONY: 'SONY',
};

// Modificadores de tier que diferencian sub-modelos (S25 vs S25 Ultra)
const MODEL_TIER_MODIFIERS = new Set(['ULTRA', 'PRO', 'MAX', 'PLUS', 'MINI', 'LITE', 'FE', 'GO']);

const NOISE_WORDS = new Set([
    'NUEVO', 'NEW', 'ORIGINAL', 'SELLADO', 'LIBERADO', 'LIBRE',
    'TECLADO', 'ESPANOL', 'LAYOUT', 'QWERTY', 'LEICA', 'OFICIAL', 'DUAL',
    'SIM', 'ESIM', 'NANO', 'EDITION', 'EDICION', 'SPECIAL', 'LIMITED', 'VERSION',
    'NEGRO', 'BLANCO', 'AZUL', 'ROJO', 'VERDE', 'AMARILLO', 'ROSA', 'GRIS',
    'BLACK', 'WHITE', 'BLUE', 'RED', 'GREEN', 'YELLOW', 'PINK', 'PURPLE',
    'GOLD', 'SILVER', 'GRAPHITE', 'TITANIUM',
]);

interface ProductSpecs {
    brand: string | null;
    model: string | null;
    ram: string | null;
    storage: string | null;
    screen: string | null;
}

function normalizeForMatch(name: string): string {
    return name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s/\-]/g, ' ')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function extractSpecs(name: string): ProductSpecs {
    const n = normalizeForMatch(name);
    const specs: ProductSpecs = { brand: null, model: null, ram: null, storage: null, screen: null };

    // Brand
    for (const [alias, canonical] of Object.entries(BRAND_ALIASES)) {
        if (new RegExp(`\\b${alias}\\b`).test(n)) { specs.brand = canonical; break; }
    }

    // RAM + Storage — soporta: 8/256, 8GB/256GB, 8/256GB
    const slashMatch = n.match(/\b(\d{1,3})\s*(?:GB)?\s*\/\s*(\d{2,4})\s*(?:GB)?\b/);
    if (slashMatch) {
        const rv = parseInt(slashMatch[1]), sv = parseInt(slashMatch[2]);
        if ([2,3,4,6,8,10,12,16,24,32].includes(rv)) specs.ram = `${rv}GB`;
        if ([16,32,64,128,256,512,1024].includes(sv)) specs.storage = `${sv}GB`;
    }

    // RAM explícita
    if (!specs.ram) {
        const rm = n.match(/\b(\d{1,2})\s*GB\s*(?:DE\s*)?RAM\b/);
        if (rm && [2,3,4,6,8,10,12,16,24,32].includes(parseInt(rm[1]))) specs.ram = `${rm[1]}GB`;
    }

    // Storage
    if (!specs.storage) {
        for (const m of n.matchAll(/\b(\d{2,4})\s*GB\b/g)) {
            const v = parseInt(m[1]);
            if ([64,128,256,512,1024].includes(v)) { specs.storage = `${v}GB`; break; }
        }
        if (!specs.storage) {
            const tm = n.match(/\b(\d{1,2})\s*TB\b/);
            if (tm) specs.storage = `${tm[1]}TB`;
        }
    }

    // Screen
    const sm = n.match(/\b(\d{1,2}[.,]\d)\s*(?:"|INCH|PULGADAS)\b/);
    if (sm) specs.screen = sm[1].replace(',', '.');

    // Model: quitar marca + specs numéricas + ruido + standalone units
    let model = n;
    for (const alias of Object.keys(BRAND_ALIASES)) model = model.replace(new RegExp(`\\b${alias}\\b`, 'g'), '');
    model = model
        .replace(/\b\d{1,3}\s*(?:GB)?\s*\/\s*\d{2,4}\s*(?:GB)?\b/g, '')
        .replace(/\b\d{1,4}\s*(?:GB|TB|MB)\b/g, '')
        .replace(/\b(?:GB|TB|MB|SSD)\b/g, '')
        .replace(/\b\d{1,2}[.,]\d\s*(?:"|INCH|PULGADAS)\b/g, '')
        .replace(/\b(?:5G|4G|LTE|WIFI|WI-FI)\b/g, '');
    for (const word of NOISE_WORDS) model = model.replace(new RegExp(`\\b${word}\\b`, 'g'), '');
    specs.model = model.replace(/\s+/g, ' ').trim().replace(/^[\s/\-]+|[\s/\-]+$/g, '') || null;

    return specs;
}

function getCriticalTokens(model: string): Set<string> {
    return new Set(model.split(' ').filter(t => /\d/.test(t) || MODEL_TIER_MODIFIERS.has(t)));
}

function getSpecsSimilarity(a: ProductSpecs, b: ProductSpecs): number {
    let score = 0;

    // Marca (10%) — marcas distintas = 0 inmediato
    if (a.brand && b.brand) {
        if (a.brand === b.brand) score += 0.10;
        else return 0;
    }

    // Modelo (40%) via critical tokens
    let modelScore = 0;
    if (a.model && b.model) {
        const ca = getCriticalTokens(a.model);
        const cb = getCriticalTokens(b.model);
        if (ca.size > 0 && cb.size > 0) {
            const inter = [...ca].filter(t => cb.has(t)).length;
            const union = new Set([...ca, ...cb]).size;
            modelScore = inter / union;
        } else {
            // Fallback: token overlap de todo el modelo
            const ta = new Set(a.model.split(' '));
            const tb = new Set(b.model.split(' '));
            const inter = [...ta].filter(t => tb.has(t)).length;
            const union = new Set([...ta, ...tb]).size;
            modelScore = union > 0 ? inter / union : 0;
        }
    }
    score += modelScore * 0.40;

    // Storage (25%)
    if (a.storage && b.storage) { if (a.storage === b.storage) score += 0.25; }
    else if (!a.storage || !b.storage) score += 0.125;

    // RAM (15%)
    if (a.ram && b.ram) { if (a.ram === b.ram) score += 0.15; }
    else if (!a.ram || !b.ram) score += 0.075;

    // Pantalla (10%)
    if (a.screen && b.screen) { if (a.screen === b.screen) score += 0.10; }
    else if (!a.screen || !b.screen) score += 0.05;

    return Math.min(score, 1);
}

function getSimilarity(s1: string, s2: string): number {
    return getSpecsSimilarity(extractSpecs(s1), extractSpecs(s2));
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
