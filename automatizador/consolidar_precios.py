#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import os
import re
from datetime import datetime

def normalizar_para_comparacion(nombre):
    """
    Normaliza el nombre del producto para detectar duplicados entre proveedores.
    """
    if not nombre:
        return ""
    
    # 1. Todo a minúsculas
    n = nombre.lower().strip()
    
    # 2. Quitar emojis y símbolos especiales
    n = re.sub(r'[^\w\s/]', '', n)
    
    # 3. Normalizar espacios
    n = re.sub(r'\s+', ' ', n)
    
    # 4. Normalizar unidades de memoria (quitar GB, TB pero mantener el número)
    # n = re.sub(r'(\d+)\s*(gb|tb|ssd|ram)', r'\1', n)
    # Nota: Decidí mantener las unidades pero sin espacio para evitar errores
    n = n.replace(" gb", "gb").replace(" tb", "tb").replace(" ssd", "ssd").replace(" ram", "ram")
    
    # 5. Quitar palabras que sobran para la comparación
    n = n.replace("nuevo", "").replace("new", "").replace("solo wifi", "wifi")
    
    # 6. Quitar espacios finales/iniciales después de limpieza
    return n.strip()

def consolidar_mejor_precio(archivo_entrada="productos_ram_completo.json", archivo_salida="../app/public/productos_ram.json"):
    """
    Lee todos los productos, busca duplicados por nombre y mantiene solo el de mejor precio.
    """
    if not os.path.exists(archivo_entrada):
        print(f"❌ No se encontró el archivo completo: {archivo_entrada}")
        return False
        
    try:
        with open(archivo_entrada, 'r', encoding='utf-8') as f:
            datos = json.load(f)
            
        productos_lista = datos.get('productos', [])
        if not productos_lista:
            print("⚠️ No hay productos para consolidar")
            return False
            
        # Diccionario para agrupar por nombre normalizado
        # Key: nombre_normalizado, Value: producto_info
        mejores_productos = {}
        duplicados_omitidos = 0
        
        for p in productos_lista:
            nombre_orig = p.get('nombre', '')
            # Usamos la categoría también para evitar falsos positivos si hay nombres genéricos
            categoria = p.get('categoria', '')
            precio = p.get('precio', 999999)
            
            # Generar clave de comparación
            key = f"{normalizar_para_comparacion(nombre_orig)}"
            
            if key not in mejores_productos:
                mejores_productos[key] = p
            else:
                # Si ya existe, comparar precios
                if precio < mejores_productos[key]['precio']:
                    mejores_productos[key] = p
                    duplicados_omitidos += 1
                else:
                    duplicados_omitidos += 1
        
        # Crear estructura final para el JSON público
        # El público NO debe tener precio_costo ni info de ganancia
        productos_publicos = []
        for key, p in mejores_productos.items():
            prod_pub = {
                "nombre": p.get('nombre'),
                "precio": p.get('precio'),
                "categoria": p.get('categoria'),
                "proveedor": p.get('proveedor')
            }
            # Opcional: Podríamos agregar un flag "es_mejor_precio": True si fuera útil el frontend
            productos_publicos.append(prod_pub)
            
        # Actualizar metadatos
        metadatos = datos.get('metadatos', {}).copy()
        metadatos["ultima_actualizacion_publica"] = datetime.now().strftime("%d/%m/%Y %H:%M")
        metadatos["total_productos_publicos"] = len(productos_publicos)
        metadatos["duplicados_precio_alto_omitidos"] = duplicados_omitidos
        
        estructura_final = {
            "metadatos": metadatos,
            "productos": productos_publicos
        }
        
        # Guardar JSON público
        os.makedirs(os.path.dirname(archivo_salida), exist_ok=True)
        with open(archivo_salida, 'w', encoding='utf-8') as f:
            json.dump(estructura_final, f, indent=2, ensure_ascii=False)
            
        print(f"✅ Consolidación completada:")
        print(f"   📊 Productos únicos (mejor precio): {len(productos_publicos)}")
        print(f"   🗑️  Duplicados con precio mayor omitidos: {duplicados_omitidos}")
        print(f"   📂 Archivo generado: {archivo_salida}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error en consolidación: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    consolidar_mejor_precio()
