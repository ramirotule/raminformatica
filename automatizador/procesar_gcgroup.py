#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Procesador de precios específico para GCGroup
Formula: (precio_costo + 10%) + $25 USD, redondeado a múltiplo de 5
"""

import re
import os
import json
import math
from datetime import datetime

class ProcesadorGCGroup:
    def __init__(self):
        self.productos_extraidos = []
        # Regex actualizado para el formato real: "PRODUCTO - $ PRECIO"
        self.precio_regex = r'^([^-]+)\s*-\s*\$\s*(\d+(?:\.\d+)?)\s*$'

    def normalizar_categoria(self, categoria_raw):
        """
        Normalizar categorías según las reglas de negocio de GCGroup
        """
        cat = categoria_raw.upper().strip()
        
        # Mapeo según requerimiento del usuario
        if any(brand in cat for brand in ["IPHONE", "SAMSUNG", "MOTOROLA", "INFINIX", "XIAOMI", "ITEL", "TECHNO"]):
            # Pero excluir específicamente tablets de Samsung/Xiaomi si vienen en esta categoría
            if "TABLETS" in cat:
                return "Tablets & Ipads"
            return "Celulares"
        elif "WATCH" in cat:
            return "Smartwatch"
        elif "TV" in cat or "TELEVISOR" in cat or "QLED" in cat or "ULED" in cat:
            return "Televisores"
        elif "PLAYSTATION" in cat or "VIDEO JUEGOS" in cat or "JOYSTICK" in cat or "VR2" in cat:
            return "Video Juegos"
        elif "CARGADOR" in cat or "POWER ADAPTER" in cat:
            return "Cargadores"
        elif "JBL" in cat or "PARLANTE" in cat or "AURICULAR" in cat:
            return "Audio JBL"
        elif "AIRPODS" in cat or "PENCIL" in cat:
            return "AirPods" # Se ajustará a 'Accesorios' para Pencils en el loop de productos
        elif "TABLET" in cat or "IPAD" in cat:
            return "Tablets & Ipads"
        elif "MACBOOK" in cat or "NOTEBOOK" in cat:
            return "Notebooks & Macbooks"
            
        return categoria_raw.strip()
    
    def obtener_icono_categoria(self, categoria):
        """Obtener el icono apropiado para cada categoría"""
        cat_upper = categoria.upper()
        
        if "TELEVISORES" in cat_upper:
            return "📺"
        elif "NOTEBOOKS" in cat_upper:
            return "💻"
        elif "SMARTWATCH" in cat_upper:
            return "⌚"
        elif "AIRPODS" in cat_upper:
            return "🎧"
        elif "VIDEO JUEGOS" in cat_upper:
            return "🕹️"
        elif "AUDIO JBL" in cat_upper:
            return "🎵"
        elif "TABLETS" in cat_upper:
            return "📱"
        elif "CELULARES" in cat_upper:
            return "📱"
        elif "CARGADORES" in cat_upper:
            return "🔌"
        elif "ACCESORIOS" in cat_upper:
            return "🔌"
        else:
            return "📱"
        
    def calcular_precio_venta(self, precio_costo):
        """
        Calcular precio de venta usando la fórmula:
        (precio_costo / 0.9) + $20 USD, redondeado a múltiplo de 5 (al más cercano)
        
        Equivalente a la fórmula Excel: =REDOND.MULT(precio_costo/0.9+20;5)
        """
        try:
            # Convertir a float si es string
            if isinstance(precio_costo, str):
                precio_costo = float(precio_costo.replace(',', '.'))
            
            # Aplicar fórmula: dividir por 0.9 (margen del 90% para el costo)
            precio_con_margen = precio_costo / 0.9
            
            # Sumar $20 USD extras
            precio_con_extras = precio_con_margen + 25
            
            # Redondear al múltiplo de 5 más cercano (como REDOND.MULT de Excel)
            precio_final = round(precio_con_extras / 5) * 5
            
            return int(precio_final)
            
        except Exception as e:
            print(f"⚠️ Error calculando precio para {precio_costo}: {e}")
            return None

    def formatear_nombre_producto(self, nombre, categoria):
        """
        Formatear nombre del producto:
        - Agregar marca si es necesario
        - Capitalizar palabras (Title Case)
        - Mantener unidades en mayúsculas
        """
        nombre_final = nombre.strip()
        
        # Prefijos según categoría
        prefix = ""
        cat = categoria.upper()
        if "SAMSUNG" in cat: prefix = "Samsung"
        elif "XIAOMI" in cat: prefix = "Xiaomi"
        elif "MOTOROLA" in cat: prefix = "Motorola"
        elif "IPHONE" in cat: prefix = "iPhone"
        
        if prefix and not nombre_final.lower().startswith(prefix.lower()):
            nombre_final = f"{prefix} {nombre_final}"
            
        palabras = nombre_final.split()
        nuevas_palabras = []
        for pal in palabras:
            pal_upper = pal.upper().replace("/", "").replace("(", "").replace(")", "")
            excepciones = ["GB", "TB", "SSD", "RAM", "DS", "5G", "4G", "LTE", "SIM", "ESIM"]
            if any(ex == pal_upper for ex in excepciones) or pal_upper.startswith("M") and len(pal_upper) <= 2:
                nuevas_palabras.append(pal.upper())
            else:
                if len(pal) > 1:
                    nuevas_palabras.append(pal[0].upper() + pal[1:].lower())
                else:
                    nuevas_palabras.append(pal.upper())
        return " ".join(nuevas_palabras)

    def extraer_productos_del_texto(self, texto_completo):
        """Extraer productos y precios del texto de GCGroup"""
        try:
            print(f"🔍 Procesando texto de {len(texto_completo)} caracteres...")
            
            # Detectar tipo de mensaje
            es_lista_precios = "LISTA DE PRECIOS" in texto_completo.upper()
            es_lista_disponibilidad = "LISTA DE MODELOS Y COLORES" in texto_completo.upper()
            
            if es_lista_disponibilidad:
                print("📋 Detectado: Lista de disponibilidad de modelos y colores")
                print("⚠️  Solo se procesarán productos que tengan precios explícitos")
            elif es_lista_precios:
                print("💰 Detectado: Lista de precios completa")
            else:
                print("📄 Tipo de mensaje no reconocido, procesando como lista general")
            
            # Dividir en líneas para procesar
            lineas = texto_completo.split('\n')
            categoria_actual = "PRODUCTOS"
            productos_sin_precio = 0
            
            for linea in lineas:
                linea = linea.strip()
                
                # Skip líneas vacías o de encabezado
                if not linea or linea.startswith('#') or linea.startswith('='):
                    continue
                    
                # Detectar y saltar líneas que son solo colores (ej: "BLACK / BLUE / GOLD")
                colores_lista = [
                    'BLACK', 'WHITE', 'BLUE', 'GREEN', 'YELLOW', 'PINK', 'RED', 'PURPLE', 'ORANGE', 
                    'GOLD', 'SILVER', 'GRAPHITE', 'SPACE GRAY', 'STARLIGHT', 'MIDNIGHT', 'DEEP PURPLE',
                    'NATURAL', 'TITANIUM', 'BLACK TITANIUM', 'WHITE TITANIUM', 'BLUE TITANIUM', 'NATURAL TITANIUM',
                    'SPACE BLACK', 'ALPINE GREEN', 'SIERRA BLUE', 'PACIFIC BLUE', 'SKY', 'MINT', 'CREAM', 
                    'LAVENDER', 'LILAC', 'PLATA', 'NEGRO', 'BLANCO', 'AZUL', 'ROJO', 'VERDE', 'AMARILLO', 
                    'ROSA', 'LILA', 'NARANJA', 'GRIS', 'VIOLETA', 'PURPURA', 'CELESTE', 'GRAY', 'GREY'
                ]
                
                # Función rápida para detectar si una línea es solo de colores
                def es_solo_colores(l):
                    if not l: return False
                    # Limpiar separadores comunes
                    l_limpia = l.replace('/', ' ').replace(',', ' ').replace('&', ' ').replace('-', ' ').upper()
                    palabras = l_limpia.split()
                    if not palabras: return False
                    # Si el 80% o más de las palabras son colores, es una línea de colores
                    coincidencias = sum(1 for p in palabras if p in colores_lista)
                    return (coincidencias / len(palabras)) >= 0.7
                
                if es_solo_colores(linea):
                    # print(f"   ⏩ Saltando línea de colores: {linea}")
                    continue

                # Detectar categorías (EstRICTO: solo si empieza con ►)
                if linea.startswith('►'):
                    # Limpiar símbolo ►
                    categoria_original = linea.replace('►', '').strip()
                    
                    # Ignorar líneas irrelevantes que empiecen con ►
                    if (len(categoria_original) < 3 or 
                        "LISTA DE" in categoria_original.upper() or
                        "DEL DÍA" in categoria_original.upper()):
                        continue
                        
                    # Aplicar normalización de categorías
                    categoria_actual = self.normalizar_categoria(categoria_original)
                    
                    print(f"   📂 Categoría encontrada: {categoria_actual} (Original: {categoria_original})")
                    continue
                
                # Buscar productos con precios explícitos
                match = re.search(self.precio_regex, linea, re.MULTILINE)
                if match:
                    producto_raw = match.group(1).strip()
                    precio_costo = float(match.group(2))
                    
                    # Limpiar nombre del producto
                    producto = producto_raw.strip()
                    
                    # Formatear nombre
                    producto = self.formatear_nombre_producto(producto, categoria_actual)
                    
                    # --- RE-CATEGORIZACIÓN INTELIGENTE (GcGroup) ---
                    cat_final = categoria_actual
                    prod_upper = producto.upper()
                    
                    if "PENCIL" in prod_upper:
                        cat_final = "Accesorios"
                    elif "AIRPODS" in prod_upper or "AIR PODS" in prod_upper:
                        cat_final = "AirPods"
                    # -----------------------------------------------

                    # Calcular precio de venta
                    precio_venta = self.calcular_precio_venta(precio_costo)
                    
                    if precio_venta:
                        producto_info = {
                            'producto': producto,
                            'precio_costo': precio_costo,
                            'precio_venta': precio_venta,
                            'categoria': cat_final,
                            'ganancia_porcentaje': 10,
                            'extra_usd': 25
                        }
                        
                        self.productos_extraidos.append(producto_info)
                        print(f"   ✅ {producto}: ${precio_costo} → ${precio_venta} (Cat: {cat_final})")
                else:
                    # Para listas de disponibilidad, contar productos sin precio
                    if (es_lista_disponibilidad and 
                        linea and 
                        not linea.isupper() and
                        'LISTA DE' not in linea and
                        'DEL DÍA' not in linea):
                        productos_sin_precio += 1
            
            if productos_sin_precio > 0:
                print(f"   📋 Productos sin precio (solo disponibilidad): {productos_sin_precio}")
                print(f"   💡 Para obtener precios, busca un mensaje que diga 'LISTA DE PRECIOS'")
                        
            print(f"   📊 Total productos con precios extraídos: {len(self.productos_extraidos)}")
            
            if len(self.productos_extraidos) == 0 and productos_sin_precio > 0:
                print(f"   ⚠️  AVISO: Este mensaje solo contiene disponibilidad, no precios")
                print(f"   🔍 Busca un mensaje que contenga 'LISTA DE PRECIOS' para obtener los precios")
                
            return self.productos_extraidos
            
        except Exception as e:
            print(f"❌ Error extrayendo productos: {e}")
            return []
    
    def generar_json_productos(self, archivo_salida="../app/public/productos_gcgroup.json"):
        """Generar JSON de productos GCGroup (sobrescribir siempre el específico, mezclar el consolidado)"""
        try:
            # Archivos de salida
            archivo_publico = archivo_salida
            archivo_privado = "productos_ram_completo.json"
            
            # --- 1. GENERAR JSON ESPECÍFICO (SOLO GCGROUP) ---
            os.makedirs(os.path.dirname(archivo_publico), exist_ok=True)
            
            productos_publicos_lista = []
            for p in self.productos_extraidos:
                productos_publicos_lista.append({
                    "nombre": p['producto'],
                    "precio": p['precio_venta'],
                    "categoria": p['categoria']
                })
            
            estructura_publica = {
                "metadatos": {
                    "ultima_actualizacion": datetime.now().strftime("%d/%m/%Y %H:%M"),
                    "total_productos": len(productos_publicos_lista),
                    "proveedor": "GcGroup"
                },
                "productos": productos_publicos_lista
            }
            
            with open(archivo_publico, 'w', encoding='utf-8') as f:
                json.dump(estructura_publica, f, indent=2, ensure_ascii=False)
            
            print(f"✅ JSON público ESPECÍFICO generado: {archivo_publico}")
            
            # --- 2. ACTUALIZAR JSON CONSOLIDADO (CON MEZCLA) ---
            # Cargar o inicializar estructura completa
            estructura_completa = {"metadatos": {}, "productos": []}
            if os.path.exists(archivo_privado):
                try:
                    with open(archivo_privado, 'r', encoding='utf-8') as f:
                        estructura_completa = json.load(f)
                        # Asegurar que productos sea una lista
                        if isinstance(estructura_completa.get('productos'), dict):
                            # Convertir de dict de categorías a lista plana si fuera necesario
                            lista_plana = []
                            for cat, prods in estructura_completa['productos'].items():
                                lista_plana.extend(prods)
                            estructura_completa['productos'] = lista_plana
                except Exception as e:
                    print(f"⚠️ Error cargando consolidado: {e}")
            
            # Filtrar productos anteriores de GCGROUP
            productos_existentes = estructura_completa.get('productos', [])
            productos_no_gc = [p for p in productos_existentes if p.get('proveedor') != 'GcGroup']
            
            # Agregar nuevos productos de GCGROUP (con info completa)
            nuevos_gc = []
            for p in self.productos_extraidos:
                nuevos_gc.append({
                    "nombre": p['producto'],
                    "precio": p['precio_venta'],
                    "precio_costo": p['precio_costo'],
                    "categoria": p['categoria'],
                    "proveedor": "GcGroup",
                    "fecha_actualizacion": datetime.now().strftime("%d/%m/%Y %H:%M")
                })
            
            # Unir y guardar
            estructura_completa['productos'] = productos_no_gc + nuevos_gc
            estructura_completa['metadatos'].update({
                "ultima_actualizacion": datetime.now().strftime("%d/%m/%Y %H:%M"),
                "productos_gcgroup": len(nuevos_gc),
                "total_productos": len(estructura_completa['productos'])
            })
            
            with open(archivo_privado, 'w', encoding='utf-8') as f:
                json.dump(estructura_completa, f, indent=2, ensure_ascii=False)
            
            print(f"✅ JSON CONSOLIDADO actualizado: {archivo_privado}")
            print(f"📊 {len(nuevos_gc)} productos de GCGroup integrados")
            return True
            
        except Exception as e:
            print(f"❌ Error generando JSONs: {e}")
            return False

    def generar_archivo_difusion(self, archivo_salida="output/difusion_ram_gcgroup.txt"):
        """Generar archivo de difusión para WhatsApp"""
        try:
            fecha_hoy = datetime.now().strftime("%d-%m-%Y")
            archivo_con_fecha = f"output/difusion_ram_{fecha_hoy}.txt"
            
            # Crear directorio si no existe
            os.makedirs("output", exist_ok=True)
            
            with open(archivo_con_fecha, 'w', encoding='utf-8') as f:
                # Encabezado
                f.write(f"🔥 LISTA DE PRECIOS RAM INFORMÁTICA - {datetime.now().strftime('%d/%m/%Y')} 🔥\n")
                f.write(f" 🌐 WWW.RAMINFORMATICA.COM.AR\n")
                f.write("=" * 50 + "\n\n")
                
                # Agrupar por categorías
                categorias = {}
                for producto in self.productos_extraidos:
                    categoria = producto['categoria']
                    if categoria not in categorias:
                        categorias[categoria] = []
                    categorias[categoria].append(producto)
                
                # Escribir por categorías
                for categoria, productos in categorias.items():
                    icono = self.obtener_icono_categoria(categoria)
                    f.write(f"{icono} {categoria}\n")
                    f.write("-" * 30 + "\n")
                    
                    for producto in productos:
                        f.write(f"• {producto['producto']} - ${producto['precio_venta']}\n")  # Corregido: usar 'producto'
                    
                    f.write("\n")
                
                # Pie de página
                f.write("=" * 50 + "\n")
                f.write("💬 Consultas y pedidos por WhatsApp\n")
                f.write(f"📅 Actualizado: {datetime.now().strftime('%d/%m/%Y %H:%M')}\n")
            
            print(f"✅ Archivo de difusión generado: {archivo_con_fecha}")
            return True
            
        except Exception as e:
            print(f"❌ Error generando archivo de difusión: {e}")
            return False

def main():
    """Función principal para procesar archivo de GCGroup"""
    print("🚀 PROCESANDO LISTA DE PRECIOS GCGROUP".encode('cp1252', errors='replace').decode('cp1252'))
    print("=" * 50)
    
    procesador = ProcesadorGCGroup()
    
    # Buscar archivo de entrada
    archivo_entrada = "output/lista_gcgroup.txt"
    
    if not os.path.exists(archivo_entrada):
        print(f"❌ No se encontró el archivo: {archivo_entrada}")
        return False
    
    # Leer archivo con manejo robusto de encoding
    try:
        # Intentar diferentes encodings
        contenido = None
        encodings_a_probar = ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252', 'iso-8859-1']
        
        for encoding in encodings_a_probar:
            try:
                with open(archivo_entrada, 'r', encoding=encoding) as f:
                    contenido = f.read()
                print(f"[OK] Archivo leido exitosamente con encoding: {encoding}")
                break
            except UnicodeDecodeError:
                continue
        
        if contenido is None:
            print(f"ERROR No se pudo leer el archivo {archivo_entrada} con ningún encoding")
            return False
        
        if len(contenido.strip()) == 0:
            print(f"ERROR El archivo {archivo_entrada} está vacío")
            return False

        print(f"[OK] Archivo leído: {len(contenido)} caracteres")

    except Exception as e:
        print(f"ERROR Error leyendo archivo: {e}")
        return False
    
    # Procesar productos
    productos = procesador.extraer_productos_del_texto(contenido)
    
    if not productos:
        print("❌ No se encontraron productos en el archivo")
        return False
    
    # Generar archivos de salida
    print("\n📝 Generando archivos de salida...")
    
    # Generar JSON
    json_ok = procesador.generar_json_productos()
    
    # Generar archivo de difusión
    difusion_ok = procesador.generar_archivo_difusion()
    
    if json_ok and difusion_ok:
        print("\n🎉 ¡Procesamiento completado exitosamente!")
        print(f"   📊 {len(productos)} productos procesados")
        print("   📁 Archivos generados:")
        print("     • productos_ram.json (para frontend)")
        print("     • difusion_ram_[fecha].txt (para WhatsApp)")
        return True
    else:
        print("\n⚠️ Procesamiento completado con errores")
        return False

if __name__ == "__main__":
    main()