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

class ProcesadorZentekBA:
    def __init__(self):
        self.productos_extraidos = []
        # Regex para capturar nombre y precio: "Producto... $Precio"
        # Soporta separadores por tabs, espacios, guiones y símbolos al final como flamitas
        self.precio_regex = r'^(.+?)(?:\s+|-|\t)+\$(\d+(?:\.\d+)?)(?:\s*.*)?$'
    
    def normalizar_categoria(self, categoria_raw):
        """
        Normalizar categorías según las reglas de negocio de Zentek BA
        """
        categoria = categoria_raw.upper().strip()
        
        # Limpiar símbolos comunes en Zentek
        categoria = re.sub(r'[▶️◀️🔥💣🧨❗🚨✏️⌨️⌚🎧🕶️🆕]', '', categoria).strip()
        
        if "SAMSUNG" in categoria:
            return "CELULARES SAMSUNG"
        elif "XIAOMI" in categoria:
            return "CELULARES XIAOMI"
        elif "MOTOROLA" in categoria:
            return "CELULARES MOTOROLA"
        elif "IPHONE" in categoria:
            return "CELULARES IPHONE NEW"
        elif "MACBOOK" in categoria or "MAC BOOK" in categoria:
            return "Notebooks & Macbooks"
        elif "MAC MINI" in categoria or "IMAC" in categoria:
            return "PC de Escritorio"
        elif "IPAD" in categoria:
            return "Tablets & Ipads"
        elif "AIRPODS" in categoria or "AIR PODS" in categoria:
            return "AirPods"
        elif "WATCH" in categoria or "SERIES" in categoria:
            return "Smartwatch"
        elif "KEYBOARD" in categoria or "TECLADO" in categoria:
            return "Teclados"
        elif "AIRTAG" in categoria or "PENCIL" in categoria or "ACCESORIOS" in categoria:
            return "Accesorios"
        elif "RAYBAN" in categoria or "RAY-BAN" in categoria:
            return "RAY-BAN META"
        return categoria
    
    def obtener_icono_categoria(self, categoria):
        """Obtener el icono apropiado para cada categoría"""
        cat_upper = categoria.upper()
        
        if "PC DE ESCRITORIO" in cat_upper:
            return "🖥️"
        elif "NOTEBOOKS" in cat_upper:
            return "💻"
        elif "SMARTWATCH" in cat_upper:
            return "⌚"
        elif "AIRPODS" in cat_upper:
            return "🎧"
        elif "TABLETS" in cat_upper:
            return "📱"
        elif "CELULAR" in cat_upper or "IPHONE" in cat_upper:
            return "📱"
        elif "RAY-BAN" in cat_upper:
            return "🕶️"
        elif "ACCESORIOS" in cat_upper:
            return "🔌"
        elif "TECLADOS" in cat_upper:
            return "⌨️"
        else:
            return "📱"

    def calcular_precio_venta(self, precio_costo):
        """
        Formula: (precio_costo / 0.90) + $25 USD, redondeado a múltiplo de 5
        """
        try:
            if isinstance(precio_costo, str):
                precio_costo = float(precio_costo.replace(',', '.'))
            
            # Margen del 10% (dividir por 0.9)
            precio_con_margen = precio_costo / 0.9
            
            # Sumar $25 USD
            precio_con_extras = precio_con_margen + 25
            
            # Redondear al múltiplo de 5 más cercano
            precio_final = round(precio_con_extras / 5) * 5
            
            return int(precio_final)
            
        except Exception as e:
            print(f"⚠️ Error calculando precio para {precio_costo}: {e}")
            return None

    def formatear_nombre_producto(self, nombre, categoria):
        """
        Formatear nombre del producto:
        - Agregar marca al inicio si no la tiene
        - Capitalizar palabras (Title Case)
        - Mantener en mayúsculas unidades como GB, TB, SSD, etc.
        """
        # 1. Determinar prefijo según categoría
        prefix = ""
        cat = categoria.upper()
        if "SAMSUNG" in cat: prefix = "Samsung"
        elif "XIAOMI" in cat: prefix = "Xiaomi"
        elif "MOTOROLA" in cat: prefix = "Motorola"
        elif "IPHONE" in cat: prefix = "iPhone"
        elif any(kw in cat for kw in ["IPAD", "TABLETS", "AIRPODS", "SMARTWATCH", "NOTEBOOK", "MACBOOK", "PC DE ESCRITORIO", "APPLE"]):
            prefix = "Apple"
        
        # 2. Agregar prefijo si no existe y no es redundante (evitar "Apple iPhone" o "Apple Ipad")
        nombre_final = nombre.strip()
        if prefix:
            # Si el nombre ya contiene el prefijo o la palabra clave principal de marca (como iPhone o iPad)
            # no agregamos el prefijo Apple para evitar redundancia
            ya_tiene = nombre_final.lower().startswith(prefix.lower())
            
            # Caso especial para Apple: No agregar si el producto ya dice iPad, iPhone, MacBook, etc.
            if prefix == "Apple":
                keywords_apple = ["iphone", "ipad", "macbook", "airpods", "imac", "mac mini", "magsafe", "airtag", "pencil"]
                if any(kw in nombre_final.lower() for kw in keywords_apple):
                    ya_tiene = True
            
            if not ya_tiene:
                nombre_final = f"{prefix} {nombre_final}"
        
        # 3. Capitalizar respetando excepciones
        palabras = nombre_final.split()
        nuevas_palabras = []
        
        for pal in palabras:
            # Limpiar para verificar si es una unidad
            pal_upper = pal.upper().replace("/", "").replace("(", "").replace(")", "")
            
            excepciones = ["GB", "TB", "SSD", "RAM", "DS", "5G", "4G", "LTE", "M3", "M4", "M5"]
            
            es_excepcion = any(ex in pal_upper for ex in excepciones) or pal_upper == "I" or pal_upper == "II"
            
            if es_excepcion:
                # Si contiene una excepción, la dejamos en mayúsculas
                # pero mantenemos los caracteres especiales (/, (, etc)
                nuevas_palabras.append(pal.upper())
            else:
                # Capitalizar normal
                if len(pal) > 1:
                    nuevas_palabras.append(pal[0].upper() + pal[1:].lower())
                else:
                    nuevas_palabras.append(pal.upper())
                    
        return " ".join(nuevas_palabras)

    def extraer_productos_del_texto(self, texto_completo):
        """Extraer productos y precios del texto de Zentek BA"""
        try:
            print(f"🔍 Procesando texto de Zentek BA ({len(texto_completo)} caracteres)...")
            
            lineas = texto_completo.split('\n')
            categoria_actual = "PRODUCTOS"
            
            for linea in lineas:
                linea = linea.strip()
                
                if not linea or "Consultar por " in linea or "ACEPTAMOS" in linea:
                    continue
                
                # Detectar categorías
                # Formatos: ▶️ Samsung ◀️, Lista Actualizada de..., Línea S26 🔥, CHIP M3
                es_categoria = (
                    (linea.startswith('▶️') and linea.endswith('◀️')) or
                    linea.startswith('Lista Actualizada') or
                    linea.startswith('Línea') or
                    linea.startswith('CHIP') or
                    (linea.isupper() and '$' not in linea and len(linea) < 40) or
                    "---" in linea or
                    "💣🧨" in linea or
                    "❗🚨" in linea
                )
                
                if es_categoria:
                    if "---" in linea: continue # Ignorar separadores visuales simples
                    
                    categoria_limpia = self.normalizar_categoria(linea)
                    if categoria_limpia and categoria_limpia != categoria_actual:
                        categoria_actual = categoria_limpia
                        print(f"   📂 Categoría: {categoria_actual}")
                    continue
                
                # Buscar productos con precios
                match = re.search(self.precio_regex, linea)
                if match:
                    producto_raw = match.group(1).strip()
                    precio_costo = float(match.group(2))
                    
                    # Limpiar el nombre del producto (remover emojis iniciales raros)
                    producto = re.sub(r'^[💻📱🎧⌚✏️⌨️*•\s]+', '', producto_raw).strip()
                    
                    # --- RE-CATEGORIZACIÓN INTELIGENTE BASADA EN NOMBRE ---
                    nombre_upper = producto.upper()
                    if "MACBOOK" in nombre_upper:
                        categoria_actual = "Notebooks & Macbooks"
                    elif "SERIES" in nombre_upper or "WATCH" in nombre_upper or "MILANESE" in nombre_upper:
                        categoria_actual = "Smartwatch"
                    elif "AIRPODS" in nombre_upper or "AIR PODS" in nombre_upper:
                        categoria_actual = "AirPods"
                    elif "AIRTAG" in nombre_upper:
                        categoria_actual = "Accesorios"
                    elif "MAGIC KEYBOARD" in nombre_upper:
                        categoria_actual = "Teclados"
                    elif "IPAD" in nombre_upper:
                        categoria_actual = "Tablets & Ipads"
                    # -----------------------------------------------------

                    # Formatear nombre (Marca + Capitalización)
                    producto = self.formatear_nombre_producto(producto, categoria_actual)
                    
                    precio_venta = self.calcular_precio_venta(precio_costo)
                    
                    if precio_venta:
                        producto_info = {
                            'producto': producto,
                            'precio_costo': precio_costo,
                            'precio_venta': precio_venta,
                            'categoria': categoria_actual,
                            'proveedor': 'ZentekBA'
                        }
                        
                        self.productos_extraidos.append(producto_info)
                        print(f"   ✅ {producto}: ${precio_costo} → ${precio_venta}")
            
            print(f"   📊 Total productos extraídos: {len(self.productos_extraidos)}")
            return self.productos_extraidos
            
        except Exception as e:
            print(f"❌ Error extrayendo productos: {e}")
            return []

    def generar_json_zentek_filtrado(self, archivo_salida="../app/public/productos_zentek.json"):
        """Generar JSON filtrado solo con MacBooks, iPads y Ray-Bans"""
        try:
            categorias_permitidas = ["Notebooks & Macbooks", "Tablets & Ipads", "RAY-BAN META"]
            productos_filtrados = [p for p in self.productos_extraidos if p['categoria'] in categorias_permitidas]
            
            # Formato de salida compatible con el administrador (usando la misma estructura que productos_ram.json)
            final_data = {
                "metadatos": {
                    "ultima_actualizacion": datetime.now().strftime("%d/%m/%Y %H:%M"),
                    "proveedor": "ZentekBA",
                    "total_productos": len(productos_filtrados),
                    "categorias_incluidas": categorias_permitidas
                },
                "productos": []
            }
            
            for p in productos_filtrados:
                final_data["productos"].append({
                    "nombre": p['producto'],
                    "precio": p['precio_venta'],
                    "precio_costo": p['precio_costo'],
                    "categoria": p['categoria'],
                    "proveedor": "ZentekBA"
                })
                
            os.makedirs(os.path.dirname(archivo_salida), exist_ok=True)
            with open(archivo_salida, 'w', encoding='utf-8') as f:
                json.dump(final_data, f, indent=2, ensure_ascii=False)
                
            print(f"✅ Archivo filtrado generado: {archivo_salida} ({len(productos_filtrados)} productos)")
            return True
        except Exception as e:
            print(f"❌ Error generando JSON filtrado: {e}")
            return False

    def generar_json_productos(self, archivo_salida="../app/public/productos_zentek.json"):
        """Actualizar JSONs con los productos de Zentek BA"""
        try:
            archivo_publico = archivo_salida
            archivo_privado = "productos_ram_completo.json"
            
            # Cargar o inicializar estructuras
            def cargar_json(ruta):
                if os.path.exists(ruta):
                    with open(ruta, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        if isinstance(data.get('productos'), list):
                            # Convertir a dict para procesamiento fácil
                            dict_prod = {}
                            for p in data['productos']:
                                cat = p.get('categoria', 'OTROS')
                                if cat not in dict_prod: dict_prod[cat] = []
                                dict_prod[cat].append(p)
                            data['productos'] = dict_prod
                        return data
                return {"metadatos": {}, "productos": {}}

            est_pub = cargar_json(archivo_publico)
            est_priv = cargar_json(archivo_privado)

            # Limpiar productos anteriores de este proveedor
            for cat in est_pub["productos"]:
                est_pub["productos"][cat] = [p for p in est_pub["productos"][cat] if p.get('proveedor') != 'ZentekBA']
            for cat in est_priv["productos"]:
                est_priv["productos"][cat] = [p for p in est_priv["productos"][cat] if p.get('proveedor') != 'ZentekBA']

            # Agregar nuevos productos
            for p in self.productos_extraidos:
                cat = p['categoria']
                if cat not in est_pub["productos"]: est_pub["productos"][cat] = []
                if cat not in est_priv["productos"]: est_priv["productos"][cat] = []
                
                # Publico
                est_pub["productos"][cat].append({
                    "nombre": p['producto'],
                    "precio": p['precio_venta'],
                    "categoria": cat,
                    "proveedor": "ZentekBA"
                })
                
                # Privado
                est_priv["productos"][cat].append({
                    "nombre": p['producto'],
                    "precio": p['precio_venta'],
                    "precio_costo": p['precio_costo'],
                    "categoria": cat,
                    "proveedor": "ZentekBA",
                    "fecha_actualizacion": datetime.now().strftime("%d/%m/%Y %H:%M")
                })

            # Metadatos
            actualizacion = datetime.now().strftime("%d/%m/%Y %H:%M")
            est_pub["metadatos"]["ultima_actualizacion"] = actualizacion
            est_priv["metadatos"]["ultima_actualizacion"] = actualizacion
            est_priv["metadatos"]["productos_zentekba"] = len(self.productos_extraidos)

            # Guardar (como lista plana)
            def guardar_json(ruta, data):
                lista_prod = []
                for cat in data["productos"]:
                    lista_prod.extend(data["productos"][cat])
                
                final_data = {
                    "metadatos": data["metadatos"],
                    "productos": lista_prod
                }
                
                with open(ruta, 'w', encoding='utf-8') as f:
                    json.dump(final_data, f, indent=2, ensure_ascii=False)

            guardar_json(archivo_publico, est_pub)
            guardar_json(archivo_privado, est_priv)
            
            print(f"✅ JSONs actualizados con {len(self.productos_extraidos)} productos de Zentek BA")
            return True
        except Exception as e:
            print(f"❌ Error actualizando JSONs: {e}")
            return False

    def generar_archivo_difusion(self):
        """Generar archivo para compartir en WhatsApp"""
        try:
            os.makedirs("output", exist_ok=True)
            fecha = datetime.now().strftime("%d-%m-%Y")
            archivo = f"output/difusion_zentekba_{fecha}.txt"
            
            with open(archivo, 'w', encoding='utf-8') as f:
                f.write(f"🚀 ZENTEK BA - LISTA DE PRECIOS {datetime.now().strftime('%d/%m/%Y')} 🚀\n")
                f.write("=" * 40 + "\n\n")
                
                categorias = {}
                for p in self.productos_extraidos:
                    cat = p['categoria']
                    if cat not in categorias: categorias[cat] = []
                    categorias[cat].append(p)
                
                for cat, prods in categorias.items():
                    f.write(f"{self.obtener_icono_categoria(cat)} {cat}\n")
                    f.write("-" * 25 + "\n")
                    for p in prods:
                        f.write(f"• {p['producto']} - ${p['precio_venta']}\n")
                    f.write("\n")
                
                f.write("=" * 40 + "\n")
                f.write("💬 Consultas por privado\n")
            
            print(f"✅ Archivo de difusión Zentek BA: {archivo}")
            return True
        except Exception as e:
            print(f"❌ Error difusión: {e}")
            return False

def main():
    print("🚀 PROCESADOR ZENTEK BA")
    print("-" * 30)
    
    procesador = ProcesadorZentekBA()
    archivo_entrada = "output/lista_zentekba.txt"
    
    if not os.path.exists(archivo_entrada):
        print(f"❌ No se encontró: {archivo_entrada}")
        return
    
    with open(archivo_entrada, 'r', encoding='utf-8') as f:
        contenido = f.read()
    
    productos = procesador.extraer_productos_del_texto(contenido)
    
    if productos:
        procesador.generar_json_productos()
        procesador.generar_json_zentek_filtrado()
        procesador.generar_archivo_difusion()
        print("\n🎉 Proceso terminado con éxito")
    else:
        print("⚠️ No se extrajeron productos")

if __name__ == "__main__":
    main()
