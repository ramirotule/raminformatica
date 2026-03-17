import subprocess
import os
import pandas as pd
from datetime import datetime

# Configurar la codificación para evitar problemas
import sys
if sys.platform == "win32":
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer)
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer)

def ejecutar_script(script_name):
    """Ejecuta un script de Python y maneja errores"""
    try:
        print(f"🔄 Ejecutando {script_name}...")
        
        # Establecer variables de entorno para UTF-8
        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'
        
        result = subprocess.run(
            ['python3', script_name], 
            capture_output=True, 
            text=True, 
            encoding='utf-8',
            env=env,
            cwd=os.getcwd()
        )
        
        if result.returncode == 0:
            print(f"✅ {script_name} ejecutado exitosamente")
            if result.stdout.strip():
                print(result.stdout)
        else:
            print(f"❌ Error ejecutando {script_name}:")
            if result.stderr.strip():
                print(result.stderr)
            return False
    except Exception as e:
        print(f"❌ Error al ejecutar {script_name}: {str(e)}")
        return False
    
    return True

def detectar_duplicados_y_combinar():
    """Detecta productos duplicados y combina las listas eligiendo el mejor precio"""
    productos_combinados = {}
    duplicados_encontrados = []
    
    # Archivos Excel generados por cada script (solo GCGroup y Kadabra para TXT final)
    archivo_excel_gcgroup = "output/lista_gcgroup_procesada.xlsx"
    archivo_excel_kadabra = "output/lista_kadabra_procesada.xlsx"
    # archivo_excel_rodrigo = "output/lista_rodrigo_procesada.xlsx" # Excluido del TXT final
    
    # Función para limpiar nombre del producto para comparación
    def limpiar_nombre(nombre):
        # Remover emoji y limpiar espacios
        import re
        nombre_limpio = re.sub(r'^[^\w\s]+\s*', '', nombre)  # Quitar emoji del inicio
        nombre_limpio = re.sub(r'\s+', ' ', nombre_limpio.strip().upper())  # Normalizar espacios y mayúsculas
        
        # Normalizar formatos de memoria y almacenamiento más agresivamente
        nombre_limpio = re.sub(r'(\d+)\s*GB,?\s*(\d+)\s*GB', r'\1/\2', nombre_limpio)  # "8GB, 256GB" -> "8/256"
        nombre_limpio = re.sub(r'(\d+)/(\d+)\s*GB', r'\1/\2', nombre_limpio)  # Normalizar "/GB"
        nombre_limpio = re.sub(r'(\d+)\s*GB', r'\1', nombre_limpio)  # Quitar GB restantes
        
        # Normalizar formatos de colores y variaciones (más agresivo)
        nombre_limpio = re.sub(r'\s*(SPACE|GOLD|SILV|SILVER|BLACK|WHITE|GRAY|GREY|MID|STAR|MIDNIGHT|STARLIGHT)[/\s]*.*$', '', nombre_limpio)
        
        # Remover variaciones comunes que pueden diferir entre proveedores
        nombre_limpio = re.sub(r'\s*(W/|WITH|CON|C/|S/CARG|ULTIMO|ULTIMOS|TOUCH\s+BAR|BACKLIT|KEYBOARD)\s*.*$', '', nombre_limpio)
        nombre_limpio = re.sub(r'\s*\([^)]*\)\s*', ' ', nombre_limpio)  # Quitar contenido entre paréntesis
        nombre_limpio = re.sub(r'\s*[🔥⭐✨]+.*$', '', nombre_limpio)  # Quitar emojis al final
        nombre_limpio = re.sub(r'\s*_.*$', '', nombre_limpio)  # Quitar todo después de _
        nombre_limpio = re.sub(r'\s*\w+\d+\w+/\w+-\w+.*$', '', nombre_limpio)  # Quitar códigos de modelo
        
        # Normalizar espacios múltiples y limpiar
        nombre_limpio = re.sub(r'\s+', ' ', nombre_limpio)
        nombre_limpio = re.sub(r'\s*[,./]\s*$', '', nombre_limpio)  # Quitar puntuación al final
        
        return nombre_limpio.strip()
    
    # Procesar archivo Excel GCGroup
    if os.path.exists(archivo_excel_gcgroup):
        try:
            import pandas as pd
            df_gcgroup = pd.read_excel(archivo_excel_gcgroup)
            
            for index, row in df_gcgroup.iterrows():
                descripcion = row['Descripción']
                precio_venta = row.get('Precio Venta', 0)
                
                if precio_venta > 0:
                    nombre_limpio = limpiar_nombre(descripcion)
                    precio_formato = f"U$S {int(precio_venta)}"
                    
                    # Si ya existe este producto en GCGroup, mantener el mejor precio
                    if nombre_limpio in productos_combinados and productos_combinados[nombre_limpio]['proveedor'] == 'GCGroup':
                        if precio_venta < productos_combinados[nombre_limpio]['precio']:
                            productos_combinados[nombre_limpio] = {
                                'descripcion_original': descripcion,
                                'precio': precio_venta,
                                'precio_formato': precio_formato,
                                'proveedor': 'GCGroup'
                            }
                    else:
                        productos_combinados[nombre_limpio] = {
                            'descripcion_original': descripcion,
                            'precio': precio_venta,
                            'precio_formato': precio_formato,
                            'proveedor': 'GCGroup'
                        }
        except Exception as e:
            print(f"Error procesando archivo GCGroup Excel: {e}")
    
    # Procesar archivo Excel Kadabra
    if os.path.exists(archivo_excel_kadabra):
        try:
            df_kadabra = pd.read_excel(archivo_excel_kadabra)
            
            for index, row in df_kadabra.iterrows():
                descripcion = row['Descripción']
                precio_venta = row.get('Precio Venta', 0)
                
                if precio_venta > 0:
                    nombre_limpio = limpiar_nombre(descripcion)
                    precio_formato = f"U$S {int(precio_venta)}"
                    
                    if nombre_limpio in productos_combinados:
                        # Producto duplicado encontrado
                        producto_existente = productos_combinados[nombre_limpio]
                        
                        # Solo reportar como duplicado si es entre proveedores diferentes
                        if producto_existente['proveedor'] == 'GCGroup':
                            duplicados_encontrados.append({
                                'nombre': nombre_limpio,
                                'gcgroup': {
                                    'descripcion': producto_existente['descripcion_original'],
                                    'precio': producto_existente['precio']
                                },
                                'kadabra': {
                                    'descripcion': descripcion,
                                    'precio': precio_venta
                                }
                            })
                        else:
                            # Duplicado interno Kadabra - no reportar
                            pass
                        
                        # Elegir el mejor precio (menor)
                        if precio_venta < producto_existente['precio']:
                            productos_combinados[nombre_limpio] = {
                                'descripcion_original': descripcion,
                                'precio': precio_venta,
                                'precio_formato': precio_formato,
                                'proveedor': 'Kadabra'
                            }
                        # Si el precio es igual, mantener GCGroup (prioridad)
                    else:
                        # Producto nuevo de Kadabra
                        productos_combinados[nombre_limpio] = {
                            'descripcion_original': descripcion,
                            'precio': precio_venta,
                            'precio_formato': precio_formato,
                            'proveedor': 'Kadabra'
                        }
        except Exception as e:
            print(f"Error procesando archivo Kadabra Excel: {e}")
    
    # Rodrigo excluido del archivo TXT final (solo se procesa para Excel)
    
    return productos_combinados, duplicados_encontrados

