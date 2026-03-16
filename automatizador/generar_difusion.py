import json
import os
from datetime import datetime

def generar_difusion_txt():
    """Generar archivo TXT de difusión para WhatsApp compatible con estructura GCGroup"""
    
    # Obtener fecha actual en formato DD/MM/YYYY
    fecha_actual = datetime.now().strftime("%d/%m/%Y")
    fecha_archivo = datetime.now().strftime("%d-%m-%Y")
    
    # Configuración de archivos
    json_input_path = '../public/productos_ram.json'
    txt_output_path = f"output/difusion_ram_{fecha_archivo}.txt"
    
    # Verificar que existe el archivo JSON
    if not os.path.exists(json_input_path):
        raise FileNotFoundError(f"No se encontró el archivo JSON: {json_input_path}")
    
    print(f"Generando archivo de difusión para WhatsApp...")
    print("="*50)
    
    # Leer el JSON
    with open(json_input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Determinar la estructura del JSON y extraer productos
    productos_por_categoria = {}
    total_productos = 0
    
    if isinstance(data, dict) and 'productos' in data:
        print(f"Procesando estructura con metadatos de GCGroup")
        
        # Estructura nueva de GCGroup con metadatos
        if 'metadatos' in data:
            print(f"Proveedor: {data['metadatos'].get('proveedor', 'N/A')}")
            print(f"Fecha extracción: {data['metadatos'].get('fecha_extraccion', 'N/A')}")
        
        # Verificar si productos es lista o diccionario
        productos_data = data['productos']
        if isinstance(productos_data, dict):
            # Los productos ya están agrupados por categoría
            productos_por_categoria = productos_data
            # Contar total de productos
            for categoria, items in productos_por_categoria.items():
                total_productos += len(items)
        elif isinstance(productos_data, list):
            # Productos en lista - convertir a categorías
            if not productos_data:
                print("No hay productos para procesar")
                return
            for producto in productos_data:
                categoria = producto.get('categoria', 'GENERAL')
                if categoria not in productos_por_categoria:
                    productos_por_categoria[categoria] = []
                productos_por_categoria[categoria].append(producto)
                total_productos += 1
            
    elif isinstance(data, list):
        # Estructura antigua - agrupar productos por categoría
        print(f"Procesando estructura antigua (lista simple)")
        for producto in data:
            categoria = producto.get('categoria', 'OTROS')
            if categoria not in productos_por_categoria:
                productos_por_categoria[categoria] = []
            productos_por_categoria[categoria].append(producto)
            total_productos += 1
    else:
        raise ValueError("Estructura de JSON no reconocida")
    
    print(f"Total productos encontrados: {total_productos}")
    print(f"Categorías: {list(productos_por_categoria.keys())}")
    
    # Crear el encabezado con fecha dinámica y sitio web
    contenido = [
        f"🔥 BUEN DIA LES DEJO LA LISTA DE PRECIOS RAM INFORMATICA - {fecha_actual} 🔥",
        "",
        "🌐 www.raminformatica.com.ar",
        "=" * 50,
        "",
        "⚠️ LOS PEDIDOS Y LAS CONSULTAS SE TOMAN DESDE EL MOMENTO QUE ENVIAMOS LA LISTA HASTA LAS 13 HS.",
        "UNA VEZ CONFIRMADO EL PEDIDO SE RETIRA POR NUESTRA SUCURSAL A PARTIR DE LAS 16 HASTA LAS 18 HS",
        "O AL DÍA SIGUIENTE DE 11 A 18 HS, LOS PEDIDOS COMO MÁXIMO SE GUARDAN POR 24 HS",
        "",
        "⛔ NO ⛔ SE ACEPTAN DÓLARES CARA CHICA, MANCHADOS, ROTOS, ESCRITOS.",
        "NO SE ACEPTA CAMBIO EN CANTIDAD - MAYOR A 50. SIN EXCEPCIÓN",
        "",
        "💲 ACEPTAMOS PAGOS EN USDT MAS EL 1 %",
        "",
        "⚠️ NO TOMAMOS PESOS ⛔🚫",
        "",
        "🛒 PRODUCTOS DISPONIBLES",
        "="*50,
        ""
    ]
    
    # Orden preferido de categorías (ajustar según las categorías de GCGroup)
    orden_categorias = [
        "IPHONE NEW - GTIA OFICIAL 12 MESES",
        "IPHONE TESTER - GTIA 1 MES", 
        "IPHONE AS IS - GTIA 1 MES",
        "SAMSUNG - GTIA 3 MESES",
        "MOTOROLA - GTIA 3 MESES",
        "XIAOMI - GTIA 3 MESES",
        "INFINIX - GTIA 3 MESES",
        "ITEL - GTIA 3 MESES",
        "PARLANTES JBL",
        "CARGADOR APPLE ORIGINAL",
        "AIRPODS",
        "APPLE WATCH", 
        "IPAD",
        "MACBOOK",
        "PLAYSTATION",
        "XBOX",
        "TVS - ENTREGA 1 DIA DESPUES"
    ]
    
    # Agregar productos por categoría en orden preferido
    for categoria in orden_categorias:
        if categoria in productos_por_categoria:
            items = productos_por_categoria[categoria]
            
            # Agregar encabezado de categoría
            contenido.append(f"📱 {categoria}")
            contenido.append("-" * 30)
            contenido.append("")
            
            # Agregar productos de la categoría
            for item in items:
                # Detectar estructura del producto
                if 'producto' in item and 'precio_venta' in item:
                    # Estructura nueva de GCGroup
                    producto_texto = item['producto']
                    precio = item['precio_venta']
                elif 'nombre' in item and 'precio' in item:
                    # Estructura alternativa
                    producto_texto = item['nombre']
                    precio = item['precio']
                elif 'producto' in item and 'precio_usd' in item:
                    # Estructura antigua
                    producto_texto = item['producto']
                    precio = item['precio_usd']
                else:
                    # Fallback
                    producto_texto = str(item)
                    precio = "CONSULTAR"
                
                contenido.append(f"• {producto_texto}")
                # Formatear precio para mostrar enteros sin decimales
                if isinstance(precio, (int, float)) and precio == int(precio):
                    precio_formateado = int(precio)
                else:
                    precio_formateado = precio
                contenido.append(f"💰 U$S {precio_formateado}")
                contenido.append("")
    
    # Agregar categorías restantes que no estén en el orden predefinido
    for categoria, items in productos_por_categoria.items():
        if categoria not in orden_categorias:
            # Agregar encabezado de categoría
            contenido.append(f"📱 {categoria}")
            contenido.append("-" * 30)
            contenido.append("")
            
            for item in items:
                # Detectar estructura del producto
                if 'producto' in item and 'precio_venta' in item:
                    # Estructura nueva de GCGroup
                    producto_texto = item['producto']
                    precio = item['precio_venta']
                elif 'nombre' in item and 'precio' in item:
                    # Estructura alternativa
                    producto_texto = item['nombre']
                    precio = item['precio']
                elif 'producto' in item and 'precio_usd' in item:
                    # Estructura antigua
                    producto_texto = item['producto']
                    precio = item['precio_usd']
                else:
                    # Fallback
                    producto_texto = str(item)
                    precio = "CONSULTAR"
                
                contenido.append(f"• {producto_texto}")
                # Formatear precio para mostrar enteros sin decimales
                if isinstance(precio, (int, float)) and precio == int(precio):
                    precio_formateado = int(precio)
                else:
                    precio_formateado = precio
                contenido.append(f"💰 U$S {precio_formateado}")
                contenido.append("")
    
    # Agregar pie de página
    contenido.extend([
        "="*50,
        f"📅 Lista actualizada: {fecha_actual}",
        "",
        "💬 Para consultas y pedidos, responder a este mensaje",
        "",
        "🏪 RAM INFORMATICA - Tu tienda de confianza"
    ])
    
    # Crear directorio output si no existe
    os.makedirs("output", exist_ok=True)
    
    # Guardar archivo TXT
    with open(txt_output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(contenido))
    
    print(f"Archivo de difusión generado: {txt_output_path}")
    print(f"Total productos: {total_productos}")
    print(f"Total categorías: {len(productos_por_categoria)}")
    print(f"Fecha: {fecha_actual}")
    print("="*50)
    print("Archivo listo para difusión en WhatsApp!")
    
    return txt_output_path

if __name__ == "__main__":
    generar_difusion_txt()
