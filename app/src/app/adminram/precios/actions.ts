"use server";

import { createClient } from "@supabase/supabase-js";
import { slugify, smartCapitalize } from "@/lib/utils";
import { calculateSellingPrice } from "@/lib/constants";
import { enrichSingleProduct } from "@/lib/enrichment";

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
    status: 'pending' | 'matched' | 'new' | 'deactivate';
    matchId?: string;
    matchName?: string;
    similarity?: number;
    currentPrice?: number;
    currentCost?: number;
    providerId?: string;
    isActive?: boolean;
    stock?: number;
}

function calculateFinalPrice(cost: number, isGcGroup = false, originalJsonPrice?: number) {
    if (isGcGroup && originalJsonPrice !== undefined) {
        // According to previous UI, GCGroup might take direct price, but to enforce rule:
        // Actually the rule was to enforce (cost / 0.90) + 25 on ALL. Let's just calculate it:
        const exactAllowed = (cost / 0.90) + 25;
        // Siempre redondear hacia ARRIBA (hacia el siguiente múltiplo de 5)
        return Math.ceil(exactAllowed / 5) * 5;
    }
    const exactAllowed = (cost / 0.90) + 25;
    return Math.ceil(exactAllowed / 5) * 5;
}

/**
 * Parsea el texto o JSON y devuelve una lista de Items para previsualizar.
 */