def combinar_archivos_txt():
    """Combina los productos de los archivos Excel en un archivo TXT final"""
    fecha_actual = datetime.now().strftime('%Y-%m-%d')
    
    # Archivo de salida combinado
    archivo_combinado = f"output/lista_completa_WSP_{fecha_actual}.txt"
    
    # Obtener productos combinados y duplicados
    productos_combinados, duplicados_encontrados = detectar_duplicados_y_combinar()
    
    contenido_final = []
    
    # Agregar encabezado personalizado
    contenido_final.append("🏪 LISTA DE PRECIOS RAM INFORMATICA")
    contenido_final.append("")
    contenido_final.append("⚠️ CONSULTAS Y PEDIDOS SE TOMAN DESDE EL MOMENTO QUE ENVIAMOS LA LISTA HASTA LAS 13 HS.")
    contenido_final.append("UNA VEZ CONFIRMADO EL PEDIDO SE RETIRA POR MI DOMICILIO.")
    contenido_final.append("")
    contenido_final.append("💰 ACLARACION IMPORTANTE")
    contenido_final.append("PARA CONFIRMAR LA COMPRA SE REQUIERE EL PAGO DEL 50% DEL PRODUCTO (CON PRECIO ABIERTO SI PAGA EN PESOS POR VARIACION DEL DOLAR) O PAGO TOTAL PARA CONGELAR EL PRECIO.")
    contenido_final.append("")
    contenido_final.append("⛔ NO ⛔ SE ACEPTAN DÓLARES CARA CHICA, MANCHADOS, ROTOS, ESCRITOS. NO SE ACEPTA CAMBIO EN CANTIDAD - MAYOR A 50. SIN EXCEPCIÓN")
    contenido_final.append("")
    contenido_final.append("🛒 PRODUCTOS DISPONIBLES")
    contenido_final.append("=" * 50)
    contenido_final.append("")
    
    # Contar productos finales
    productos_finales = len(productos_combinados)
    
    print(f"📊 Productos procesados: {productos_finales} únicos")
    
    # Mostrar información sobre duplicados encontrados
    if duplicados_encontrados:
        print(f"\n🔍 Se encontraron {len(duplicados_encontrados)} productos duplicados:")
        for dup in duplicados_encontrados:
            # Solo duplicados entre GCGroup y Kadabra
            gcg_precio = dup['gcgroup']['precio']
            kad_precio = dup['kadabra']['precio']
            mejor_precio = min(gcg_precio, kad_precio)
            proveedor_elegido = "GCGroup" if gcg_precio <= kad_precio else "Kadabra"
            
            print(f"   📦 {dup['nombre'][:50]}...")
            print(f"      GCGroup: U$S {gcg_precio} vs Kadabra: U$S {kad_precio}")
            print(f"      ✅ Elegido: {proveedor_elegido} (U$S {mejor_precio})")
            print()
    
    # Ordenar productos por descripción
    productos_ordenados = sorted(productos_combinados.items(), key=lambda x: x[1]['descripcion_original'])
    
    # Agregar productos al contenido final con formato de duplicados
    for _, producto in productos_ordenados:
        contenido_final.append(producto['descripcion_original'])
        contenido_final.append(producto['precio_formato'])
        contenido_final.append("")
    
    # Agregar pie de página
    contenido_final.append("=" * 50)
    contenido_final.append("🔥 ¡APROVECHA ESTOS PRECIOS!")
    contenido_final.append("💬 Escribinos para mas informacion")
    
    # Guardar archivo combinado
    os.makedirs("output", exist_ok=True)
    with open(archivo_combinado, 'w', encoding='utf-8') as f:
        f.write('\n'.join(contenido_final))
    
    print(f"📄 Archivo combinado generado: {archivo_combinado}")
    print(f"📊 Total de productos únicos: {len(productos_combinados)}")
    if duplicados_encontrados:
        print(f"🔍 Duplicados eliminados: {len(duplicados_encontrados)}")
    
    return archivo_combinado

