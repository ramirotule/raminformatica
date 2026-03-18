#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Procesador de precios específico para Kadabra.

Formato esperado del mensaje de Kadabra:
  - Headers de categoría con emojis (ej: 📦 SAMSUNG, 📱 IPHONE)
  - Producto en una línea, precio en la siguiente (o en la misma)
  - Precios por cantidad: X1 $750 / X3 $720 / X5 $700
  - Solo se usa el precio X1 (compra unitaria)
  - Precios ya en USD (precio de costo directo)

Formula de venta: (precio_costo / 0.90) + $25 USD, redondeado a múltiplo de 5
"""

import re
import os
import json
from datetime import datetime


# Categorías reconocidas por keyword en el header
CATEGORIA_MAP = {
    "IPHONE": "Celulares",
    "SAMSUNG": "Celulares",
    "MOTOROLA": "Celulares",
    "XIAOMI": "Celulares",
    "INFINIX": "Celulares",
    "TECNO": "Celulares",
    "ITEL": "Celulares",
    "REALME": "Celulares",
    "REDMI": "Celulares",
    "MACBOOK": "Notebooks & Macbooks",
    "NOTEBOOK": "Notebooks & Macbooks",
    "LAPTOP": "Notebooks & Macbooks",
    "IMAC": "Desktop / PC de Escritorio",
    "MAC MINI": "Desktop / PC de Escritorio",
    "MAC STUDIO": "Desktop / PC de Escritorio",
    "IPAD": "Tablets & Ipads",
    "TABLET": "Tablets & Ipads",
    "AIRPODS": "AirPods",
    "WATCH": "Smartwatch",
    "SMARTWATCH": "Smartwatch",
    "PARLANTE": "Audio JBL",
    "JBL": "Audio JBL",
    "TV": "Televisores",
    "TELEVISOR": "Televisores",
    "PLAYSTATION": "Video Juegos",
    "NINTENDO": "Video Juegos",
    "XBOX": "Video Juegos",
    "CARGADOR": "Cargadores",
    "AURICULAR": "Audio JBL",
    "ACCESORIOS": "Accesorios",
    "MOUSE": "Mouse",
    "TECLADO": "Teclados",
    "GARMIN": "Smartwatch",
}

# Líneas que indican que son headers o separadores, no productos
HEADER_KEYWORDS = [
    "LISTA", "PRECIO", "ACTUALIZADA", "BIENVENIDOS", "CONSULTAR", "DISPONIBILIDAD",
    "MAYORISTA", "MINORISTA", "TRANSFERENCIA", "EFECTIVO", "CREDITO", "DEBITO",
    "WHATSAPP", "INSTAGRAM", "TELEFONO", "CONTACTO", "HORARIO", "LOCAL",
    "ENTREGA", "ENVIO", "PAGO", "CONDICIONES", "INFO", "NOTA", "AVISO",
]


class ProcesadorKadabra:
    def __init__(self):
        self.productos_extraidos = []

    def normalizar_categoria(self, linea: str) -> str | None:
        """
        Detecta si la línea es un header de categoría y devuelve la categoría normalizada.
        Devuelve None si no es un header.
        """
        texto = re.sub(r'[^\w\s]', ' ', linea).upper().strip()
        texto = re.sub(r'\s+', ' ', texto)

        # Si contiene palabras de encabezado no relacionadas a productos, ignorar
        for kw in HEADER_KEYWORDS:
            if kw in texto.split():
                return None  # Es info general, no categoría de producto

        # Multi-palabra primero (para evitar que "MAC" en "MACBOOK" matchee "MAC MINI")
        if 'MAC MINI' in texto or 'MAC STUDIO' in texto:
            return 'Desktop / PC de Escritorio'
        if 'MAGIC KEYBOARD' in texto:
            return 'Teclados'
        if 'MAGIC MOUSE' in texto or 'MAGIC TRACKPAD' in texto:
            return 'Mouse'
        if 'AIR PODS' in texto:
            return 'AirPods'

        for keyword, categoria in CATEGORIA_MAP.items():
            if re.search(r'\b' + re.escape(keyword) + r'\b', texto):
                return categoria

        return None

    def calcular_precio_venta(self, precio_costo: float) -> int:
        """Formula: (precio_costo / 0.90) + $25 USD, redondeado a múltiplo de 5."""
        try:
            precio = (precio_costo / 0.9) + 25
            return int(round(precio / 5) * 5)
        except Exception:
            return None

    def extraer_precio_x1(self, texto: str) -> float | None:
        """
        Extrae el precio X1 de una cadena que puede tener formato:
          - X1 $750 / X3 $720 / X5 $700
          - x1: $750 | x3: $720
          - $750 (precio único sin tiers)
          - USD 750
          - 750 USD
        """
        # Patrón: x1 seguido de precio (el más prioritario)
        m = re.search(r'[xX]1\s*[:\-]?\s*\$?\s*(\d+(?:[.,]\d+)?)', texto)
        if m:
            return float(m.group(1).replace(',', '.'))

        # Precio único (sin tiers) — solo $NÚMERO o USD NÚMERO o NÚMERO USD
        m = re.search(r'\$\s*(\d+(?:[.,]\d+)?)', texto)
        if m:
            # Verificar que no haya x3 o x5 ANTES de este precio (para no tomar el primero de una serie sin x1)
            precio_idx = m.start()
            antes = texto[:precio_idx]
            if re.search(r'[xX][35]', antes):
                return None  # Hay tiers pero no tiene x1 explícito
            return float(m.group(1).replace(',', '.'))

        # USD NÚMERO o NÚMERO USD
        m = re.search(r'(?:USD|U\$S|U\$D)\s*(\d+)', texto, re.IGNORECASE)
        if m:
            return float(m.group(1))

        m = re.search(r'(\d+)\s*(?:USD|U\$S|U\$D)', texto, re.IGNORECASE)
        if m:
            return float(m.group(1))

        return None

    def es_linea_de_precio(self, linea: str) -> bool:
        """Devuelve True si la línea es principalmente una línea de precios."""
        return bool(re.search(
            r'[xX][135]|USD|U\$S|\$\s*\d+|precio|costo',
            linea, re.IGNORECASE
        ))

    def limpiar_nombre_producto(self, nombre: str) -> str:
        """Limpia emojis y caracteres raros del nombre (en cualquier posición)."""
        # Quitar emojis suplementarios (U+10000–U+10FFFF)
        nombre = re.sub(r'[\U00010000-\U0010ffff]', '', nombre)
        # Quitar emojis del plano básico (U+2000–U+27BF, U+2B00–U+2BFF, U+FE00–U+FEFF)
        nombre = re.sub(r'[\u2000-\u27BF\u2B00-\u2BFF\uFE00-\uFEFF]', '', nombre)
        # Quitar variantes de emoji y símbolos misceláneos
        nombre = re.sub(r'[\u2600-\u26FF\u2700-\u27BF]', '', nombre)
        # Quitar caracteres especiales de decoración (flechas, bullets, etc.)
        nombre = re.sub(r'[✅❌⚠️🔹🔸►▶→•\*]', '', nombre)
        # Quitar cualquier carácter no ASCII que quede al inicio/final
        nombre = re.sub(r'^[^\x00-\x7F\wáéíóúÁÉÍÓÚñÑüÜ]+', '', nombre)
        nombre = re.sub(r'\s+', ' ', nombre).strip()
        return nombre

    def formatear_nombre(self, nombre: str, categoria: str) -> str:
        """Title case respetando excepciones técnicas (GB, TB, 5G, etc.)."""
        excepciones_upper = {"GB", "TB", "SSD", "RAM", "5G", "4G", "LTE", "M3", "M4", "M5", "GPS", "USB-C", "USB"}
        palabras = nombre.split()
        resultado = []
        for pal in palabras:
            pal_up = pal.upper()
            # Comparación exacta contra excepciones
            pal_check = pal_up.replace('/', '').replace('(', '').replace(')', '')
            if pal_check in excepciones_upper:
                resultado.append(pal_up)
            # Palabras con dígitos que terminan en unidad técnica: "256GB", "8/256GB", "20W", "USB-C"
            elif re.search(r'\d', pal) and re.search(r'(?:GB|TB|MB|GHZ|MHZ|W|NM)$', pal_up):
                resultado.append(pal_up)
            elif len(pal) > 1:
                resultado.append(pal[0].upper() + pal[1:].lower())
            else:
                resultado.append(pal_up)
        return ' '.join(resultado)

    def recategorizar_por_nombre(self, nombre: str, categoria_actual: str) -> str:
        """Ajusta la categoría basándose en el nombre del producto (tiene prioridad sobre el header)."""
        nu = nombre.upper()

        # Desktop / PC de Escritorio
        if 'IMAC' in nu or 'MAC MINI' in nu or 'MAC STUDIO' in nu:
            return 'Desktop / PC de Escritorio'

        # Notebooks
        if 'MACBOOK' in nu:
            return 'Notebooks & Macbooks'

        # Tablets
        if 'IPAD' in nu:
            return 'Tablets & Ipads'

        # AirPods
        if 'AIRPODS' in nu or 'AIR PODS' in nu:
            return 'AirPods'

        # Smartwatch
        if re.search(r'\bWATCH\b|\bSERIES\b|\bMILANESE\b|\bGARMIN\b|\bFENIX\b|\bFOREATHLETE\b|\bFORErunner\b', nu):
            return 'Smartwatch'

        # Teclados
        if 'MAGIC KEYBOARD' in nu or 'TECLADO' in nu:
            return 'Teclados'

        # Mouse
        if 'MAGIC MOUSE' in nu or 'MAGIC TRACKPAD' in nu:
            return 'Mouse'

        # Cargadores
        if re.search(r'CARGADOR|ADAPTADOR|CHARGER', nu):
            return 'Cargadores'

        # Accesorios Apple (Pencil, AirTag, etc.)
        if re.search(r'PENCIL|AIRTAG|AIR TAG', nu):
            return 'Accesorios'

        return categoria_actual

    def extraer_productos_del_texto(self, texto_completo: str) -> list:
        """
        Parsea el texto de Kadabra y extrae productos con precios X1.

        Soporta dos formatos principales:
          1. Producto y precio en la misma línea:
             "Samsung Galaxy S25 8/256 GB  X1 $750 / X3 $720"
          2. Producto en una línea, precio en la siguiente:
             "Samsung Galaxy S25 8/256 GB"
             "X1 $750 / X3 $720 / X5 $700"
        """
        print(f"🔍 Procesando texto de Kadabra ({len(texto_completo)} caracteres)...")

        lineas = [l.strip() for l in texto_completo.split('\n')]
        categoria_actual = "Celulares"  # default
        i = 0

        while i < len(lineas):
            linea = lineas[i]

            if not linea or len(linea) < 3:
                i += 1
                continue

            # ── Detectar header de categoría ──
            # Una línea es header si: matchea categoría, no tiene precio, Y cumple al menos uno de:
            #   a) Empieza con emoji/símbolo (carácter no alfanumérico ASCII)
            #   b) Es corta (< 45 chars) y no contiene "GB" ni "/" (no parece un producto)
            cat = self.normalizar_categoria(linea)
            primer_char_es_simbolo = linea and not linea[0].isascii() or (linea and not linea[0].isalnum())
            parece_header = (
                cat and
                not self.extraer_precio_x1(linea) and
                (
                    primer_char_es_simbolo or
                    (len(linea) < 45 and 'GB' not in linea.upper() and '/' not in linea)
                )
            )
            if parece_header:
                categoria_actual = cat
                print(f"   📂 Categoría: {categoria_actual} (de: {linea[:50]})")
                i += 1
                continue

            # ── Intentar extracción en la misma línea ──
            precio_inline = self.extraer_precio_x1(linea)

            if precio_inline:
                # La línea tiene precio: separar nombre del precio
                nombre_raw = self._separar_nombre_de_precio(linea)
                if nombre_raw and len(nombre_raw) >= 5:
                    nombre = self.limpiar_nombre_producto(nombre_raw)
                    nombre = self.formatear_nombre(nombre, categoria_actual)
                    cat_final = self.recategorizar_por_nombre(nombre, categoria_actual)
                    precio_venta = self.calcular_precio_venta(precio_inline)
                    if precio_venta:
                        self._agregar_producto(nombre, precio_inline, precio_venta, cat_final)
                i += 1
                continue

            # ── Línea de solo nombre: buscar precio en la siguiente ──
            nombre_candidato = self.limpiar_nombre_producto(linea)
            if len(nombre_candidato) < 5:
                i += 1
                continue

            # Buscar la línea de precio en las siguientes 1-2 líneas
            precio_encontrado = None
            lineas_consumidas = 1

            for j in range(i + 1, min(i + 3, len(lineas))):
                siguiente = lineas[j].strip()
                if not siguiente:
                    continue
                precio = self.extraer_precio_x1(siguiente)
                if precio:
                    precio_encontrado = precio
                    lineas_consumidas = j - i + 1
                    break
                # Si la siguiente línea tampoco tiene precio y tampoco parece un nombre, parar
                if not self.es_linea_de_precio(siguiente) and len(siguiente) > 3:
                    break  # Probablemente es otro producto

            if precio_encontrado:
                nombre = self.formatear_nombre(nombre_candidato, categoria_actual)
                cat_final = self.recategorizar_por_nombre(nombre, categoria_actual)
                precio_venta = self.calcular_precio_venta(precio_encontrado)
                if precio_venta:
                    self._agregar_producto(nombre, precio_encontrado, precio_venta, cat_final)
                i += lineas_consumidas
            else:
                # No encontramos precio: podría ser un header o info
                i += 1

        print(f"   📊 Total productos extraídos: {len(self.productos_extraidos)}")
        return self.productos_extraidos

    def _separar_nombre_de_precio(self, linea: str) -> str | None:
        """
        Dado una línea que contiene nombre + precio, extrae solo el nombre.
        Estrategia: el nombre está antes del primer indicador de precio.
        """
        # Buscar posición del primer marcador de precio
        patrones_precio = [
            r'[xX]1\s*[:\-]?\s*\$',    # X1 $
            r'\$\s*\d+',                 # $750
            r'USD\s*\d+',                # USD 750
            r'\d+\s*USD',                # 750 USD
            r'U\$S\s*\d+',              # U$S 750
        ]

        primera_pos = len(linea)
        for patron in patrones_precio:
            m = re.search(patron, linea, re.IGNORECASE)
            if m and m.start() < primera_pos:
                primera_pos = m.start()

        if primera_pos == 0 or primera_pos == len(linea):
            return None

        nombre = linea[:primera_pos].strip()
        # Limpiar separadores al final
        nombre = nombre.rstrip('|-–:').strip()
        return nombre if len(nombre) >= 3 else None

    def _agregar_producto(self, nombre: str, precio_costo: float, precio_venta: int, categoria: str):
        """Agrega producto a la lista y loguea."""
        self.productos_extraidos.append({
            'producto': nombre,
            'precio_costo': precio_costo,
            'precio_venta': precio_venta,
            'categoria': categoria,
            'proveedor': 'Kadabra',
        })
        print(f"   ✅ {nombre}: ${precio_costo} → ${precio_venta} ({categoria})")

    def generar_json_productos(self, archivo_salida="../app/public/productos_kadabra.json"):
        """Genera JSON público + actualiza el consolidado productos_ram_completo.json."""
        try:
            os.makedirs(os.path.dirname(os.path.abspath(archivo_salida)), exist_ok=True)

            # JSON específico Kadabra
            estructura_publica = {
                "metadatos": {
                    "ultima_actualizacion": datetime.now().strftime("%d/%m/%Y %H:%M"),
                    "total_productos": len(self.productos_extraidos),
                    "proveedor": "Kadabra"
                },
                "productos": [
                    {
                        "nombre": p['producto'],
                        "precio": p['precio_venta'],
                        "categoria": p['categoria'],
                        "proveedor": "Kadabra"
                    }
                    for p in self.productos_extraidos
                ]
            }

            with open(archivo_salida, 'w', encoding='utf-8') as f:
                json.dump(estructura_publica, f, indent=2, ensure_ascii=False)
            print(f"✅ JSON Kadabra: {archivo_salida}")

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

            # Filtrar productos anteriores de Kadabra
            otros = [p for p in estructura_completa.get('productos', []) if p.get('proveedor') != 'Kadabra']
            nuevos = [
                {
                    "nombre": p['producto'],
                    "precio": p['precio_venta'],
                    "precio_costo": p['precio_costo'],
                    "categoria": p['categoria'],
                    "proveedor": "Kadabra",
                    "fecha_actualizacion": datetime.now().strftime("%d/%m/%Y %H:%M")
                }
                for p in self.productos_extraidos
            ]

            estructura_completa['productos'] = otros + nuevos
            estructura_completa['metadatos'].update({
                "ultima_actualizacion": datetime.now().strftime("%d/%m/%Y %H:%M"),
                "productos_kadabra": len(nuevos),
                "total_productos": len(estructura_completa['productos'])
            })

            with open(archivo_privado, 'w', encoding='utf-8') as f:
                json.dump(estructura_completa, f, indent=2, ensure_ascii=False)
            print(f"✅ Consolidado actualizado: {len(nuevos)} productos Kadabra")
            return True

        except Exception as e:
            print(f"❌ Error generando JSON: {e}")
            return False

    def generar_archivo_difusion(self):
        """Genera archivo de difusión para WhatsApp."""
        try:
            os.makedirs("output", exist_ok=True)
            fecha = datetime.now().strftime("%d-%m-%Y")
            archivo = f"output/difusion_kadabra_{fecha}.txt"

            categorias = {}
            for p in self.productos_extraidos:
                categorias.setdefault(p['categoria'], []).append(p)

            with open(archivo, 'w', encoding='utf-8') as f:
                f.write(f"🔥 KADABRA — LISTA RAM INFORMÁTICA {datetime.now().strftime('%d/%m/%Y')} 🔥\n")
                f.write("=" * 50 + "\n\n")
                for cat, prods in categorias.items():
                    f.write(f"📱 {cat}\n")
                    f.write("-" * 30 + "\n")
                    for p in prods:
                        f.write(f"• {p['producto']} - ${p['precio_venta']}\n")
                    f.write("\n")
                f.write("=" * 50 + "\n")
                f.write("💬 Consultas y pedidos por WhatsApp\n")
                f.write(f"📅 Actualizado: {datetime.now().strftime('%d/%m/%Y %H:%M')}\n")

            print(f"✅ Difusión generada: {archivo}")
            return True
        except Exception as e:
            print(f"❌ Error difusión: {e}")
            return False


def main():
    print("🚀 PROCESANDO LISTA DE PRECIOS KADABRA")
    print("=" * 50)

    procesador = ProcesadorKadabra()
    archivo_entrada = "output/lista_kadabra.txt"

    if not os.path.exists(archivo_entrada):
        print(f"❌ No se encontró: {archivo_entrada}")
        print("   Guardá el texto de Kadabra en output/lista_kadabra.txt y volvé a ejecutar.")
        return False

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
        return False

    productos = procesador.extraer_productos_del_texto(contenido)

    if not productos:
        print("⚠️ No se encontraron productos. Revisá el formato del archivo.")
        return False

    print("\n📝 Generando archivos de salida...")
    procesador.generar_json_productos()
    procesador.generar_archivo_difusion()

    print(f"\n🎉 Completado: {len(productos)} productos de Kadabra procesados")
    return True


if __name__ == "__main__":
    main()
