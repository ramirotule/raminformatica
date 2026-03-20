#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Procesador de precios específico para Tecno Duo 
Formula: (precio_costo / 0.90) + $25 USD, redondeado a múltiplo de 5

Formatos de precio soportados:
  $500         → 500 USD
  $1.839       → 1839 USD  (punto = separador de miles estilo argentino)
  USD740       → 740 USD
  u$s 629      → 629 USD
  u$250        → 250 USD
  120 USD      → 120 USD

Secciones del texto:
  📱 APPLE NEW              → Celulares / iPhone  (prefijo iPhone auto)
  📱 CPO IPHONE             → Celulares / iPhone  (CPO ya incluido en nombre)
  📱 SAMSUNG SmartWatch...  → Celulares / Samsung + sub-secciones
      Tablet Samsung        → Tablets & Ipads / Samsung
      SmartWatch Samsung    → Smartwatch / Samsung
  📱 IPADS-AIRPODS-WATCH... → sub-secciones Apple
  📱 XIAOMI MOTOROLA...     → Celulares (marca según nombre)
  ⌚ GARMIN                 → Smartwatch / Garmin
  GoPro / Go Pro            → Cámaras de Acción
  DJI                       → DJI
"""

import re
import os
import json
import math
from datetime import datetime


class ProcesadorQuiro:
    def __init__(self):
        self.productos_extraidos = []

    # ──────────────────────────────────────────
    # CATEGORIZACIÓN
    # ──────────────────────────────────────────

    def normalizar_categoria(self, linea_raw):
        """
        Devuelve (categoria, brand, force_iphone_prefix) para un header de sección.
        force_iphone_prefix = True en APPLE NEW: números solos tipo "13 128GB"
        deben recibir prefijo "iPhone" automáticamente.
        """
        cat = linea_raw.upper().strip()
        cat_clean = re.sub(r'[^\w\s/\-]', ' ', cat)
        cat_clean = re.sub(r'\s+', ' ', cat_clean).strip()

        # Sección APPLE NEW → iPhones nuevos (bare model numbers)
        if re.search(r'\bAPPLE\s*NEW\b', cat_clean):
            return "Celulares", "iPhone", True

        # CPO IPHONE → reacondicionados, ya traen "CPO iPhone" en el nombre
        if re.search(r'\bCPO\b.*\bIPHONE\b|\bIPHONE\b.*\bCPO\b', cat_clean):
            return "Celulares", "iPhone", False

        # SAMSUNG (header principal, sub-secciones se manejan por separado)
        if 'SAMSUNG' in cat_clean:
            return "Celulares", "Samsung", False

        # IPADS / AIRPODS / WATCH / MACBOOK (header multi-sección Apple)
        if 'IPAD' in cat_clean and ('AIRPODS' in cat_clean or 'WATCH' in cat_clean or 'MACBOOK' in cat_clean):
            return "Tablets & Ipads", "Apple", False  # primer sub-cat del bloque

        if 'IPAD' in cat_clean:
            return "Tablets & Ipads", "Apple", False
        if 'AIRPODS' in cat_clean or 'AIR PODS' in cat_clean:
            return "AirPods", "Apple", False
        if 'MACBOOK' in cat_clean or 'MAC BOOK' in cat_clean:
            return "Notebooks & Macbooks", "Apple", False

        # XIAOMI / MOTOROLA / GOOGLE PIXEL (sección multi-marca)
        if re.search(r'\bXIAOMI\b|\bMOTOROLA\b|\bPIXEL\b', cat_clean):
            return "Celulares", None, False

        # GARMIN → Smartwatch
        if 'GARMIN' in cat_clean:
            return "Smartwatch", "Garmin", False

        # GoPro → Cámaras de Acción
        if re.search(r'\bGOPRO\b|\bGO PRO\b', cat_clean):
            return "Cámaras de Acción", None, False

        # DJI
        if 'DJI' in cat_clean:
            return "DJI", None, False

        return cat_clean.title(), None, False

    def recategorizar_por_nombre(self, nombre_upper, categoria_actual, brand_actual):
        """
        Ajusta categoría/brand según el nombre del producto.
        Tiene prioridad sobre el header de sección.
        """
        # 1. Televisores (Máxima prioridad)
        keywords_tv = [
            'SMART TV', 'QLED', 'OLED', 'UHD', 'CRYSTAL', 'PUD', 'AMBILIGHT', 
            'TITAN OS', 'PHILCO', 'NOBLEX', 'ADMIRAL', 'AOC', 'TOSHIBA', 
            'HISENSE', 'BGH', 'TCL', 'RCA', 'SANYO', 'TELEVISOR', 'MONITOR TV'
        ]
        if any(kw in nombre_upper for kw in keywords_tv) or re.search(r'^\d{2,3}"', nombre_upper):
            return "Televisores", None

        # 2. Gaming / Consolas
        if re.search(r'\bPS[345]\b|\bPLAYSTATION\b|\bNINTENDO\b|\bSWITCH\b|\bXBOX\b|\bJOYSTICK\b', nombre_upper) or 'META QUEST' in nombre_upper:
            brand = "Meta" if 'META QUEST' in nombre_upper else None
            return "Video Juegos", brand

        # 3. Hogar / Electrodomésticos
        if re.search(r'\bHELADERA\b|\bAIRE\s+ACONDICIONADO\b|\bSPLIT\b|\bLAVARROPAS\b|\bLAVASECARROPAS\b|\bSECARROPAS\b|\bCOCINA\b|\bMICROONDAS\b|\bINVERTER\b', nombre_upper):
            return "Hogar", None

        # 4. Smartwatch por tamaño (ej. 40mm, 44mm, 45mm, 47mm)
        if re.search(r'\b\d{2}MM\b', nombre_upper):
            brand = brand_actual
            if 'SAMSUNG' in nombre_upper or 'GALAXY' in nombre_upper: brand = "Samsung"
            elif 'APPLE' in nombre_upper or 'WATCH' in nombre_upper: brand = "Apple"
            elif 'GARMIN' in nombre_upper: brand = "Garmin"
            return "Smartwatch", brand

        # 5. Apple (iPhone, iPad, Mac, etc.)
        is_apple = any(kw in nombre_upper for kw in ['IPHONE', 'IPAD', 'MACBOOK', 'IMAC', 'AIRPODS', 'AIRTAG', 'PENCIL PRO', 'MAGIC KEYBOARD']) or \
                   re.search(r'\b(APPLE|WATCH SERIES|WATCH SE)\b', nombre_upper)
        
        if is_apple:
            brand = "Apple"
            if 'IPHONE' in nombre_upper: return "Celulares", brand
            if 'IPAD' in nombre_upper: return "Tablets & Ipads", brand
            if 'MACBOOK' in nombre_upper or 'IMAC' in nombre_upper: return "Notebooks & Macbooks", brand
            if 'AIRPODS' in nombre_upper: return "AirPods", brand
            if 'WATCH' in nombre_upper: return "Smartwatch", brand
            if 'PENCIL' in nombre_upper or 'AIRTAG' in nombre_upper or 'MAGSAFE' in nombre_upper: return "Accesorios", brand
            if 'KEYBOARD' in nombre_upper or 'TECLADO' in nombre_upper: return "Teclados", brand

        # 5. Samsung (Tablets, Watch, Phones)
        es_samsung = 'SAMSUNG' in nombre_upper or 'GALAXY' in nombre_upper or \
                    re.search(r'\b(Z\s*FLIP|Z\s*FOLD|S2[456] ULTRA|X\d{3}|TAB\s*S[6-9])\b', nombre_upper)
        
        if es_samsung or brand_actual == "Samsung":
            brand = "Samsung"
            if re.search(r'\b(TAB|TABLET|X\d{3})\b|\bS1[01]\b.*(FE|ULTRA)', nombre_upper):
                return "Tablets & Ipads", brand
            if 'WATCH' in nombre_upper:
                return "Smartwatch", brand
            if 'BUDS' in nombre_upper:
                return "Celulares", brand
            return "Celulares", brand

        # 6. Otros Celulares (Motorola, Xiaomi, Google)
        if re.search(r'\bMOTO\b|\bMOTOROLA\b|\bEDGE\b|\bRAZR\b', nombre_upper):
            return "Celulares", "Motorola"
        if re.search(r'\bXIAOMI\b|\bREDMI\b|\bPOCO\b|\bNOTE\b', nombre_upper):
            return "Celulares", "Xiaomi"
        if re.search(r'\bGOOGLE\b|\bPIXEL\b', nombre_upper):
            return "Celulares", "Google"

        # 7. Lentes y Otros
        if re.search(r'\bRAYBAN\b|\bRAY\s*BAN\b|\bMETA\s+GEN\d\b', nombre_upper):
            return "Lentes", None
        if re.search(r'\bGOPRO\b|\bGO PRO\b', nombre_upper):
            return "Cámaras de Acción", None
        if re.search(r'\bDJI\b', nombre_upper):
            return "DJI", None
        if 'GARMIN' in nombre_upper:
            return "Smartwatch", "Garmin"

        # Casos para modelos de iPhone omitidos (ej. "11 64GB" en sección de usados)
        if brand_actual is None or brand_actual == "iPhone":
            if re.search(r'\b(1[1-6]|X[SR]|SE)\b', nombre_upper) and not re.search(r'\b(NOTE|REDMI|POCO|MOTO|EDGE|S2[456]|X\d{3})\b', nombre_upper):
                return "Celulares", "iPhone"

        return categoria_actual, brand_actual

    # ──────────────────────────────────────────
    # PRECIO
    # ──────────────────────────────────────────

    def parsear_precio(self, texto):
        """
        Soporta: $1.949, $ 1.949, USD 1.839, u$s 629, 120 USD, etc.
        Detecta prefijos de moneda y números con o sin separador de miles.
        """
        # Limpieza básica inicial
        texto = texto.strip()
        
        # ── 1. Buscar precio por patrones de moneda (Prioridad Alta) ──
        # Patrón para el número: d.ddd o dddd (soporta hasta 9.999.999 para Pesos)
        regex_precio = r'(\d{1,3}(?:\.\d{3})+|\d{1,7}(?![.,]\d))'
        
        # Moneda delante: $ 1.949, USD180, etc.
        m = re.search(rf'(?:\$|USD|u\$s?)\s*{regex_precio}', texto, re.IGNORECASE)
        if m:
            val = m.group(1).replace('.', '')
            try:
                return float(val)
            except:
                pass

        # Moneda detrás: 180 USD, 1.949$, etc.
        m = re.search(rf'{regex_precio}\s*(?:\$|USD|u\$s?)', texto, re.IGNORECASE)
        if m:
            val = m.group(1).replace('.', '')
            try:
                return float(val)
            except:
                pass

        # ── 2. Fallback: Buscar número de 3-5 dígitos al final de la línea o aislado ──
        # Esto ayuda si no detectó el símbolo de moneda pero la casilla es de precio
        num_matches = re.findall(r'\b(?!\d{1,2}(?:GB|TB))\d{3,5}\b', texto)
        if num_matches:
            try:
                val = float(num_matches[-1])
                if val >= 15: # Filtro para evitar modelos pequeños
                     return val
            except:
                pass

        return None

    def calcular_precio_venta(self, precio_costo):
        """Formula: (precio_costo / 0.90) + $25 USD, redondeado a múltiplo de 5."""
        try:
            # Redondear siempre hacia ARRIBA al múltiplo de 5
            return int(math.ceil(((precio_costo / 0.9) + 25) / 5) * 5)
        except Exception as e:
            print(f"⚠️ Error calculando precio: {e}")
            return None

    # ──────────────────────────────────────────
    # FORMATEO DE NOMBRE
    # ──────────────────────────────────────────

    def formatear_nombre_producto(self, nombre, brand=None):
        """
        Agrega prefijo de marca si corresponde y aplica Title Case
        respetando excepciones técnicas (GB, TB, SSD, 5G, CPO, etc.).
        """
        # Eliminar símbolos decorativos excepto los permitidos (+, -, %, etc.)
        nombre_final = re.sub(r'[^\w\s\+\-\.%\,\/\(\)\&\'\"]', '', nombre).strip()
        nombre_final = " ".join(nombre_final.split()) # Limpia espacios extras

        if brand:
            keywords_apple = ["iphone", "ipad", "macbook", "airpods", "imac",
                               "mac mini", "magsafe", "airtag", "pencil", "apple", "cpo"]
            if brand in ("Apple", "iPhone"):
                ya_tiene_marca = any(kw in nombre_final.lower() for kw in keywords_apple)
            else:
                # Comprobar si la marca ya está presente en el nombre
                ya_tiene_marca = brand.lower() in nombre_final.lower()
            if not ya_tiene_marca:
                nombre_final = f"{brand} {nombre_final}"

        excepciones_upper = {
            "GB", "TB", "SSD", "RAM", "5G", "4G", "LTE", "NFC",
            "M1", "M2", "M3", "M4", "M5", "GPS", "USB-C", "USB",
            "DS", "CPO", "UHD", "OLED", "AMOLED",
        }
        palabras = nombre_final.split()
        resultado = []
        for pal in palabras:
            pal_up = pal.upper()
            pal_check = pal_up.replace('/', '').replace('(', '').replace(')', '')
            if pal_check in excepciones_upper:
                resultado.append(pal_up)
            elif re.search(r'\d', pal) and re.search(r'(?:GB|TB|MB|SSD|RAM|GHZ|MHZ|W)$', pal_up):
                resultado.append(pal_up)  # 256GB, 20W, etc.
            elif len(pal) > 1:
                resultado.append(pal[0].upper() + pal[1:].lower())
            else:
                resultado.append(pal_up)
        return " ".join(resultado)

    def obtener_icono_categoria(self, categoria):
        cat = categoria.upper()
        if "DESKTOP" in cat or "ESCRITORIO" in cat: return "🖥️"
        if "NOTEBOOK" in cat or "MACBOOK" in cat:   return "💻"
        if "SMARTWATCH" in cat:                      return "⌚"
        if "AIRPODS" in cat:                         return "🎧"
        if "TABLET" in cat or "IPAD" in cat:         return "📱"
        if "CELULAR" in cat or "IPHONE" in cat:      return "📱"
        if "CAMARA" in cat or "ACCION" in cat:       return "📷"
        if "DJI" in cat:                             return "🚁"
        if "ACCESORIOS" in cat:                      return "🔌"
        return "📦"

    # ──────────────────────────────────────────
    # EXTRACCIÓN
    # ──────────────────────────────────────────

    # Regex para strip del prefijo WhatsApp:
    # "[10:53, 17/3/2026] Provee Quiro Naza Último: "
    WA_PREFIX_RE = re.compile(
        r'^\[?\d{1,2}:\d{2}(?:[^\]]*)\]?\s*[^:]+:\s*',
        re.UNICODE
    )

    # Sub-secciones dentro del bloque Samsung
    SAMSUNG_SUBSECTIONS = [
        (r'TABLET\s+SAMSUNG|SAMSUNG\s+TABLET',      "Tablets & Ipads", "Samsung"),
        (r'SMARTWATCH\s+SAMSUNG|SAMSUNG\s+WATCH|WATCH\s+SAMSUNG', "Smartwatch", "Samsung"),
    ]

    # Sub-secciones dentro del bloque iPads-AirPods-Watch-MacBook
    APPLE_SUBSECTIONS = [
        (r'^\s*MACBOOK\b',                          "Notebooks & Macbooks", "Apple"),
        (r'^\s*AIRPODS?\b',                         "AirPods",              "Apple"),
        (r'^\s*APPLE\s+WATCH\b|\bWATCH\s+APPLE\b', "Smartwatch",           "Apple"),
        (r'^\s*IPADS?\b',                           "Tablets & Ipads",      "Apple"),
    ]

    IGNORE_PATTERNS = [
        r'GARANT[IÍ]A',
        r'\bENV[IÍ]O\b',
        r'NO\s+ACEPTO',
        r'RECIBIMOS\b',
        r'BILLETES?\b',
        r'ACEPTAMOS\b',
        r'TRANSFERENCIA',
        r'PRECIO\s+SUJETO',
        r'STOCK\s+LIMITADO',
        r'CONSULTA[RS]?\b',
        r'^\s*[💸▪•➡️]\s*$',   # Emojis/bullets vacíos
    ]

    def debe_ignorar(self, linea: str) -> bool:
        linea_up = linea.upper()
        for pat in self.IGNORE_PATTERNS:
            if re.search(pat, linea_up, re.UNICODE):
                return True
        return False

    def es_header_principal(self, linea):
        """
        Detecta si la línea es un encabezado de sección principal
        (no contiene precio y coincide con patrones de sección conocidos).
        """
        if self.parsear_precio(linea) is not None:
            return False  # Tiene precio → es producto, no header

        linea_up = linea.upper().strip()
        linea_clean = re.sub(r'[^\w\s]', ' ', linea_up).strip()

        return bool(re.search(
            r'\bAPPLE\s*NEW\b'
            r'|\bCPO\s+IPHONE\b'
            r'|\bSAMSUNG\b'
            r'|\bXIAOMI\b.*\bMOTOROLA\b'
            r'|\bMOTOROLA\b.*\bXIAOMI\b'
            r'|\bPIXEL\b.*\bXIAOMI\b'
            r'|\bIPADS?\s*[\-–]\s*AIRPODS?\b'
            r'|\bUSED\b|\bUSADOS\b|\bREACONDICIONADO\b'
            r'|\bGARMIN\b'
            r'|\bGOPRO\b|\bGO\s+PRO\b'
            r'|\bDJI\b',
            linea_clean,
            re.UNICODE
        ))

    def es_subseccion_samsung(self, linea):
        if self.parsear_precio(linea) is not None:
            return None
        linea_up = linea.upper().strip()
        for pat, cat, brand in self.SAMSUNG_SUBSECTIONS:
            if re.search(pat, linea_up, re.UNICODE):
                return cat, brand
        return None

    def es_subseccion_apple(self, linea):
        if self.parsear_precio(linea) is not None:
            return None
        linea_up = linea.upper().strip()
        linea_clean = re.sub(r'[^\w\s]', ' ', linea_up).strip()
        for pat, cat, brand in self.APPLE_SUBSECTIONS:
            if re.search(pat, linea_clean, re.UNICODE):
                return cat, brand
        return None

    def extraer_productos_del_texto(self, texto_completo):
        """Extrae productos y precios del texto de Tecno Duo."""
        print(f"🔍 Procesando texto de Tecno Duo ({len(texto_completo)} caracteres)...")

        lineas = texto_completo.split('\n')
        categoria_actual = "Celulares"
        brand_actual = "iPhone"
        force_iphone = False   # True sólo en sección APPLE NEW

        # Rastrear en qué bloque multi-sección estamos
        en_bloque_samsung = False
        en_bloque_apple_multi = False  # iPads-AirPods-Watch-MacBook
        es_usado_seccion = False

        for linea in lineas:
            linea = linea.strip()
            if not linea:
                continue

            # Stripear prefijo WhatsApp
            stripped = self.WA_PREFIX_RE.sub('', linea).strip()
            if stripped:
                linea = stripped
            if not linea:
                continue

            if self.debe_ignorar(linea):
                continue

            # ── Sub-secciones dentro del bloque Samsung ──
            if en_bloque_samsung:
                sub = self.es_subseccion_samsung(linea)
                if sub:
                    categoria_actual, brand_actual = sub
                    force_iphone = False
                    print(f"   📂 Sub-sección Samsung → {categoria_actual}")
                    continue

            # ── Sub-secciones dentro del bloque Apple multi ──
            if en_bloque_apple_multi:
                sub = self.es_subseccion_apple(linea)
                if sub:
                    categoria_actual, brand_actual = sub
                    force_iphone = False
                    print(f"   📂 Sub-sección Apple → {categoria_actual}")
                    continue

            # ── Header de sección principal ──
            if self.es_header_principal(linea):
                cat, brand, fi = self.normalizar_categoria(linea)
                if cat:
                    categoria_actual = cat
                    brand_actual = brand
                    force_iphone = fi

                    linea_up = linea.upper()
                    en_bloque_samsung = 'SAMSUNG' in linea_up
                    en_bloque_apple_multi = bool(re.search(
                        r'\bIPADS?\s*[\-–]\s*AIRPODS?\b|\bIPADS?\b.*\bMACBOOK\b',
                        linea_up
                    ))
                    es_usado_seccion = bool(re.search(r'\bUSED\b|\bUSADO\b|\bCPO\b|\bREACONDICIONADO\b', linea_up))

                    print(f"   📂 Sección: {categoria_actual}" +
                          (f" [{brand_actual}]" if brand_actual else "") +
                          (" [force iPhone prefix]" if force_iphone else "") +
                          (" [USADO]" if es_usado_seccion else ""))
                continue

            # ── Detectar precio ──
            precio = self.parsear_precio(linea)
            if precio is None:
                continue

            # ── Extraer nombre: limpiar emojis y el precio ──
            nombre_raw = re.sub(
                r'[^\x00-\x7F\wáéíóúÁÉÍÓÚñÑüÜ\s/\-\.\(\)\"\'+]', '', linea
            ).strip()

            # Remover el precio del nombre (robusto ante espacios y múltiples formatos)
            nombre_raw = re.sub(
                r'(?:\$|USD|u\$s?)\s*[\d.]+\b|[\d.]+\s*(?:\$|USD|u\$s?)\b',
                '', nombre_raw, flags=re.IGNORECASE
            )
            nombre_raw = re.sub(r'[\s\-]+$', '', nombre_raw).strip()
            nombre_raw = re.sub(r'\s+', ' ', nombre_raw).strip()

            if not nombre_raw or len(nombre_raw) < 2:
                continue

            # Re-categorizar por nombre del producto
            nombre_upper = nombre_raw.upper()
            cat_final, brand_final = self.recategorizar_por_nombre(
                nombre_upper, categoria_actual, brand_actual
            )

            # En sección APPLE NEW, agregar prefijo "iPhone" si no está (solo a Celulares que sean Apple)
            if force_iphone and cat_final == "Celulares" and brand_final == "Apple" and not nombre_raw.upper().startswith('IPHONE'):
                nombre_raw = f"iPhone {nombre_raw}"
                # Re-recategorizar con el nuevo nombre (brand_final ya es iPhone)
                nombre_upper = nombre_raw.upper()

            # Formatear nombre con Title Case y marca
            producto = self.formatear_nombre_producto(nombre_raw, brand_final)

            # --- LÓGICA DE BATERÍA SOLO PARA PRODUCTOS USADOS (Principalmente iPhone) ---
            # Solo aplicamos si estamos en sección de usados o el nombre ya sugiere usado/CPO
            es_producto_usado = es_usado_seccion or "USADO" in linea_up or "CPO" in linea_up
            
            if es_producto_usado:
                # 1. Si ya tiene un porcentaje explícito (+85%, 90%, etc.) pero no tiene el emoji
                if "🔋" not in producto:
                    producto = re.sub(r'(\+?\d{2,3}%)', r'🔋\1', producto)
                
                # 2. Si tiene un + seguido de número pero no tiene %, y no es storage/RAM/porcentaje
                if "🔋" not in producto:
                    producto = re.sub(r'\+(\d{2,3})\b(?![GTM]B|SSD|W|RAM|%|")', r'🔋+\1%', producto)

            # Para televisores, agregar símbolo de pulgadas a números al inicio (e.g., 85 -> 85")
            if cat_final == "Televisores" and not producto.endswith('"'):
                producto = re.sub(r'^(\d{2,3})\s+', r'\1" ', producto)

            # Agregar sufijo (USADO) si corresponde (Evitar en Televisores a menos que sea explícito)
            if es_producto_usado:
                ya_dice_usado = "(USADO)" in producto.upper() or "USADO" in linea_up
                if cat_final == "Televisores":
                    # Solo agregar si el nombre original ya decía USADO
                    if "USADO" in linea_up and not ya_dice_usado:
                        producto = f"{producto} (USADO)"
                elif not ya_dice_usado:
                    producto = f"{producto} (USADO)"

            precio_venta = self.calcular_precio_venta(precio)
            if not precio_venta:
                continue

            self.productos_extraidos.append({
                'producto': producto,
                'precio_costo': precio,
                'precio_venta': precio_venta,
                'categoria': cat_final,
                'proveedor': 'Tecno Duo',
            })
            print(f"   ✅ {producto}: ${precio} → ${precio_venta}  [{cat_final}]")

        print(f"   📊 Total productos extraídos: {len(self.productos_extraidos)}")
        return self.productos_extraidos

    # ──────────────────────────────────────────
    # JSON
    # ──────────────────────────────────────────

    def generar_json_productos(self, archivo_salida="../app/public/productos_tecnoduo.json"):
        """Genera JSON público con todos los productos + actualiza el consolidado."""
        try:
            os.makedirs(os.path.dirname(os.path.abspath(archivo_salida)), exist_ok=True)

            estructura_publica = {
                "metadatos": {
                    "ultima_actualizacion": datetime.now().strftime("%d/%m/%Y %H:%M"),
                    "proveedor": "Tecno Duo",
                    "total_productos": len(self.productos_extraidos),
                },
                "productos": [
                    {
                        "nombre": p['producto'],
                        "precio": p['precio_venta'],
                        "precio_costo": p['precio_costo'],
                        "categoria": p['categoria'],
                        "proveedor": "Tecno Duo",
                    }
                    for p in self.productos_extraidos
                ]
            }

            with open(archivo_salida, 'w', encoding='utf-8') as f:
                json.dump(estructura_publica, f, indent=2, ensure_ascii=False)
            print(f"✅ JSON Tecno Duo: {archivo_salida} ({len(self.productos_extraidos)} productos)")

            # Actualizar consolidado
            archivo_privado = "productos_ram_completo.json"
            estructura_completa = {"metadatos": {}, "productos": []}

            if os.path.exists(archivo_privado):
                try:
                    with open(archivo_privado, 'r', encoding='utf-8') as f:
                        estructura_completa = json.load(f)
                    if isinstance(estructura_completa.get('productos'), dict):
                        lista_plana = []
                        for cat_prods in estructura_completa['productos'].values():
                            lista_plana.extend(cat_prods)
                        estructura_completa['productos'] = lista_plana
                except Exception as e:
                    print(f"⚠️ Error cargando consolidado: {e}")

            # Reemplazar productos anteriores de Tecno Duo
            otros = [p for p in estructura_completa.get('productos', [])
                     if p.get('proveedor', '').lower() != 'tecnoduo']
            nuevos = [
                {
                    "nombre": p['producto'],
                    "precio": p['precio_venta'],
                    "precio_costo": p['precio_costo'],
                    "categoria": p['categoria'],
                    "proveedor": "Tecno Duo",
                    "fecha_actualizacion": datetime.now().strftime("%d/%m/%Y %H:%M"),
                }
                for p in self.productos_extraidos
            ]

            estructura_completa['productos'] = otros + nuevos
            estructura_completa['metadatos'].update({
                "ultima_actualizacion": datetime.now().strftime("%d/%m/%Y %H:%M"),
                "productos_tecnoduo": len(nuevos),
                "total_productos": len(estructura_completa['productos']),
            })

            with open(archivo_privado, 'w', encoding='utf-8') as f:
                json.dump(estructura_completa, f, indent=2, ensure_ascii=False)
            print(f"✅ Consolidado actualizado: {len(nuevos)} productos Tecno Duo")
            return True

        except Exception as e:
            print(f"❌ Error generando JSON: {e}")
            import traceback; traceback.print_exc()
            return False

    def generar_archivo_difusion(self):
        """Genera archivo de difusión para WhatsApp."""
        try:
            os.makedirs("output", exist_ok=True)
            fecha = datetime.now().strftime("%d-%m-%Y")
            archivo = f"output/difusion_tecnoduo_{fecha}.txt"

            categorias = {}
            for p in self.productos_extraidos:
                categorias.setdefault(p['categoria'], []).append(p)

            with open(archivo, 'w', encoding='utf-8') as f:
                f.write(f"🚀 TECNO DUO - LISTA RAM INFORMÁTICA {datetime.now().strftime('%d/%m/%Y')} 🚀\n")
                f.write("=" * 45 + "\n\n")
                for cat, prods in categorias.items():
                    f.write(f"{self.obtener_icono_categoria(cat)} {cat}\n")
                    f.write("-" * 30 + "\n")
                    for p in prods:
                        f.write(f"• {p['producto']} - ${p['precio_venta']}\n")
                    f.write("\n")
                f.write("=" * 45 + "\n")
                f.write("💬 Consultas y pedidos por WhatsApp\n")

            print(f"✅ Difusión generada: {archivo}")
            return True
        except Exception as e:
            print(f"❌ Error difusión: {e}")
            return False


def main():
    print("🚀 PROCESADOR TECNO DUO")
    print("-" * 30)

    procesador = ProcesadorQuiro()
    archivo_entrada = "output/lista_tecnoduo.txt"

    if not os.path.exists(archivo_entrada):
        print(f"❌ No se encontró: {archivo_entrada}")
        print("   Guardá el texto de Tecno Duo en output/lista_tecnoduo.txt y volvé a ejecutar.")
        return

    contenido = None
    for encoding in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']:
        try:
            with open(archivo_entrada, 'r', encoding=encoding) as f:
                contenido = f.read()
            print(f"✅ Archivo leído ({encoding}): {len(contenido)} chars")
            break
        except UnicodeDecodeError:
            continue

    if not contenido or not contenido.strip():
        print("❌ Archivo vacío o ilegible.")
        return

    productos = procesador.extraer_productos_del_texto(contenido)

    if productos:
        procesador.generar_json_productos()
        procesador.generar_archivo_difusion()
        print("\n🎉 Proceso terminado con éxito")
    else:
        print("⚠️ No se extrajeron productos. Revisá el formato del archivo.")


if __name__ == "__main__":
    main()
