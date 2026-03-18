#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
matcher.py — Motor de matching inteligente para productos de múltiples proveedores.

Usa extracción de specs estructuradas y puntaje ponderado para detectar duplicados
entre proveedores. Pesos: modelo 40%, storage 25%, RAM 15%, pantalla 10%, marca 10%.
"""

import re
import unicodedata

# ──────────────────────────────────────────
# ALIAS DE MARCAS (normalización cruzada)
# ──────────────────────────────────────────
BRAND_ALIASES = {
    "MI": "XIAOMI",
    "REDMI": "XIAOMI",
    "POCO": "XIAOMI",
    "XIAOMI": "XIAOMI",
    "APPLE": "APPLE",
    "IPHONE": "APPLE",
    "IPAD": "APPLE",
    "MACBOOK": "APPLE",
    "AIRPODS": "APPLE",
    "SAMSUNG": "SAMSUNG",
    "MOTOROLA": "MOTOROLA",
    "MOTO": "MOTOROLA",
    "INFINIX": "INFINIX",
    "TECNO": "TECNO",
    "TECHNO": "TECNO",
    "ITEL": "ITEL",
    "REALME": "REALME",
    "OPPO": "OPPO",
    "VIVO": "VIVO",
    "HUAWEI": "HUAWEI",
    "HONOR": "HONOR",
    "NOKIA": "NOKIA",
    "LG": "LG",
    "SONY": "SONY",
}

# Modificadores de tier que diferencian productos del mismo modelo base
MODEL_TIER_MODIFIERS = {"ULTRA", "PRO", "MAX", "PLUS", "MINI", "LITE", "FE", "GO"}

# ──────────────────────────────────────────
# PALABRAS RUIDO (no afectan el matcheo)
# ──────────────────────────────────────────
NOISE_WORDS = {
    "NUEVO", "NEW", "ORIGINAL", "SELLADO", "LIBERADO", "LIBRE",
    "TECLADO", "ESPANOL", "LAYOUT", "QWERTY",
    "LEICA", "OFICIAL", "OFFICIAL",
    "SIM", "ESIM", "NANO", "DUAL",
    "EDITION", "EDICION", "SPECIAL", "LIMITED", "VERSION",
    "NEGRO", "BLANCO", "AZUL", "ROJO", "VERDE", "AMARILLO",
    "ROSA", "GRIS", "VIOLETA", "PURPURA", "CELESTE", "DORADO", "PLATEADO",
    "BLACK", "WHITE", "BLUE", "RED", "GREEN", "YELLOW", "PINK",
    "PURPLE", "GOLD", "SILVER", "GRAPHITE", "TITANIUM",
}

# ──────────────────────────────────────────
# NORMALIZACIÓN
# ──────────────────────────────────────────

def remove_accents(text: str) -> str:
    """Quita acentos y diacríticos."""
    nfkd = unicodedata.normalize('NFKD', text)
    return ''.join(c for c in nfkd if not unicodedata.combining(c))


def normalize_name(name: str) -> str:
    """Normaliza nombre: mayúsculas, sin acentos, sin emojis."""
    if not name:
        return ""
    text = re.sub(r'[^\w\s/\-]', ' ', name)
    text = remove_accents(text)
    text = text.upper().strip()
    text = re.sub(r'\s+', ' ', text)
    return text


# ──────────────────────────────────────────
# EXTRACCIÓN DE SPECS
# ──────────────────────────────────────────

def extract_specs(name: str) -> dict:
    """
    Extrae specs estructuradas de un nombre de producto.
    Returns dict con: brand, model, ram, storage, screen, connectivity
    """
    n = normalize_name(name)

    specs = {
        'brand': None,
        'model': None,
        'ram': None,
        'storage': None,
        'screen': None,
        'connectivity': None,
        'raw': n,
    }

    # --- BRAND ---
    for alias, canonical in BRAND_ALIASES.items():
        if re.search(r'\b' + re.escape(alias) + r'\b', n):
            specs['brand'] = canonical
            break

    # --- RAM + STORAGE (formatos: 8/256, 8GB/256GB, 8/256GB) ---
    # Soporta: "8/256", "8GB/256GB", "8 GB / 256 GB", "8/256GB"
    slash_match = re.search(
        r'\b(\d{1,3})\s*(?:GB)?\s*/\s*(\d{2,4})\s*(?:GB)?\b',
        n
    )
    if slash_match:
        ram_val = int(slash_match.group(1))
        storage_val = int(slash_match.group(2))
        if ram_val in [2, 3, 4, 6, 8, 10, 12, 16, 24, 32]:
            specs['ram'] = f"{ram_val}GB"
        if storage_val in [16, 32, 64, 128, 256, 512, 1024]:
            specs['storage'] = f"{storage_val}GB"

    # --- RAM explícita (N GB RAM) ---
    if not specs['ram']:
        ram_match = re.search(r'\b(\d{1,2})\s*GB\s*(?:DE\s*)?RAM\b', n)
        if ram_match:
            val = int(ram_match.group(1))
            if val in [2, 3, 4, 6, 8, 10, 12, 16, 24, 32]:
                specs['ram'] = f"{val}GB"

    # --- STORAGE (N GB / N TB) ---
    if not specs['storage']:
        for m in re.finditer(r'\b(\d{2,4})\s*GB\b', n):
            val = int(m.group(1))
            if val in [64, 128, 256, 512, 1024]:
                specs['storage'] = f"{val}GB"
                break
        if not specs['storage']:
            tb_m = re.search(r'\b(\d{1,2})\s*TB\b', n)
            if tb_m:
                specs['storage'] = f"{tb_m.group(1)}TB"

    # --- SCREEN (N.N") ---
    screen_m = re.search(r'\b(\d{1,2}[.,]\d{1})\s*(?:"|INCH|PULGADAS|PULG)\b', n)
    if screen_m:
        specs['screen'] = screen_m.group(1).replace(',', '.')

    # --- CONNECTIVITY ---
    if re.search(r'\b5G\b', n):
        specs['connectivity'] = '5G'
    elif re.search(r'\b4G\b|\bLTE\b', n):
        specs['connectivity'] = '4G'

    # --- MODEL (nombre limpio, sin marca, specs numéricas ni ruido) ---
    model_str = n

    # Quitar todos los alias de marca
    for alias in BRAND_ALIASES:
        model_str = re.sub(r'\b' + re.escape(alias) + r'\b', '', model_str)

    # Quitar specs numéricas conocidas (orden importa)
    # Formato slash: 8/256, 8GB/256GB, 8/256GB
    model_str = re.sub(r'\b\d{1,3}\s*(?:GB)?\s*/\s*\d{2,4}\s*(?:GB)?\b', '', model_str)
    # N GB o N TB (con o sin espacio)
    model_str = re.sub(r'\b\d{1,4}\s*(?:GB|TB|MB)\b', '', model_str)
    # Unidades standalone (quedan después de las limpiezas anteriores)
    model_str = re.sub(r'\b(?:GB|TB|MB|SSD)\b', '', model_str)
    # Pantalla
    model_str = re.sub(r'\b\d{1,2}[.,]\d{1}\s*(?:"|INCH|PULGADAS)\b', '', model_str)
    # Conectividad
    model_str = re.sub(r'\b(?:5G|4G|LTE|WIFI|WI-FI)\b', '', model_str)

    # Quitar palabras ruido
    for word in NOISE_WORDS:
        model_str = re.sub(r'\b' + re.escape(word) + r'\b', '', model_str)

    model_str = re.sub(r'\s+', ' ', model_str).strip().strip('/-').strip()
    specs['model'] = model_str if model_str else None

    return specs


# ──────────────────────────────────────────
# CRITICAL TOKENS
# ──────────────────────────────────────────

def get_critical_tokens(model: str) -> set:
    """
    Extrae tokens 'críticos' de un modelo: los que tienen dígitos (ej: S25, 16, A55)
    y los modificadores de tier (ULTRA, PRO, MAX, PLUS, MINI, LITE, FE, GO).
    Son los que determinan si dos productos son realmente el mismo.
    """
    if not model:
        return set()
    tokens = set(model.split())
    return {t for t in tokens if re.search(r'\d', t) or t in MODEL_TIER_MODIFIERS}


# ──────────────────────────────────────────
# SCORING
# ──────────────────────────────────────────

def compute_match_score(specs_a: dict, specs_b: dict) -> float:
    """
    Calcula similitud entre 0 y 1 usando specs estructuradas.

    Pesos:  modelo 40% | storage 25% | RAM 15% | pantalla 10% | marca 10%
    """
    score = 0.0

    # --- MARCA (10%) — si son distintas, score 0 inmediato ---
    if specs_a['brand'] and specs_b['brand']:
        if specs_a['brand'] == specs_b['brand']:
            score += 0.10
        else:
            return 0.0

    # --- MODELO (40%) usando critical tokens ---
    model_score = 0.0
    if specs_a['model'] and specs_b['model']:
        crit_a = get_critical_tokens(specs_a['model'])
        crit_b = get_critical_tokens(specs_b['model'])

        if crit_a and crit_b:
            # Score basado en intersección / unión de critical tokens
            inter = len(crit_a & crit_b)
            union = len(crit_a | crit_b)
            model_score = inter / union
        else:
            # Sin critical tokens: usar overlap de todos los tokens como fallback
            tok_a = set(specs_a['model'].split())
            tok_b = set(specs_b['model'].split())
            if tok_a and tok_b:
                inter = len(tok_a & tok_b)
                union = len(tok_a | tok_b)
                model_score = inter / union

    score += model_score * 0.40

    # --- STORAGE (25%) ---
    if specs_a['storage'] and specs_b['storage']:
        if specs_a['storage'] == specs_b['storage']:
            score += 0.25
        # else: storage distinto → no suma (penalización total)
    elif not specs_a['storage'] or not specs_b['storage']:
        score += 0.125  # Uno sin storage → mitad

    # --- RAM (15%) ---
    if specs_a['ram'] and specs_b['ram']:
        if specs_a['ram'] == specs_b['ram']:
            score += 0.15
        # else: RAM distinta → no suma
    elif not specs_a['ram'] or not specs_b['ram']:
        score += 0.075  # Uno sin RAM → mitad

    # --- PANTALLA (10%) ---
    if specs_a['screen'] and specs_b['screen']:
        if specs_a['screen'] == specs_b['screen']:
            score += 0.10
    elif not specs_a['screen'] or not specs_b['screen']:
        score += 0.05  # Mitad

    return min(score, 1.0)


# ──────────────────────────────────────────
# INTERFACE PRINCIPAL
# ──────────────────────────────────────────

def find_best_match(product_name: str, candidates: list, threshold: float = 0.70) -> tuple:
    """
    Busca el mejor match para product_name en la lista candidates.

    Returns: (mejor_candidato, score) o (None, 0.0) si no alcanza el umbral
    """
    specs_a = extract_specs(product_name)
    best_candidate = None
    best_score = 0.0

    for candidate in candidates:
        specs_b = extract_specs(candidate)
        score = compute_match_score(specs_a, specs_b)
        if score > best_score:
            best_score = score
            best_candidate = candidate

    if best_score >= threshold:
        return best_candidate, best_score
    return None, 0.0


def deduplicate_by_best_price(products: list, threshold: float = 0.78) -> list:
    """
    Recibe lista de dicts con: nombre, precio, precio_costo (opcional), proveedor, categoria.
    Agrupa duplicados entre proveedores y conserva solo el de menor precio_costo.

    Returns lista deduplicada. Los que tenían alternativas incluyen campo _alternatives.
    """
    groups = []  # [(specs_representativo, [productos])]

    for product in products:
        name = product.get('nombre', '')
        specs = extract_specs(name)

        matched_group = None
        best_group_score = 0.0

        for i, (group_specs, _) in enumerate(groups):
            s = compute_match_score(specs, group_specs)
            if s > best_group_score and s >= threshold:
                best_group_score = s
                matched_group = i

        if matched_group is not None:
            groups[matched_group][1].append(product)
        else:
            groups.append((specs, [product]))

    result = []
    for group_specs, group_products in groups:
        if len(group_products) == 1:
            result.append(group_products[0])
        else:
            best = min(group_products,
                       key=lambda p: p.get('precio_costo', p.get('precio', 999999)))
            best = dict(best)
            best['_alternatives'] = [
                {
                    'proveedor': p['proveedor'],
                    'precio_costo': p.get('precio_costo', p.get('precio')),
                    'nombre': p['nombre']
                }
                for p in group_products if p is not best
            ]
            result.append(best)

    return result


# ──────────────────────────────────────────
# TESTS
# ──────────────────────────────────────────

if __name__ == "__main__":
    test_cases = [
        # (nombre_A, nombre_B, debería_matchear)
        ("Samsung Galaxy S25 8/256 GB",       "Samsung S25 8GB 256GB",                True),
        ("iPhone 16 Pro Max 256GB",            "Apple iPhone 16 Pro Max 256 GB",       True),
        ("Xiaomi Redmi Note 14 Pro 8/256",     "Redmi Note 14 Pro 8GB/256GB",          True),
        ("Motorola Edge 50 Neo 8/256GB",       "Motorola Edge 50 Neo 8/256",           True),
        ("Samsung Galaxy A55 5G 8/256",        "Samsung A55 256GB",                    True),
        ("iPhone 15 128GB",                    "iPhone 16 128GB",                      False),
        ("Samsung Galaxy S25 Ultra 12/256",    "Samsung Galaxy S25 8/256",             False),
        ("Samsung Galaxy S25 8/256",           "Samsung Galaxy S26 8/256",             False),
    ]

    print("=" * 65)
    print("TEST DE MATCHING — matcher.py")
    print("=" * 65)

    ok = fail = 0
    for name_a, name_b, should_match in test_cases:
        specs_a = extract_specs(name_a)
        specs_b = extract_specs(name_b)
        score = compute_match_score(specs_a, specs_b)
        matched = score >= 0.70

        result_ok = matched == should_match
        icon = "✅" if result_ok else "❌ FALLO"
        if result_ok:
            ok += 1
        else:
            fail += 1

        crit_a = get_critical_tokens(specs_a['model'] or '')
        crit_b = get_critical_tokens(specs_b['model'] or '')
        print(f"\n{icon}  Score={score:.2f}  (esperado: {'match' if should_match else 'no match'})")
        print(f"   A: {name_a}")
        print(f"      model={specs_a['model']!r} | crit={crit_a} | sto={specs_a['storage']} | ram={specs_a['ram']}")
        print(f"   B: {name_b}")
        print(f"      model={specs_b['model']!r} | crit={crit_b} | sto={specs_b['storage']} | ram={specs_b['ram']}")

    print(f"\n{'='*65}")
    print(f"Resultado: {ok}/{ok+fail} tests correctos")
