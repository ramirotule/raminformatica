#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
consolidar_precios.py — Consolida precios de múltiples proveedores.

Usa matcher.py para detectar el mismo producto vendido por distintos proveedores
y conserva solo el de menor precio_costo.
"""

import json
import os
from datetime import datetime

from matcher import deduplicate_by_best_price


def consolidar_mejor_precio(
    archivo_entrada="productos_ram_completo.json",
    archivo_salida="../app/public/productos_ram.json"
):
    """
    Lee todos los productos del consolidado, detecta duplicados entre proveedores
    usando matching inteligente de specs, y genera el JSON público con el mejor precio.
    """
    if not os.path.exists(archivo_entrada):
        print(f"❌ No se encontró: {archivo_entrada}")
        return False

    try:
        with open(archivo_entrada, 'r', encoding='utf-8') as f:
            datos = json.load(f)

        productos_lista = datos.get('productos', [])
        if not productos_lista:
            print("⚠️ No hay productos para consolidar")
            return False

        print(f"🔍 Consolidando {len(productos_lista)} productos con matching inteligente...")

        # Contar proveedores únicos
        proveedores = set(p.get('proveedor', '?') for p in productos_lista)
        print(f"   📦 Proveedores detectados: {', '.join(sorted(proveedores))}")

        # Deduplicar usando matcher inteligente
        productos_unicos = deduplicate_by_best_price(productos_lista, threshold=0.75)

        duplicados_omitidos = len(productos_lista) - len(productos_unicos)

        # Loguear productos que tenían alternativas más caras
        for p in productos_unicos:
            if p.get('_alternatives'):
                alts = p['_alternatives']
                alt_info = ', '.join(
                    f"{a['proveedor']} ${a['precio_costo']}"
                    for a in alts
                )
                print(f"   💰 Mejor precio: {p['nombre'][:50]} "
                      f"← {p['proveedor']} ${p.get('precio_costo', '?')} "
                      f"(descartado: {alt_info})")

        # Construir JSON público
        productos_publicos = []
        for p in productos_unicos:
            prod_pub = {
                "nombre": p.get('nombre'),
                "precio": p.get('precio'),
                "precio_costo": p.get('precio_costo'),
                "categoria": p.get('categoria'),
                "proveedor": p.get('proveedor')
            }
            productos_publicos.append(prod_pub)

        # Metadatos
        metadatos = datos.get('metadatos', {}).copy()
        metadatos.update({
            "ultima_actualizacion_publica": datetime.now().strftime("%d/%m/%Y %H:%M"),
            "total_productos_publicos": len(productos_publicos),
            "duplicados_precio_alto_omitidos": duplicados_omitidos,
        })

        estructura_final = {
            "metadatos": metadatos,
            "productos": productos_publicos
        }

        os.makedirs(os.path.dirname(os.path.abspath(archivo_salida)), exist_ok=True)
        with open(archivo_salida, 'w', encoding='utf-8') as f:
            json.dump(estructura_final, f, indent=2, ensure_ascii=False)

        print(f"\n✅ Consolidación completada:")
        print(f"   📊 Productos únicos (mejor precio): {len(productos_publicos)}")
        print(f"   🗑️  Duplicados caros omitidos: {duplicados_omitidos}")
        print(f"   📂 Archivo: {archivo_salida}")
        return True

    except Exception as e:
        print(f"❌ Error en consolidación: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    consolidar_mejor_precio()
