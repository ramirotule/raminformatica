#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Procesador de precios específico para GCGroup
Formula: (precio_costo + 18%) + $20 USD, redondeado a múltiplo de 5
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
        self.precio_regex = r'^([^-]+)\s*-\s*\$\s*(\d+(?:\.\d+)?)$'
    
    def normalizar_categoria(self, categoria_raw):
        """
        Normalizar categorías según las reglas de negocio:
        - Remover " - GTIA 3 MESES" de marcas  
        - Agrupar TV, QLED, ULED en TELEVISORES
        - Agregar "CELULARES" a marcas de teléfonos
        - Agrupar PS5, XBOX, joysticks en VIDEO JUEGOS
        - Mantener categorías específicas como están
        """
        categoria = categoria_raw.strip()
        
        # Regla 1: Limpiar información adicional (GTIA, entrega, etc.)
        if " - " in categoria:
            partes = categoria.split(" - ")
            categoria = partes[0].strip()
        
        # Regla 2: Agrupar televisores (TV, QLED, ULED, TVS)
        palabras_tv = ["TV", "QLED", "ULED", "TVS"]
        if any(palabra in categoria.upper() for palabra in palabras_tv):
            return "TELEVISORES"
        
        # Regla 3: Agregar "CELULARES" a marcas de teléfonos
        marcas_celulares = ["SAMSUNG", "MOTOROLA", "INFINIX", "ITEL", "XIAOMI"]
        if any(marca in categoria.upper() for marca in marcas_celulares):
            # SAMSUNG → CELULARES SAMSUNG
            marca_encontrada = next(marca for marca in marcas_celulares if marca in categoria.upper())
            return f"CELULARES {marca_encontrada}"
        
        # Regla 4: Categorías de iPhone con prefijo CELULARES
        categorias_iphone = ["IPHONE NEW", "IPHONE TESTER", "IPHONE AS IS"]
        if any(iphone_cat in categoria.upper() for iphone_cat in categorias_iphone):
            # IPHONE NEW → CELULARES IPHONE NEW
            # IPHONE TESTER → CELULARES IPHONE TESTER  
            # IPHONE AS IS → CELULARES IPHONE AS IS
            if "IPHONE NEW" in categoria.upper():
                return "CELULARES IPHONE NEW"
            elif "IPHONE TESTER" in categoria.upper():
                return "CELULARES IPHONE TESTER"
            elif "IPHONE AS IS" in categoria.upper():
                return "CELULARES IPHONE AS IS"
        
        # Regla 5: Agrupar gaming en VIDEO JUEGOS
        categorias_gaming = ["PLAYSTATION", "XBOX"]
        productos_gaming = ["PS5", "XBOX", "JOYSTICK"]
        if (any(cat in categoria.upper() for cat in categorias_gaming) or
            any(prod in categoria.upper() for prod in productos_gaming)):
            return "VIDEO JUEGOS"
        
        # Regla 6: Mantener categorías específicas tal como están
        categorias_especiales = [
            "PARLANTES JBL",
            "CARGADOR APPLE ORIGINAL",
            "AIRPODS", 
            "APPLE WATCH",
            "IPAD",
            "MACBOOK"
        ]
        if categoria in categorias_especiales:
            return categoria
        
        return categoria
        
    def calcular_precio_venta(self, precio_costo):
        """
        Calcular precio de venta usando la fórmula:
        (precio_costo + 18%) + $20 USD, redondeado a múltiplo de 5
        """
        try:
            # Convertir a float si es string
            if isinstance(precio_costo, str):
                precio_costo = float(precio_costo.replace(',', '.'))
            
            # Aplicar 18% de ganancia
            precio_con_ganancia = precio_costo * 1.18
            
            # Sumar $25 USD extras
            precio_con_extras = precio_con_ganancia + 25
            
            # Redondear a múltiplo de 5
            precio_final = math.ceil(precio_con_extras / 5) * 5
            
            return int(precio_final)
            
        except Exception as e:
            print(f"⚠️ Error calculando precio para {precio_costo}: {e}")
            return None

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
                    
                # Detectar categorías (líneas que empiezan con ► o son texto en mayúsculas sin precios)
                if ((linea.startswith('►') or 
                     (linea.isupper() and '$' not in linea and not any(char.isdigit() for char in linea))) and
                    linea not in ['LISTA DE MODELOS Y COLORES DEL DÍA'] and
                    'ACEPTAMOS' not in linea and 'NO TOMAMOS' not in linea and 'GARANTÍAS' not in linea and
                    not linea.startswith('•') and not linea.startswith('PRODUCTOS QUE') and
                    not linea.startswith('ARTÍCULOS DE') and len(linea) < 80):
                    
                    # Limpiar símbolo ► si existe
                    categoria_original = linea.replace('►', '').strip()
                    
                    # Aplicar normalización de categorías
                    categoria_actual = self.normalizar_categoria(categoria_original)
                    
                    # Mostrar mapeo si hubo cambio
                    if categoria_original != categoria_actual:
                        print(f"   📂 Categoría mapeada: {categoria_original} → {categoria_actual}")
                    else:
                        print(f"   📂 Categoría encontrada: {categoria_actual}")
                    continue
                
                # Buscar productos con precios explícitos
                match = re.search(self.precio_regex, linea, re.MULTILINE)
                if match:
                    producto_raw = match.group(1).strip()
                    precio_costo = float(match.group(2))
                    
                    # Limpiar nombre del producto
                    producto = producto_raw.strip()
                    
                    # Calcular precio de venta
                    precio_venta = self.calcular_precio_venta(precio_costo)
                    
                    if precio_venta:
                        producto_info = {
                            'producto': producto,
                            'precio_costo': precio_costo,
                            'precio_venta': precio_venta,
                            'categoria': categoria_actual,
                            'ganancia_porcentaje': 18,
                            'extra_usd': 20
                        }
                        
                        self.productos_extraidos.append(producto_info)
                        print(f"   ✅ {producto}: ${precio_costo} → ${precio_venta}")
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

    def generar_json_productos(self, archivo_salida="../public/productos_ram.json"):
        """Generar JSONs: uno público (sin info sensible) y uno completo (privado)"""
        try:
            # Archivos de salida
            archivo_publico = archivo_salida
            archivo_privado = "productos_ram_completo.json"  # En carpeta automatizador (privada)
            
            # === CARGAR JSON EXISTENTE ===
            estructura_publica = {"metadatos": {}, "productos": {}}
            estructura_completa = {"metadatos": {}, "productos": {}}
            
            # Cargar JSON público existente
            if os.path.exists(archivo_publico):
                try:
                    with open(archivo_publico, 'r', encoding='utf-8') as f:
                        json_publico = json.load(f)
                    estructura_publica = json_publico.copy()
                    print(f"📖 JSON público cargado con {len(estructura_publica.get('productos', {}))} categorías")
                except Exception as e:
                    print(f"⚠️ Error leyendo JSON público: {e}")
            
            # Cargar JSON completo existente
            if os.path.exists(archivo_privado):
                try:
                    with open(archivo_privado, 'r', encoding='utf-8') as f:
                        json_completo = json.load(f)
                    estructura_completa = json_completo.copy()
                    print(f"📖 JSON completo cargado con {len(estructura_completa.get('productos', {}))} categorías")
                except Exception as e:
                    print(f"⚠️ Error leyendo JSON completo: {e}")
            
            # === FILTRAR PRODUCTOS NO-GCGROUP ===
            # Para JSON público: mantener productos sin precio_costo
            productos_publicos_no_gc = {}
            for categoria, productos in estructura_publica.get("productos", {}).items():
                productos_filtrados = []
                for producto in productos:
                    if ('precio_costo' not in producto or 
                        producto.get('proveedor', 'GcGroup') != 'GcGroup'):
                        productos_filtrados.append(producto)
                if productos_filtrados:
                    productos_publicos_no_gc[categoria] = productos_filtrados
            
            # Para JSON completo: mantener productos sin precio_costo
            productos_completos_no_gc = {}
            for categoria, productos in estructura_completa.get("productos", {}).items():
                productos_filtrados = []
                for producto in productos:
                    if ('precio_costo' not in producto or 
                        producto.get('proveedor', 'GcGroup') != 'GcGroup'):
                        productos_filtrados.append(producto)
                if productos_filtrados:
                    productos_completos_no_gc[categoria] = productos_filtrados
            
            # Reinicializar con productos no-GCGroup
            estructura_publica["productos"] = productos_publicos_no_gc
            estructura_completa["productos"] = productos_completos_no_gc
            
            print(f"🔄 Manteniendo productos de otros proveedores")
            
            # === METADATOS ===
            metadatos_base = {
                "ultima_actualizacion": datetime.now().strftime("%d/%m/%Y %H:%M")
            }
            
            # Metadatos públicos (información mínima y limpia)
            metadatos_publicos = metadatos_base.copy()
            
            # Metadatos completos (con información sensible para uso interno)
            metadatos_completos = metadatos_base.copy()
            metadatos_completos.update({
                "fecha_extraccion_gcgroup": datetime.now().strftime("%d/%m/%Y %H:%M"),
                "proveedor_gcgroup": "GcGroup",
                "productos_gcgroup": len(self.productos_extraidos),
                "formula_precio_gcgroup": "(costo + 18%) + $20, redondeado a múltiplo de 5"
            })
            
            # Actualizar metadatos
            if "metadatos" not in estructura_publica:
                estructura_publica["metadatos"] = {}
            if "metadatos" not in estructura_completa:
                estructura_completa["metadatos"] = {}
                
            estructura_publica["metadatos"].update(metadatos_publicos)
            estructura_completa["metadatos"].update(metadatos_completos)
            
            # === AGREGAR PRODUCTOS GCGROUP ===
            productos_gcgroup_agregados = 0
            
            for producto in self.productos_extraidos:
                categoria = producto['categoria']
                
                # Crear categorías si no existen
                if categoria not in estructura_publica["productos"]:
                    estructura_publica["productos"][categoria] = []
                if categoria not in estructura_completa["productos"]:
                    estructura_completa["productos"][categoria] = []
                
                # PRODUCTO PÚBLICO (sin información sensible)
                producto_publico = {
                    "nombre": producto['producto'],
                    "precio": producto['precio_venta'],
                    "categoria": categoria
                }
                
                # PRODUCTO COMPLETO (con toda la información)
                producto_completo = {
                    "nombre": producto['producto'],
                    "precio": producto['precio_venta'],
                    "precio_costo": producto['precio_costo'],  # Solo en versión completa
                    "categoria": categoria,
                    "proveedor": "GcGroup",
                    "ganancia_porcentaje": 18,  # Solo en versión completa
                    "extra_usd": 20,  # Solo en versión completa
                    "fecha_actualizacion": datetime.now().strftime("%d/%m/%Y %H:%M")
                }
                
                estructura_publica["productos"][categoria].append(producto_publico)
                estructura_completa["productos"][categoria].append(producto_completo)
                productos_gcgroup_agregados += 1
            
            # === ACTUALIZAR TOTALES ===
            total_productos_publico = sum(len(productos) for productos in estructura_publica["productos"].values())
            total_productos_completo = sum(len(productos) for productos in estructura_completa["productos"].values())
            
            estructura_publica["metadatos"]["total_productos"] = total_productos_publico
            estructura_completa["metadatos"]["total_productos"] = total_productos_completo
            
            # === GUARDAR ARCHIVOS ===
            os.makedirs(os.path.dirname(archivo_publico), exist_ok=True)
            
            # Guardar JSON público
            with open(archivo_publico, 'w', encoding='utf-8') as f:
                json.dump(estructura_publica, f, indent=2, ensure_ascii=False)
            
            # Guardar JSON completo
            with open(archivo_privado, 'w', encoding='utf-8') as f:
                json.dump(estructura_completa, f, indent=2, ensure_ascii=False)
            
            # === REPORTES ===
            print(f"✅ JSON público generado: {archivo_publico}")
            print(f"🔒 JSON completo generado: {archivo_privado}")
            print(f"📊 {productos_gcgroup_agregados} productos de GCGroup agregados/actualizados")
            print(f"📈 Total productos públicos: {total_productos_publico}")
            print(f"🔒 Total productos completos: {total_productos_completo}")
            print(f"📂 Total categorías: {len(estructura_publica['productos'])}")
            print(f"🛡️  Información sensible oculta en versión pública")
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
                f.write(f"🔥 LISTA DE PRECIOS RAM - {datetime.now().strftime('%d/%m/%Y')} 🔥\n")
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
                    f.write(f"📱 {categoria}\n")
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