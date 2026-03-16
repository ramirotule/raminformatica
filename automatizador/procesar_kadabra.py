import pandas as pd
import re
import os
from datetime import datetime

def procesar_lista_kadabra():
    """Procesa el archivo TXT de Kadabra y lo convierte a Excel"""
    
    # Configuración de archivos
    txt_input_path = "output/lista_kadabra.txt"
    excel_output_path = "output/lista_kadabra_procesada.xlsx"
    
    # Verificar que existe el archivo TXT
    if not os.path.exists(txt_input_path):
        print(f"⚠️ No se encontró el archivo TXT: {txt_input_path}")
        print("   Este archivo es opcional, continuando sin procesar Kadabra...")
        return
    
    print(f"🔄 Procesando lista de Kadabra...")
    print("="*50)
    
    # Leer el archivo TXT
    with open(txt_input_path, 'r', encoding='utf-8') as f:
        contenido = f.read()
    
    # Dividir en líneas y limpiar
    lineas = [linea.strip() for linea in contenido.split('\n') if linea.strip()]
    
    productos = []
    descripcion_actual = None
    
    for linea in lineas:
        # Buscar patrones de precio (U$S seguido de números)
        if re.search(r'U\$S\s*\d+', linea, re.IGNORECASE):
            # Es una línea de precio
            if descripcion_actual:
                # Extraer el precio
                match = re.search(r'U\$S\s*(\d+)', linea, re.IGNORECASE)
                if match:
                    precio = int(match.group(1))
                    productos.append({
                        'Descripción': descripcion_actual,
                        'Precio Venta': precio,
                        'Proveedor': 'Kadabra'
                    })
                descripcion_actual = None
        else:
            # Es una línea de descripción de producto
            # Filtrar líneas que no son productos (encabezados, separadores, etc.)
            if (not linea.startswith('=') and 
                not linea.startswith('-') and 
                not linea.startswith('🏪') and
                not linea.startswith('⚠️') and
                not linea.startswith('💰') and
                not linea.startswith('⛔') and
                not linea.startswith('🛒') and
                not linea.startswith('🔥') and
                not linea.startswith('💬') and
                len(linea) > 5):  # Filtrar líneas muy cortas
                descripcion_actual = linea
    
    # Crear DataFrame
    df = pd.DataFrame(productos)
    
    if df.empty:
        print("⚠️ No se encontraron productos válidos en el archivo")
        return
    
    # Guardar como Excel
    os.makedirs("output", exist_ok=True)
    df.to_excel(excel_output_path, index=False)
    
    print(f"✅ Archivo procesado exitosamente: {excel_output_path}")
    print(f"📊 Productos procesados: {len(df)} productos")
    
    # Mostrar muestra de los primeros productos
    if len(df) > 0:
        print("\n📋 Muestra de productos procesados:")
        print("-" * 50)
        for i, row in df.head(5).iterrows():
            print(f"   {row['Descripción'][:60]}...")
            print(f"   Precio: U$S {row['Precio Venta']}")
            print()

if __name__ == "__main__":
    try:
        procesar_lista_kadabra()
    except Exception as e:
        print(f"❌ Error: {e}")