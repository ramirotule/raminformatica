# Parse Zentek BA format
def parse_zentek(path):
    equipos = {}
    equipo_re = re.compile(r'^[^$\n]*([A-Za-z0-9\s\-\+\.]+)\s*\$([0-9]+)', re.MULTILINE)
    with open(path, encoding='utf-8') as f:
        for line in f:
            m = equipo_re.match(line.strip())
            if m:
                nombre = m.group(1).strip().upper()
                precio = int(m.group(2))
                equipos[nombre] = precio
    return equipos
import os
import re
import glob
import pandas as pd

# Paths
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'output')

# Detect latest difusion file
def get_latest_difusion_file():
    files = glob.glob(os.path.join(OUTPUT_DIR, 'difusion_ram_*.txt'))
    if not files:
        raise FileNotFoundError('No se encontró ningún archivo de difusión.')
    files.sort(reverse=True)
    return files[0]

def parse_difusion(path):
    equipos = {}
    equipo_re = re.compile(r'•\s*(.+?)\s*-\s*\$(\d+)')
    with open(path, encoding='utf-8') as f:
        for line in f:
            m = equipo_re.match(line.strip())
            if m:
                nombre = m.group(1).strip().upper()
                precio = int(m.group(2))
                equipos[nombre] = precio
    return equipos

def parse_gcgroup(path):
    equipos = {}
    equipo_re = re.compile(r'^(?!►)([A-Z0-9].+?)\s*-?\s*\$\s*(\d+)', re.IGNORECASE)
    with open(path, encoding='utf-8') as f:
        for line in f:
            m = equipo_re.match(line.strip())
            if m:
                nombre = m.group(1).strip().upper()
                precio = int(m.group(2))
                equipos[nombre] = precio
    return equipos

def main():

    difusion_file = get_latest_difusion_file()
    gcgroup_file = os.path.join(OUTPUT_DIR, 'lista_gcgroup.txt')
    zentek_file = os.path.join(OUTPUT_DIR, 'lista_zentek.txt')
    if not os.path.exists(gcgroup_file):
        raise FileNotFoundError('No se encontró lista_gcgroup.txt')

    venta = parse_difusion(difusion_file)
    costo = parse_gcgroup(gcgroup_file)

    # Si existe lista Zentek BA, procesar también
    venta_zentek = {}
    if os.path.exists(zentek_file):
        venta_zentek = parse_zentek(zentek_file)

    data = []
    for nombre, precio_venta in venta.items():
        precio_costo = costo.get(nombre)
        if precio_costo is None:
            for k in costo:
                if nombre.replace(' ', '') == k.replace(' ', ''):
                    precio_costo = costo[k]
                    break
        ganancia = precio_venta - precio_costo if precio_costo is not None else None
        data.append({
            'Equipo': nombre,
            'Precio Venta': precio_venta,
            'Precio Costo': precio_costo if precio_costo is not None else '',
            'Ganancia': ganancia if ganancia is not None else ''
        })

    # Agregar datos de Zentek BA si existen
    if venta_zentek:
        for nombre, precio_venta in venta_zentek.items():
            precio_costo = costo.get(nombre)
            if precio_costo is None:
                for k in costo:
                    if nombre.replace(' ', '') == k.replace(' ', ''):
                        precio_costo = costo[k]
                        break
            ganancia = precio_venta - precio_costo if precio_costo is not None else None
            data.append({
                'Equipo': f'ZENTEK: {nombre}',
                'Precio Venta': precio_venta,
                'Precio Costo': precio_costo if precio_costo is not None else '',
                'Ganancia': ganancia if ganancia is not None else ''
            })

    df = pd.DataFrame(data)
    excel_name = f"ganancias_ram_{os.path.basename(difusion_file).split('_')[-1].replace('.txt','.xlsx')}"
    excel_path = os.path.join(OUTPUT_DIR, excel_name)
    df.to_excel(excel_path, index=False)
    print(f"Archivo generado: {excel_path}")

if __name__ == '__main__':
    main()
