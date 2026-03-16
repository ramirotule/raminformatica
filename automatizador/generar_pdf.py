import json
import os
from datetime import datetime
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch

# Definir color verde RAM personalizado
RAM_GREEN = colors.Color(0, 0.898, 0)  # #00e500

def generar_pdf_precios():
    """Generar PDF de lista de precios desde el JSON"""
    
    # Configuración de archivos
    json_input_path = "../public/productos_ram.json"
    pdf_output_path = "../public/precios_ram.pdf"
    
    # Verificar que existe el archivo JSON
    if not os.path.exists(json_input_path):
        print(f"ERROR: No se encontro el archivo JSON: {json_input_path}")
        return False
    
    print("Generando PDF de lista de precios...")
    print("="*50)
    
    # Leer el JSON
    with open(json_input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Extraer la lista de productos
    if isinstance(data, dict) and 'productos' in data:
        productos = data['productos']
        fecha_actualizacion = data['metadatos']['fecha_actualizacion']
        print(f"Procesando {len(productos)} productos desde JSON con metadatos")
    else:
        productos = data if isinstance(data, list) else []
        fecha_actualizacion = datetime.now().isoformat()
        print(f"Procesando {len(productos)} productos desde JSON simple")
    
    # Crear el PDF
    doc = SimpleDocTemplate(
        pdf_output_path,
        pagesize=A4,
        rightMargin=50,
        leftMargin=50,
        topMargin=50,
        bottomMargin=50
    )
    
    # Obtener estilos
    styles = getSampleStyleSheet()
    
    # Crear estilos personalizados
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Title'],
        fontSize=24,
        textColor=colors.black,
        spaceAfter=30,
        alignment=1  # Centrado
    )
    
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.black,
        spaceAfter=20,
        alignment=1  # Centrado
    )
    
    # Contenido del PDF
    story = []
    
    # Logo (si existe)
    logo_path = "../public/logo.png"
    if os.path.exists(logo_path):
        try:
            # Mantener proporciones originales, ajustar solo el ancho
            logo = Image(logo_path, width=3*inch)
            logo.hAlign = 'CENTER'
            story.append(logo)
            story.append(Spacer(1, 20))
            print(f"Logo agregado al PDF desde: {logo_path}")
        except Exception as e:
            print(f"⚠️ No se pudo cargar el logo: {e}")
    else:
        print(f"⚠️ Logo no encontrado en: {logo_path}")
    
    # Título
    story.append(Paragraph("Lista de Precios", title_style))
    story.append(Spacer(1, 12))
    
    # Fecha de actualización
    fecha_formateada = datetime.fromisoformat(fecha_actualizacion.replace('Z', '+00:00')).strftime("%d/%m/%Y %H:%M")
    story.append(Paragraph(f"Última actualización: {fecha_formateada}", subtitle_style))
    story.append(Paragraph("Precios sujetos a cambios sin previo aviso", subtitle_style))
    story.append(Spacer(1, 20))
    
    # Agrupar productos por categoría
    productos_por_categoria = {}
    for producto in productos:
        categoria = producto['categoria']
        if categoria not in productos_por_categoria:
            productos_por_categoria[categoria] = []
        productos_por_categoria[categoria].append(producto)
    
    # Orden de categorías
    orden_categorias = ["CELULARES", "MACBOOKS", "TELEVISORES", "VIDEO JUEGOS", "CARGADORES", "OTROS"]
    
    # Crear tabla para cada categoría
    for categoria in orden_categorias:
        if categoria in productos_por_categoria:
            items = productos_por_categoria[categoria]
            
            # Título de categoría
            categoria_style = ParagraphStyle(
                'CategoriaStyle',
                parent=styles['Heading2'],
                fontSize=16,
                textColor=colors.black,
                spaceAfter=10,
                spaceBefore=20
            )
            story.append(Paragraph(categoria, categoria_style))
            
            # Preparar datos para la tabla
            table_data = [['Producto', 'Precio USD']]
            
            for item in items:
                producto_texto = item['producto']
                precio = f"U$S {item['precio_usd']}"
                table_data.append([producto_texto, precio])
            
            # Crear tabla
            table = Table(table_data, colWidths=[4*inch, 1.5*inch])
            table.setStyle(TableStyle([
                # Encabezado
                ('BACKGROUND', (0, 0), (-1, 0), colors.black),
                ('TEXTCOLOR', (0, 0), (-1, 0), RAM_GREEN),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('ALIGN', (1, 0), (1, -1), 'CENTER'),  # Precios centrados
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                
                # Contenido
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 10),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                
                # Alternar colores de fila
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey])
            ]))
            
            story.append(table)
            story.append(Spacer(1, 20))
    
    # Agregar categorías restantes
    for categoria, items in productos_por_categoria.items():
        if categoria not in orden_categorias:
            # Título de categoría
            categoria_style = ParagraphStyle(
                'CategoriaStyle',
                parent=styles['Heading2'],
                fontSize=16,
                textColor=colors.black,
                spaceAfter=10,
                spaceBefore=20
            )
            story.append(Paragraph(categoria, categoria_style))
            
            # Preparar datos para la tabla
            table_data = [['Producto', 'Precio USD']]
            
            for item in items:
                producto_texto = item['producto']
                precio = f"U$S {item['precio_usd']}"
                table_data.append([producto_texto, precio])
            
            # Crear tabla
            table = Table(table_data, colWidths=[4*inch, 1.5*inch])
            table.setStyle(TableStyle([
                # Encabezado
                ('BACKGROUND', (0, 0), (-1, 0), colors.black),
                ('TEXTCOLOR', (0, 0), (-1, 0), RAM_GREEN),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('ALIGN', (1, 0), (1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                
                # Contenido
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 10),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                
                # Alternar colores de fila
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey])
            ]))
            
            story.append(table)
            story.append(Spacer(1, 20))
    
    # Pie de página
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.grey,
        alignment=1,  # Centrado
        spaceBefore=30
    )
    
    whatsapp_style = ParagraphStyle(
        'WhatsApp',
        parent=styles['Normal'],
        fontSize=18,
        textColor=colors.black,
        alignment=1,  # Centrado
        spaceBefore=10
    )
    
    story.append(Spacer(1, 30))
    story.append(Paragraph("RAM INFORMÁTICA", footer_style))
    story.append(Paragraph("Para consultas y pedidos, contáctanos por WhatsApp:", footer_style))
    story.append(Paragraph("<b>📱 2924-227622</b>", whatsapp_style))
    
    # Generar el PDF
    try:
        doc.build(story)
        print(f"PDF generado exitosamente: {pdf_output_path}")
        print(f"Total productos en PDF: {len(productos)}")
        return True
        
    except Exception as e:
        print(f"❌ Error generando PDF: {e}")
        return False

if __name__ == "__main__":
    generar_pdf_precios()