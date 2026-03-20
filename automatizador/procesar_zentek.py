#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Procesador de precios específico para Zentek BA
Formula: (precio_costo / 0.90) + $25 USD, redondeado a múltiplo de 5
"""

import re
import os
import json
import math
from datetime import datetime


class ProcesadorZentek:
    def __init__(self):
        self.productos_extraidos = []
        self.precio_regex = r'^(.+?)(?:\s+|-|\t)+\$(\d+(?:\.\d+)?)(?:\s*.*)?$'

    # ──────────────────────────────────────────
    # CATEGORIZACIÓN
    # ──────────────────────────────────────────

    def normalizar_categoria(self, categoria_raw):
        """Devuelve (categoria_final, brand) dado un header de categoría."""
        cat = categoria_raw.upper().strip()
        # Limpiar símbolos/emojis
        cat = re.sub(r'[^\w\s/\-]', ' ', cat)
        cat = re.sub(r'\s+', ' ', cat).strip()

        # Celulares por marca
        if "SAMSUNG" in cat:
            return "Celulares", "Samsung"
        if "XIAOMI" in cat:
            return "Celulares", "Xiaomi"
        if "MOTOROLA" in cat:
            return "Celulares", "Motorola"
        if "IPHONE" in cat:
            return "Celulares", "iPhone"

        # Apple ecosystem
        if "MACBOOK" in cat or "MAC BOOK" in cat:
            return "Notebooks & Macbooks", "Apple"
        if "MAC MINI" in cat or "IMAC" in cat or "MAC STUDIO" in cat:
            return "Desktop / PC de Escritorio", "Apple"
        if "IPAD" in cat:
            return "Tablets & Ipads", "Apple"
        if "AIRPODS" in cat or "AIR PODS" in cat:
            return "AirPods", "Apple"
        if "WATCH" in cat or "SERIES" in cat:
            return "Smartwatch", "Apple"
        if "PENCIL" in cat or "AIRTAG" in cat or "ACCESORIOS" in cat:
            return "Accesorios", "Apple"

        # Líneas Samsung (ej: "LÍNEA S26", "LÍNEA S25")
        if re.search(r'\bL[IÍ]NEA\b', cat) or re.search(r'\bS\d{2}\b', cat):
            return "Celulares", "Samsung"

        # Periféricos
        if "KEYBOARD" in cat or "TECLADO" in cat:
            return "Teclados", None
        if "MOUSE" in cat or "TRACKPAD" in cat:
            return "Mouse", None

        # Lentes
        if "RAYBAN" in cat or "RAY-BAN" in cat or "RAY BAN" in cat:
            return "Lentes", None

        return cat.title(), None

    def recategorizar_por_nombre(self, nombre_upper, categoria_actual, brand_actual):
        """
        Ajusta categoría y brand basándose en el nombre del producto.
        Tiene prioridad sobre el header de categoría.
        Retorna (categoria, brand).
        """
        # Desktop
        if "IMAC" in nombre_upper or "MAC MINI" in nombre_upper or "MAC STUDIO" in nombre_upper:
            return "Desktop / PC de Escritorio", "Apple"
        # Notebooks
        if "MACBOOK" in nombre_upper:
            return "Notebooks & Macbooks", "Apple"
        # Teclados (antes de IPAD para que "Magic Keyboard Ipad Air" → Teclados)
        if "MAGIC KEYBOARD" in nombre_upper:
            return "Teclados", "Apple"
        # Mouse
        if "MAGIC MOUSE" in nombre_upper or "MAGIC TRACKPAD" in nombre_upper:
            return "Mouse", "Apple"
        # Tablets
        if re.search(r'IPAD|TABLET|\bTAB\b|\bPAD\b', nombre_upper):
            return "Tablets & Ipads", "Apple"

        # AirPods
        if "AIRPODS" in nombre_upper or "AIR PODS" in nombre_upper:
            return "AirPods", "Apple"
        # Smartwatch
        if re.search(r'\bSERIES\b|\bWATCH\b|\bMILANESE\b', nombre_upper):
            return "Smartwatch", "Apple"
        # Accesorios Apple (AIRTAG y AIRTAGS, con o sin S)
        if re.search(r'\bPENCIL\b|\bAIRTAGS?\b|\bAIR TAG\b|\bMAGSAFE\b', nombre_upper):
            return "Accesorios", "Apple"
        # Lentes
        if "RAY-BAN" in nombre_upper or "RAYBAN" in nombre_upper or "META WAYFARER" in nombre_upper or "META HEADLINER" in nombre_upper:
            return "Lentes", None

        return categoria_actual, brand_actual

    # ──────────────────────────────────────────
    # PRECIO
    # ──────────────────────────────────────────

    def calcular_precio_venta(self, precio_costo):
        """Formula: (precio_costo / 0.90) + $25 USD, redondeado a múltiplo de 5."""
        try:
            if isinstance(precio_costo, str):
                precio_costo = float(precio_costo.replace(',', '.'))
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
        respetando excepciones técnicas (GB, TB, SSD, 5G, etc.).
        """
        # Eliminar emojis y símbolos decorativos en cualquier posicion
        nombre_final = re.sub(r'[^\w\s\+\-\.\,\/\(\)\&\'\"]', '', nombre).strip()
        nombre_final = " ".join(nombre_final.split()) # Limpia espacios extras

        # Agregar marca al frente si no la tiene
        if brand:
            ya_tiene_marca = nombre_final.lower().startswith(brand.lower())
            # Para Apple: no agregar si el producto ya menciona el producto Apple
            if brand == "Apple":
                keywords_apple = ["iphone", "ipad", "macbook", "airpods", "imac",
                                  "mac mini", "magsafe", "airtag", "pencil", "apple"]
                ya_tiene_marca = any(kw in nombre_final.lower() for kw in keywords_apple)
            if not ya_tiene_marca:
                nombre_final = f"{brand} {nombre_final}"

        # Title Case con excepciones técnicas (comparación EXACTA, no substring)
        excepciones_upper = {"GB", "TB", "SSD", "RAM", "5G", "4G", "LTE",
                             "M3", "M4", "M5", "GPS", "USB-C", "USB", "DS"}
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
        if "LENTES" in cat:                          return "🕶️"
        if "ACCESORIOS" in cat:                      return "🔌"
        if "TECLADO" in cat:                         return "⌨️"
        if "MOUSE" in cat:                           return "🖱️"
        return "📦"

    # ──────────────────────────────────────────
    # EXTRACCIÓN
    # ──────────────────────────────────────────

    # Patrones de líneas a ignorar completamente (no son productos ni categorías)
    # Regex para strip del prefijo WhatsApp: "[10:53, 17/3/2026] Zentek BA: "
    WA_PREFIX_RE = re.compile(r'^\[?\d{1,2}:\d{2}[^\]]*\]\s*[^:]+:\s*')

    IGNORE_PATTERNS = [
        r'RECORDATORIO',
        r'GARANT[IÍ]A\s+OFICIAL',
        r'BILLETES?\s+ROTOS?',
        r'BILLETES?\s+(ESCRITOS?|MANCHADOS?)',
        r'BILLETES?\s+CARA\s+CHICA',
        r'NO\s+ACEPTO',
        r'RECIBIMOS\s+USDT',
        r'CON\s+LA\s+COMPRA\s+DE',
        r'CONSULTAR\s+POR',
        r'ACEPTAMOS',
        r'^[▪•]\s*$',                               # Bullets vacíos
        r'^[▪•]\s*(GARANT[IÍ]A|RECIBIMOS|BILLETES)',  # Bullets con texto de condiciones
    ]

    def debe_ignorar(self, linea: str) -> bool:
        """Devuelve True si la línea es ruido (condiciones, avisos, timestamps)."""
        linea_up = linea.upper()
        for pat in self.IGNORE_PATTERNS:
            if re.search(pat, linea_up, re.UNICODE):
                return True
        return False

    def extraer_productos_del_texto(self, texto_completo):
        """Extrae productos y precios del texto de Zentek."""
        print(f"🔍 Procesando texto de Zentek BA ({len(texto_completo)} caracteres)...")

        lineas = texto_completo.split('\n')
        categoria_actual = "Celulares"
        brand_actual = "iPhone"  # default: primera sección suele ser iPhones

        for linea in lineas:
            linea = linea.strip()

            if not linea:
                continue

            # Stripear prefijo WhatsApp: "[10:53, 17/3/2026] Zentek BA: "
            stripped = self.WA_PREFIX_RE.sub('', linea).strip()
            if stripped:
                linea = stripped

            if not linea:
                continue

            # Ignorar líneas de ruido (condiciones, avisos)
            if self.debe_ignorar(linea):
                continue

            # ── Detectar header de categoría ──
            es_categoria = (
                (linea.startswith('▶️') and linea.endswith('◀️')) or
                linea.startswith('Lista Actualizada') or
                linea.startswith('Línea') or
                linea.startswith('CHIP') or
                (linea.isupper() and '$' not in linea and len(linea) < 45) or
                "---" in linea or
                "💣🧨" in linea or
                "❗🚨" in linea
            )

            if es_categoria:
                if "---" in linea:
                    continue
                cat, brand = self.normalizar_categoria(linea)
                if cat:
                    categoria_actual = cat
                    brand_actual = brand
                    print(f"   📂 Categoría: {categoria_actual}" + (f" [{brand_actual}]" if brand_actual else ""))
                continue

            # ── Detectar producto con precio ──
            match = re.search(self.precio_regex, linea)
            if not match:
                continue

            producto_raw = match.group(1).strip()
            precio_costo = float(match.group(2))

            # Limpiar emojis del nombre
            producto = re.sub(r'[^\x00-\x7F\wáéíóúÁÉÍÓÚñÑüÜ\s/\-\.\(\)\"\']', '', producto_raw).strip()
            if not producto or len(producto) < 3:
                continue

            # Re-categorizar según el nombre del producto
            nombre_upper = producto.upper()
            cat_final, brand_final = self.recategorizar_por_nombre(nombre_upper, categoria_actual, brand_actual)

            # Formatear nombre con marca
            producto = self.formatear_nombre_producto(producto, brand_final)

            precio_venta = self.calcular_precio_venta(precio_costo)
            if precio_venta:
                self.productos_extraidos.append({
                    'producto': producto,
                    'precio_costo': precio_costo,
                    'precio_venta': precio_venta,
                    'categoria': cat_final,
                    'proveedor': 'Zentek',
                })
                print(f"   ✅ {producto}: ${precio_costo} → ${precio_venta}  [{cat_final}]")

        print(f"   📊 Total productos extraídos: {len(self.productos_extraidos)}")
        return self.productos_extraidos

    # ──────────────────────────────────────────
    # JSON
    # ──────────────────────────────────────────

    def generar_json_productos(self, archivo_salida="../app/public/productos_zentek.json"):
        """Genera JSON público con TODOS los productos + actualiza el consolidado."""
        try:
            os.makedirs(os.path.dirname(os.path.abspath(archivo_salida)), exist_ok=True)

            # JSON público (todos los productos Zentek)
            estructura_publica = {
                "metadatos": {
                    "ultima_actualizacion": datetime.now().strftime("%d/%m/%Y %H:%M"),
                    "proveedor": "Zentek",
                    "total_productos": len(self.productos_extraidos),
                },
                "productos": [
                    {
                        "nombre": p['producto'],
                        "precio": p['precio_venta'],
                        "precio_costo": p['precio_costo'],
                        "categoria": p['categoria'],
                        "proveedor": "Zentek",
                    }
                    for p in self.productos_extraidos
                ]
            }

            with open(archivo_salida, 'w', encoding='utf-8') as f:
                json.dump(estructura_publica, f, indent=2, ensure_ascii=False)
            print(f"✅ JSON Zentek: {archivo_salida} ({len(self.productos_extraidos)} productos)")

            # Actualizar consolidado
            archivo_privado = "productos_ram_completo.json"
            estructura_completa = {"metadatos": {}, "productos": []}

            if os.path.exists(archivo_privado):
                try:
                    with open(archivo_privado, 'r', encoding='utf-8') as f:
                        estructura_completa = json.load(f)
                    # Normalizar si fuera dict de categorías
                    if isinstance(estructura_completa.get('productos'), dict):
                        lista_plana = []
                        for cat_prods in estructura_completa['productos'].values():
                            lista_plana.extend(cat_prods)
                        estructura_completa['productos'] = lista_plana
                except Exception as e:
                    print(f"⚠️ Error cargando consolidado: {e}")

            # Quitar productos anteriores de Zentek (cualquier variante del nombre)
            otros = [p for p in estructura_completa.get('productos', [])
                     if p.get('proveedor', '').lower().replace(' ', '') not in ('zentek', 'zentekba')]
            nuevos = [
                {
                    "nombre": p['producto'],
                    "precio": p['precio_venta'],
                    "precio_costo": p['precio_costo'],
                    "categoria": p['categoria'],
                    "proveedor": "Zentek",
                    "fecha_actualizacion": datetime.now().strftime("%d/%m/%Y %H:%M"),
                }
                for p in self.productos_extraidos
            ]

            estructura_completa['productos'] = otros + nuevos
            estructura_completa['metadatos'].update({
                "ultima_actualizacion": datetime.now().strftime("%d/%m/%Y %H:%M"),
                "productos_zentek": len(nuevos),
                "total_productos": len(estructura_completa['productos']),
            })

            with open(archivo_privado, 'w', encoding='utf-8') as f:
                json.dump(estructura_completa, f, indent=2, ensure_ascii=False)
            print(f"✅ Consolidado actualizado: {len(nuevos)} productos Zentek")
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
            archivo = f"output/difusion_zentek_{fecha}.txt"

            categorias = {}
            for p in self.productos_extraidos:
                categorias.setdefault(p['categoria'], []).append(p)

            with open(archivo, 'w', encoding='utf-8') as f:
                f.write(f"🚀 ZENTEK BA — LISTA RAM INFORMÁTICA {datetime.now().strftime('%d/%m/%Y')} 🚀\n")
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
    print("🚀 PROCESADOR ZENTEK BA")
    print("-" * 30)

    procesador = ProcesadorZentek()
    archivo_entrada = "output/lista_zentek.txt"

    if not os.path.exists(archivo_entrada):
        print(f"❌ No se encontró: {archivo_entrada}")
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
        print("⚠️ No se extrajeron productos")


if __name__ == "__main__":
    main()