def main():
    """Función principal que ejecuta todo el proceso"""
    print("🚀 Iniciando procesamiento de listas de precios...")
    print("=" * 50)
    
    # Verificar que existen los archivos de entrada
    archivos_entrada = [
        "output/lista_gcgroup.txt",
        "output/lista_kadabra.txt",
        "output/lista_rodrigo.txt"
    ]
    
    archivos_existentes = []
    for archivo in archivos_entrada:
        if os.path.exists(archivo):
            archivos_existentes.append(archivo)
            print(f"✅ Encontrado: {archivo}")
        else:
            print(f"⚠️ No encontrado: {archivo}")
    
    if not archivos_existentes:
        print("❌ No se encontraron archivos de entrada. Asegúrate de que existan:")
        for archivo in archivos_entrada:
            print(f"   - {archivo}")
        return
    
    print("\n" + "-" * 50)
    
    # Ejecutar scripts de proveedores
    scripts_exitosos = 0
    
    # Lista de scripts de proveedores a ejecutar
    scripts_proveedores = [
        "procesar_gcgroup.py",
        "procesar_zentekba.py",
        "procesar_kadabra.py"
    ]
    
    for script in scripts_proveedores:
        if os.path.exists(script):
            if ejecutar_script(script):
                scripts_exitosos += 1
        else:
            print(f"⚠️ Saltando {script} (no encontrado)")
    
    if scripts_exitosos == 0:
        print("❌ No se pudo ejecutar ningún script de proveedor. Proceso abortado.")
        return
    
    print(f"\n✅ Se ejecutaron {scripts_exitosos} scripts exitosamente")

    # Nueva etapa: Consolidar mejores precios para la WEB
    print("\n💎 Optimizando mejores precios para la web...")
    if ejecutar_script("consolidar_precios.py"):
        print("✅ Precios consolidados (solo el mejor precio será público)")
    else:
        print("⚠️ Falló la consolidación de precios")
    
    # Combinar archivos TXT
    print("\n🔄 Combinando archivos TXT...")
    archivo_final = combinar_archivos_txt()
    
    print("\n" + "=" * 50)
    print("🎉 ¡Proceso completado!")
    print(f"📋 Archivo final para WhatsApp: {archivo_final}")
    print("\n💡 Consejos:")
    print("   - Puedes abrir el archivo TXT y copiarlo directamente a WhatsApp")
    print("   - Los archivos Excel están en la carpeta 'output' para revisión")
    print("   - El archivo combinado incluye productos de GCGroup y Kadabra")
    print("   - Rodrigo se procesa solo para Excel (no incluido en lista WhatsApp)")
    print("=" * 50)
    
    # Mostrar estadísticas si es posible
    try:
        with open(archivo_final, 'r', encoding='utf-8') as f:
            contenido = f.read()
            lineas_precio = contenido.count('U$S') + contenido.count('u$')
            print(f"📊 Estadísticas finales: {lineas_precio} productos únicos en total")
    except:
        pass

if __name__ == "__main__":
    main()