export async function parseImportData(input: string, provider: 'gcgroup' | 'zentek' | 'kadabra' | 'tecnoduo') {
    const items: ParsedItem[] = [];

    try {
        if (['gcgroup', 'zentek', 'kadabra', 'tecnoduo'].includes(provider)) {
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
                throw e; // Reraise if others fail
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

/**
 * INTEGRA DATA COMPLETA A provider_costs
 * Esta acción guarda toda la info del JSON en una tabla intermedia para que luego un script
 * procese los productos, creando nuevos o actualizando existentes de forma diferida.
 * 
 * Lógica de persistencia: 
 * - Si el producto ya existe para ese proveedor, REEMPLAZA el costo y actualiza la fecha.
 * - Si NO existe en el JSON actual pero estaba en la base de datos, NO se borra (mantiene el histórico).
 */
export async function integrateProviderCosts(items: ParsedItem[], providerId: string) {
    if (!providerId) return { success: false, message: "Falta seleccionar el proveedor." };

    try {
        // Obtenemos coincidencias actuales para intentar linkear el product_id si ya existe
        const { items: matchedItems } = await searchMatches(items, providerId);

        // --- DEDUPLICACIÓN EN EL LOTE ---
        // Si varios productos matchean al mismo matchId o nombre, nos quedamos con el más barato.
        const uniqueItems = new Map<string, any>();
        matchedItems.forEach(item => {
            const key = item.matchId ? `id:${item.matchId}` : `name:${item.name.toLowerCase().trim()}`;
            const existing = uniqueItems.get(key);
            if (!existing || item.cost < existing.cost) {
                uniqueItems.set(key, item);
            }
        });

        const allItems = Array.from(uniqueItems.values());

        // Estrategia: DELETE todas las filas existentes del proveedor + INSERT limpio.
        // Esto evita cualquier conflicto con constraints únicos (provider_costs_unique_product_vendor)
        // sin depender de que PostgREST interprete correctamente el nombre del constraint.
        const { error: delError } = await supabaseAdmin
            .from('provider_costs')
            .delete()
            .eq('provider_id', providerId);

        if (delError) throw delError;

        const toInsert = allItems.map(item => ({
            product_id: item.matchId || null,
            provider_id: providerId,
            cost_price: item.cost,
            product_name: item.name,
            category_name: item.categoryName || "Sin Asignar",
            updated_at: new Date().toISOString()
        }));

        if (toInsert.length > 0) {
            const { error: insError } = await supabaseAdmin
                .from('provider_costs')
                .insert(toInsert);
            if (insError) throw insError;
        }

        return { 
            success: true, 
            message: `Sincronización histórica lista: se procesaron ${toInsert.length} productos.` 
        };
    } catch (err: any) {
        console.error("Error integrating provider costs:", err);
        return { success: false, message: `Error al integrar: ${err.message}` };
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
 * 1. Mapeos manuales (tabla supplier_mappings)
 * 2. Exacto por descripción original (columna descripcion_original en products)
 * 3. Fuzzy por nombre
 */
export async function searchMatches(items: ParsedItem[], providerId?: string) {
    const results: ParsedItem[] = [];

    // 1. Cargamos productos de la tienda
    const { data: dbProducts } = await supabaseAdmin.from("products").select(`
        id, 
        name,
        descripcion_original,
        cost_price,
        active,
        product_variants (
            id,
            prices (amount),
            inventory (qty_available)
        )
    `);

    // 2. Cargamos mapeos manuales
    let mappingQuery = supabaseAdmin.from('supplier_mappings').select('variant_id, original_name, provider_id');
    if (providerId) mappingQuery = mappingQuery.eq('provider_id', providerId);
    const { data: mappings } = await mappingQuery;

    // 3. Cargamos costos históricos
    let historyMap: Record<string, number> = {};
    if (providerId) {
        const { data: history } = await supabaseAdmin
            .from('provider_costs')
            .select('product_name, cost_price')
            .eq('provider_id', providerId);
        
        if (history) {
            history.forEach(h => {
                if (h.product_name) {
                    historyMap[h.product_name.toLowerCase()] = h.cost_price;
                }
            });
        }
    }

    if (!dbProducts) return { success: false, message: "No se pudieron cargar los productos.", items };

    for (const item of items) {
        let bestMatch: any = null;
        let highestScore = 0;
        let matchBy = '';

        // --- ESTRATEGIA DE MATCHING ---

        // A. Mapeo Manual (Mayor prioridad)
        const manualMap = mappings?.find(m => 
            m.original_name.trim().toLowerCase() === item.originalDescription.trim().toLowerCase()
        );

        if (manualMap) {
            // Buscamos el producto que tiene esta variante
            const mappedProduct = dbProducts.find(p => 
                p.product_variants.some((v: any) => v.id === manualMap.variant_id)
            );
            if (mappedProduct) {
                bestMatch = mappedProduct;
                highestScore = 1;
                matchBy = 'manual';
            }
        }

        if (!bestMatch) {
            // B. Exacto por descripción original en producto
            const exactMatch = dbProducts.find(dbP => 
                dbP.descripcion_original && 
                dbP.descripcion_original.trim().toLowerCase() === item.originalDescription.trim().toLowerCase()
            );

            if (exactMatch) {
                bestMatch = exactMatch;
                highestScore = 1;
                matchBy = 'exact';
            }
        }

        if (!bestMatch) {
            // C. Fuzzy por nombre
            for (const dbP of dbProducts) {
                const score = getSimilarity(item.name.toLowerCase(), dbP.name.toLowerCase());
                if (score > highestScore) {
                    highestScore = score;
                    bestMatch = dbP;
                    matchBy = 'fuzzy';
                }
            }
        }

        const isMatched = highestScore >= 0.85; 
        
        let currentPrice = undefined;
        if (isMatched && bestMatch?.product_variants?.[0]?.prices?.[0]) {
            currentPrice = bestMatch.product_variants[0].prices[0].amount;
        }

        const prevCost = historyMap[item.name.toLowerCase()] || (isMatched ? bestMatch.cost_price : undefined);

        results.push({
            ...item,
            matchId: isMatched ? bestMatch.id : undefined,
            matchName: isMatched ? bestMatch.name : undefined,
            similarity: Math.round(highestScore * 100),
            currentPrice,
            currentCost: prevCost,
            status: isMatched ? 'matched' : 'new',
            isActive: isMatched ? bestMatch.active : undefined
        });
    }

    return { success: true, items: results, message: "Búsqueda finalizada." };
}

/**
 * Obtiene productos a desactivar.
 * Si se pasa providerId filtra por proveedor; si no, evalúa todos los productos activos.
 */
export async function getMissingProducts(matchedIds: string[], providerId?: string) {
    const idsInList = matchedIds.filter(id => !!id);

    let query = supabaseAdmin.from('products').select('id, name, descripcion_original, cost_price').eq('active', true);
    if (providerId) query = (query as any).eq('provider_id', providerId);
    if (idsInList.length > 0) query = (query as any).not('id', 'in', `(${idsInList.join(',')})`);

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
 * Reactiva TODOS los productos inactivos de un proveedor.
 * Útil para recuperarse de una desactivación masiva accidental.
 */
export async function reactivateProviderProducts(providerId: string) {
    if (!providerId) return { success: false, message: 'Falta providerId', count: 0 };
    try {
        const { data: inactive, error: fetchErr } = await supabaseAdmin
            .from('products')
            .select('id')
            .eq('provider_id', providerId)
            .eq('active', false);

        if (fetchErr) throw fetchErr;
        if (!inactive || inactive.length === 0) {
            return { success: true, message: 'No hay productos inactivos para reactivar.', count: 0 };
        }

        const ids = inactive.map(p => p.id);
        const { error: updateErr } = await supabaseAdmin
            .from('products')
            .update({ active: true })
            .in('id', ids);

        if (updateErr) throw updateErr;

        return { success: true, message: `✅ ${ids.length} productos reactivados.`, count: ids.length };
    } catch (err: any) {
        return { success: false, message: `Error: ${err.message}`, count: 0 };
    }
}

/**
 * Procesa la sincronización final.
 */
export async function processSync(items: ParsedItem[], providerId: string | null = null, doMassDeactivation: boolean = false) {
    console.log(`🚀 Sincronización: ${items.length} items. Proveedor: ${providerId || 'Catálogo'}`);
    
    const results = { success: true, created: 0, updated: 0, deactivated: 0, errors: [] as string[] };
    let itemsToProcess = [...items];

    // 1. AUTO-MATCHING: Si los items están 'pending', buscamos coincidencias ahora mismo
    if (items.some(i => i.status === 'pending')) {
        console.log("🔍 Detectados items pendientes. Buscando coincidencias...");
        const matchRes = await searchMatches(items, providerId || undefined);
        if (matchRes.success) {
            itemsToProcess = matchRes.items;
        } else {
            results.errors.push(`Error de matching: ${matchRes.message}`);
        }
    }

    const createdIds: string[] = [];
    const DEFAULT_CAT_NAME = "Sin Asignar";
    const DEFAULT_BRAND_NAME = "Sin Asignar";

    try {
        const { data: defCat } = await supabaseAdmin.from('categories').select('id').eq('name', DEFAULT_CAT_NAME).maybeSingle();
        const { data: defBrand } = await supabaseAdmin.from('brands').select('id').eq('name', DEFAULT_BRAND_NAME).maybeSingle();
        
        const safeCategoryId = defCat?.id;
        const safeBrandId = defBrand?.id;

        const providerCostsToUpsert: any[] = [];
        const pricesToUpsert: any[] = [];
        const productsToUpdate: any[] = [];
        const matchedIds = new Set<string>();

        const matchedIdsToFetch = itemsToProcess.filter(i => i.status === 'matched' && i.matchId).map(i => i.matchId as string);
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

        console.log(`📦 Procesando ${itemsToProcess.length} items...`);

        for (const item of itemsToProcess) {
            try {
                if (item.status === 'matched' && item.matchId) {
                    matchedIds.add(String(item.matchId));
                    
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
                    const recalculatedFinalPrice = Math.ceil(exactAllowed / 5) * 5;

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

                            // --- ACTUALIZAR STOCK ---
                            // Si viene stock en el item (o por defecto si es matched y queremos resetear/setear)
                            if (item.stock !== undefined) {
                                await supabaseAdmin.from('inventory')
                                    .upsert({ 
                                        variant_id: variantId, 
                                        qty_available: item.stock,
                                        updated_at: new Date().toISOString()
                                    }, { onConflict: 'variant_id' });
                            }
                        }
                    } else {
                        // Si no hay variantes, el producto no se puede actualizar correctamente en precios
                        console.warn(`Producto ${item.name} (${item.matchId}) no tiene variantes.`);
                    }

                    productsToUpdate.push({
                        id: item.matchId,
                        provider_id: providerId || null,
                        active: true, // Forzar activación
                        cost_price: item.cost,
                        price_usd: recalculatedFinalPrice,
                        descripcion_original: item.originalDescription
                    });

                    results.updated++;
                } else if (item.status === 'new') {
                    // La creación de nuevos sigue siendo individual
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
                        provider_id: item.providerId || providerId || null,
                        descripcion_original: item.originalDescription,
                        cost_price: item.cost,
                        active: true,
                        condition: 'new'
                    }).select().single();

                    if (pErr) throw new Error(pErr.message);

                    const { data: v } = await supabaseAdmin.from('product_variants').insert({ product_id: (newP as any).id, active: true }).select().single();
                    if (v) {
                        await supabaseAdmin.from('prices').insert({ variant_id: (v as any).id, currency: 'USD', amount: item.finalPrice });
                        await supabaseAdmin.from('inventory').insert({ variant_id: (v as any).id, qty_available: item.stock !== undefined ? item.stock : 10 });
                    }

                    const newProductId = (newP as any).id;
                    createdIds.push(newProductId);
                    matchedIds.add(String(newProductId)); // evita que el Paso 4 lo desactive
                    results.created++;
                } else if (item.status === 'deactivate' && item.matchId) {
                    await supabaseAdmin.from('products').update({ active: false }).eq('id', item.matchId);
                    results.deactivated++;
                }
            } catch (e: any) {
                console.error(`Error procesando item ${item.name}:`, e);
                results.errors.push(`${item.name}: ${e.message}`);
            }
        }

        // --- DEDUPLICACIÓN DE OPERACIONES EN LOTE ---
        // Evitamos enviar el mismo product_id o variant_id varias veces en el mismo lote de upsert
        
        const uniqueProviderCosts = new Map<string, any>();
        providerCostsToUpsert.forEach(pc => {
            const key = pc.product_id;
            const existing = uniqueProviderCosts.get(key);
            if (!existing || pc.cost_price < existing.cost_price) {
                uniqueProviderCosts.set(key, pc);
            }
        });
        const finalProviderCosts = Array.from(uniqueProviderCosts.values());

        const uniquePrices = new Map<string, any>();
        pricesToUpsert.forEach(pr => {
            const key = pr.variant_id;
            const existing = uniquePrices.get(key);
            if (!existing || pr.amount < existing.amount) {
                uniquePrices.set(key, pr);
            }
        });
        const finalPrices = Array.from(uniquePrices.values());

        // 1. Actualizar provider_costs: DELETE del proveedor + INSERT limpio
        // (evita el error con el constraint "provider_costs_unique_product_vendor")
        if (finalProviderCosts.length > 0 && providerId) {
            console.log(`Updating ${finalProviderCosts.length} provider costs (delete+insert)...`);
            await supabaseAdmin.from('provider_costs').delete().eq('provider_id', providerId);
            const { error } = await supabaseAdmin.from('provider_costs').insert(
                finalProviderCosts.map(pc => ({
                    product_id: pc.product_id,
                    provider_id: pc.provider_id,
                    cost_price: pc.cost_price,
                    product_name: pc.product_name || null,
                    category_name: pc.category_name || null,
                    updated_at: pc.updated_at
                }))
            );
            if (error) console.error("Error actualizando provider costs:", error);
        }

        // 2. Upsert prices
        if (finalPrices.length > 0) {
            console.log(`Upserting ${finalPrices.length} prices...`);
            const { error } = await supabaseAdmin.from('prices').upsert(finalPrices, { onConflict: 'variant_id,currency' });
            if (error) console.error("Error bulk upserting prices:", error);
        }

        // 3. Actualizar productos: SOLO campos de precio/proveedor.
        // short_description, long_description, tags, is_featured e imágenes (product_images)
        // NUNCA se tocan aquí — quedan intactos aunque se actualicen los precios.
        if (productsToUpdate.length > 0) {
            console.log(`Updating ${productsToUpdate.length} products (preserving descriptions & images)...`);
            const CHUNK_SIZE = 20;
            for (let i = 0; i < productsToUpdate.length; i += CHUNK_SIZE) {
                const chunk = productsToUpdate.slice(i, i + CHUNK_SIZE);
                const results_batch = await Promise.all(chunk.map(p => 
                    supabaseAdmin.from('products').update({
                        provider_id: p.provider_id,
                        active: p.active,
                        cost_price: p.cost_price,
                        price_usd: p.price_usd,
                        descripcion_original: p.descripcion_original
                    }).eq('id', p.id)
                ));
                results_batch.forEach((r, idx) => {
                    if (r.error) results.errors.push(`Error en producto ${chunk[idx].id}: ${r.error.message}`);
                });
            }
        }

        // 4. Deactivaciones masivas (productos que NO están en la lista actual)
        // SOLO corre si doMassDeactivation=true (sync completo del proveedor)
        // Para syncs parciales/selectivos, los items con status 'deactivate' ya se procesaron arriba
        if (doMassDeactivation && matchedIds.size > 0 && items.some(i => i.status !== 'deactivate')) {
            console.log("Checking for products to deactivate...");
            console.log(`🔒 Protected IDs (matched + new): ${matchedIds.size}`);
            let activeQuery = supabaseAdmin.from('products').select('id').eq('active', true);
            if (providerId) activeQuery = (activeQuery as any).eq('provider_id', providerId);
            const { data: actives } = await activeQuery;
            if (actives) {
                // Usar String() para garantizar comparación correcta de UUIDs
                const idsToDeactivate = actives
                    .filter(p => !matchedIds.has(String(p.id)))
                    .map(p => p.id);
                if (idsToDeactivate.length > 0) {
                    console.log(`Deactivating ${idsToDeactivate.length} missing products...`);
                    await supabaseAdmin.from('products').update({ active: false }).in('id', idsToDeactivate);
                    results.deactivated += idsToDeactivate.length;
                } else {
                    console.log('✅ No products to deactivate.');
                }
            }
        }

    } catch (globalErr: any) {
        console.error("Global Sync Error:", globalErr);
        results.errors.push(`Error general: ${globalErr.message}`);
    }

    return {
        success: results.errors.length === 0,
        message: `Sync completado. Actualizados: ${results.updated}, Creados: ${results.created}, Desactivados: ${results.deactivated}`,
        createdIds,
        errors: results.errors.length > 0 ? results.errors : undefined
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
        const { data: categories, error: catErr } = await supabaseAdmin.from('categories').select('id, name').order('name');
        const { data: products, error: pErr } = await supabaseAdmin.from('products').select('id, name, cost_price, provider_id, short_description, long_description').eq('active', true).order('name');
        const { data: providers, error: provErr } = await supabaseAdmin.from('providers').select('id, name').eq('active', true).order('name');
        const { data: costs, error: cErr } = await supabaseAdmin.from('provider_costs').select('id, product_id, provider_id, cost_price, product_name, category_name, updated_at');

        if (pErr || provErr || cErr || catErr) throw new Error("Error cargando datos de comparador");

        return { success: true, products, providers, costs, categories };
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
            price_usd: sellingPrice,
            provider_id: bestProviderId,
            updated_at: new Date().toISOString()
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
            
            // Sincronizar si el precio es diferente (para reflejar bajas Y alzas del mercado)
            const hasChanged = p.cost_price === null || Math.abs(best.cost_price - p.cost_price) > 0.01;

            if (hasChanged) {
                await applyBestPrice(p.id, best.provider_id, best.cost_price);
                count++;
            }
        }

        return { success: true, message: `Se actualizaron ${count} productos con el mejor precio.` };
    } catch (err: any) {
        return { success: false, message: err.message };
    }
}

/**
 * Obtiene una PREVISUALIZACIÓN de los cambios de precio sin aplicarlos aún.
 */
export async function getRecalculatePreview() {
    try {
        const { data: products, error: pErr } = await supabaseAdmin
            .from('products')
            .select('id, name, cost_price, price_usd')
            .eq('active', true)
            .order('name');

        if (pErr) throw pErr;
        if (!products) return { success: false, message: "No se encontraron productos." };

        const preview = products
            .filter(p => p.cost_price !== null)
            .map(p => {
                const currentSelling = p.price_usd || 0;
                const newSelling = calculateFinalPrice(p.cost_price!);
                return {
                    id: p.id,
                    name: p.name,
                    cost: p.cost_price,
                    oldPrice: currentSelling,
                    newPrice: newSelling,
                    changed: Math.abs(currentSelling - newSelling) > 0.01
                };
            });

        return { success: true, preview };
    } catch (err: any) {
        console.error("Error getting preview:", err);
        return { success: false, message: `Error: ${err.message}` };
    }
}

/**
 * RECALCULA MASIVAMENTE todos los precios de venta de la tienda
 * basado en el cost_price actual de cada producto y la nueva lógica de redondeo.
 */
export async function recalculateAllPrices() {
    try {
        const { data: products, error: pErr } = await supabaseAdmin
            .from('products')
            .select('id, cost_price')
            .eq('active', true);

        if (pErr) throw pErr;
        if (!products) return { success: false, message: "No se encontraron productos." };

        let count = 0;
        const CHUNK_SIZE = 25;

        for (let i = 0; i < products.length; i += CHUNK_SIZE) {
            const chunk = products.slice(i, i + CHUNK_SIZE);
            
            await Promise.all(chunk.map(async (p) => {
                if (!p.cost_price) return;

                const newSellingPrice = calculateFinalPrice(p.cost_price);
                
                // 1. Actualizar producto
                await supabaseAdmin.from('products').update({
                    price_usd: newSellingPrice,
                    updated_at: new Date().toISOString()
                }).eq('id', p.id);

                // 2. Actualizar variantes/precios
                const { data: variants } = await supabaseAdmin
                    .from('product_variants')
                    .select('id')
                    .eq('product_id', p.id);

                if (variants) {
                    for (const v of variants) {
                        await supabaseAdmin.from('prices').upsert({
                            variant_id: v.id,
                            currency: 'USD',
                            amount: newSellingPrice,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'variant_id,currency' });
                    }
                }
                count++;
            }));
        }

        return { success: true, message: `Se recalcularon los precios de venta para ${count} productos exitosamente.` };
    } catch (err: any) {
        console.error("Error recalculating prices:", err);
        return { success: false, message: `Error: ${err.message}` };
    }
}

/**
 * Dispara el script de enriquecimiento en segundo plano.
 * Lanza `npm run enrich-products` de forma desacoplada y retorna inmediatamente.
 * Los productos sin short_description / imágenes serán procesados automáticamente.
 */
export async function triggerEnrichment(): Promise<{ started: boolean; message: string }> {
    try {
        const { spawn } = await import('child_process');
        const path = await import('path');

        const appDir = path.resolve(process.cwd());
        const child = spawn('npm', ['run', 'enrich-products'], {
            cwd: appDir,
            detached: true,
            stdio: 'ignore',
            env: { ...process.env },
        });
        child.unref();

        return { started: true, message: 'Enriquecimiento iniciado en segundo plano.' };
    } catch (err: any) {
        return { started: false, message: `No se pudo iniciar el enriquecimiento: ${err.message}` };
    }
}
/**
 * PUBLICA productos masivamente desde provider_costs
 */
export async function publishBulkFromProviderCosts(costs: any[], providerId: string | null = null) {
    try {
        const itemsToProcess: ParsedItem[] = costs.map(c => ({
            name: c.product_name || "Producto sin nombre",
            originalDescription: c.product_name || "",
            categoryName: c.category_name || "Sin Asignar",
            cost: c.cost_price,
            finalPrice: Math.ceil(((c.cost_price / 0.90) + 25) / 5) * 5,
            status: 'new',
            providerId: c.provider_id
        }));

        const res = await processSync(itemsToProcess, providerId);
        
        // Link created IDs back to provider_costs if possible
        // processSync returns createdIds but we don't know which ID belongs to which cost here easily 
        // without more changes. However, integrateProviderCosts can be called after to re-match.
        
        return res;
    } catch (err: any) {
        return { success: false, message: err.message };
    }
}

/**
 * ENRIQUECE productos seleccionados con IA (imágenes y descripción)
 */
export async function bulkEnrichProducts(ids: string[], mode: 'all' | 'descriptions' | 'images' = 'all') {
    if (!ids || ids.length === 0) return { success: false, message: "No se seleccionaron productos." };

    try {
        const { enrichSingleProduct } = await import('@/lib/enrichment');
        
        let successCount = 0;
        let errorCount = 0;

        // Procesamos uno a uno para evitar saturar las APIs (especialmente Gemini 429)
        for (const id of ids) {
            const res = await enrichSingleProduct(id, { mode, force: true });
            if (res.success) successCount++;
            else errorCount++;
        }

        return { 
            success: true, 
            message: `Enriquecimiento finalizado. Éxito: ${successCount}, Errores: ${errorCount}.` 
        };
    } catch (err: any) {
        console.error("Error in bulkEnrichProducts:", err);
        return { success: false, message: `Error general: ${err.message}` };
    }
}

/**
 * Crea un mapeo permanente entre una descripción original y un producto/variante.
 */
export async function saveMapping(originalName: string, productId: string, providerId?: string) {
    try {
        // Obtenemos la primera variante del producto
        const { data: variant } = await supabaseAdmin
            .from('product_variants')
            .select('id')
            .eq('product_id', productId)
            .maybeSingle();

        if (!variant) throw new Error("El producto seleccionado no tiene variantes.");

        const { error } = await supabaseAdmin
            .from('supplier_mappings')
            .upsert({
                variant_id: variant.id,
                original_name: originalName,
                provider_id: providerId || null
            }, { onConflict: 'original_name,provider_id' });

        if (error) throw error;

        return { success: true, message: "Mapeo guardado correctamente." };
    } catch (err: any) {
        console.error("Error saving mapping:", err);
        return { success: false, message: err.message };
    }
}

/**
 * Lista todos los mapeos de un proveedor, enriquecidos con el nombre del producto.
 */
export async function getMappings(providerId?: string) {
    try {
        let query = supabaseAdmin
            .from('supplier_mappings')
            .select('id, original_name, provider_id, variant_id, product_variants(product_id, products(id, name))')
            .order('original_name', { ascending: true });

        if (providerId) query = (query as any).eq('provider_id', providerId);

        const { data, error } = await query;
        if (error) throw error;

        const mappings = (data || []).map((m: any) => ({
            id: m.id,
            original_name: m.original_name,
            provider_id: m.provider_id,
            variant_id: m.variant_id,
            product_id: m.product_variants?.products?.id || null,
            product_name: m.product_variants?.products?.name || '—',
        }));

        return { success: true, mappings };
    } catch (err: any) {
        return { success: false, mappings: [] as any[], message: err.message };
    }
}

/**
 * Elimina un mapeo por su ID.
 */
export async function deleteMapping(id: string) {
    try {
        const { error } = await supabaseAdmin
            .from('supplier_mappings')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        return { success: false, message: err.message };
    }
}
