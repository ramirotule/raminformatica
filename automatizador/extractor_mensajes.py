"""
extractor_mensajes.py — RAM Informática
Captura chats de WhatsApp del día de hoy, extrae productos con precios de costo
usando Gemini como motor de extracción inteligente.

Uso:
    python3 extractor_mensajes.py                    # escanea todos los chats con actividad hoy
    python3 extractor_mensajes.py --contactos "GcGroup,Kadabra"   # solo esos contactos
    python3 extractor_mensajes.py --chat "GcGroup"   # un solo chat

Salida:
    output/productos_extraidos_YYYY-MM-DD.json
    output/productos_extraidos_YYYY-MM-DD.csv
"""

import os
import re
import sys
import json
import time
import platform
import argparse
import csv
from datetime import datetime

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys
from webdriver_manager.chrome import ChromeDriverManager

from google import genai

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────

GEMINI_MODEL = "gemini-2.5-flash-preview-04-17"

# Ruta a .env.local con la key de Gemini
ENV_PATH = os.path.join(os.path.dirname(__file__), "..", "app", ".env.local")

# Chats conocidos de proveedores (se pueden ampliar)
CONTACTOS_PROVEEDORES = [
    "GcGroup",
    "Kadabra",
    "Zentek",
    "Tecno Duo",
    "TecnoDuo",
]

# Máximo de chats a escanear en modo automático
MAX_CHATS_AUTO = 30

# Segundos de espera entre operaciones de UI
WAIT_SHORT = 1.5
WAIT_MEDIUM = 3


# ─────────────────────────────────────────────
# UTILIDADES
# ─────────────────────────────────────────────

def cargar_gemini_key() -> str:
    """Lee GOOGLE_GENERATIVE_AI_API_KEY del .env.local o variables de entorno."""
    # 1. Variable de entorno directa
    key = os.environ.get("GOOGLE_GENERATIVE_AI_API_KEY", "")
    if key:
        return key

    # 2. Leer .env.local manualmente
    try:
        with open(ENV_PATH, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("GOOGLE_GENERATIVE_AI_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    except FileNotFoundError:
        pass

    return ""


def fecha_hoy_formatos() -> dict:
    """Devuelve la fecha de hoy en varios formatos para detectar mensajes de hoy."""
    ahora = datetime.now()
    dias = {0: "LUNES", 1: "MARTES", 2: "MIERCOLES", 3: "JUEVES",
            4: "VIERNES", 5: "SABADO", 6: "DOMINGO"}
    meses = {1: "ENERO", 2: "FEBRERO", 3: "MARZO", 4: "ABRIL",
             5: "MAYO", 6: "JUNIO", 7: "JULIO", 8: "AGOSTO",
             9: "SEPTIEMBRE", 10: "OCTUBRE", 11: "NOVIEMBRE", 12: "DICIEMBRE"}

    return {
        "largo": f"{dias[ahora.weekday()]} {ahora.day:02d} DE {meses[ahora.month]}",
        "dd_mm": f"{ahora.day}/{ahora.month:02d}",
        "dd_mm_alt": f"{ahora.day}/{ahora.month}",
        "dd_mm_yy": f"{ahora.day}/{ahora.month}/{ahora.year}",
        "hoy": "HOY",
        "dia": str(ahora.day),
        "iso": ahora.strftime("%Y-%m-%d"),
    }


def normalizar(texto: str) -> str:
    """Elimina acentos y convierte a mayúsculas para comparaciones."""
    reemplazos = {'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
                  'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n', 'Ñ': 'N'}
    for k, v in reemplazos.items():
        texto = texto.replace(k, v)
    return texto.upper()


def tiene_actividad_hoy(texto_preview: str, fechas: dict) -> bool:
    """Detecta si el preview de un chat indica actividad hoy."""
    t = normalizar(texto_preview)
    for f in fechas.values():
        if normalizar(f) in t:
            return True
    # WhatsApp muestra "HH:MM" como timestamp si el mensaje es de hoy
    if re.search(r'\b\d{1,2}:\d{2}\b', texto_preview):
        return True
    return False


# ─────────────────────────────────────────────
# SELENIUM — WHATSAPP WEB
# ─────────────────────────────────────────────

class ExtractorWhatsApp:
    def __init__(self):
        self.driver = None
        self.wait = None
        self.fechas = fecha_hoy_formatos()

    def abrir_navegador(self) -> bool:
        print("🔧 Iniciando navegador con sesión persistente...")

        if platform.system() == "Darwin":
            perfil = os.path.expanduser("~/Library/Application Support/Google/Chrome/selenium_wsp")
        elif platform.system() == "Windows":
            perfil = "C:/selenium_wsp"
        else:
            perfil = os.path.expanduser("~/.config/google-chrome/selenium_wsp")

        os.makedirs(perfil, exist_ok=True)

        opts = webdriver.ChromeOptions()
        opts.add_argument(f"--user-data-dir={perfil}")
        opts.add_argument("--profile-directory=Default")
        opts.add_argument("--start-maximized")
        opts.add_argument("--no-first-run")
        opts.add_argument("--disable-blink-features=AutomationControlled")
        opts.add_experimental_option("excludeSwitches", ["enable-logging", "enable-automation"])
        opts.add_experimental_option("useAutomationExtension", False)

        try:
            self.driver = webdriver.Chrome(
                service=Service(ChromeDriverManager().install()),
                options=opts
            )
            self.wait = WebDriverWait(self.driver, 60)
            self.driver.get("https://web.whatsapp.com")
            print("⏳ Esperando que cargue WhatsApp Web...")

            # Esperar campo de búsqueda
            try:
                self.wait.until(
                    EC.presence_of_element_located(
                        (By.XPATH, '//div[@contenteditable="true"][@data-tab="3"]')
                    )
                )
                print("✅ WhatsApp Web cargado y listo")
            except Exception:
                print("⚠️  Timeout esperando WhatsApp. ¿Escaneaste el QR? Esperando 20s adicionales...")
                time.sleep(20)

            return True
        except Exception as e:
            print(f"❌ Error abriendo navegador: {e}")
            return False

    def obtener_lista_chats(self) -> list[dict]:
        """Retorna lista de chats visibles en el panel izquierdo."""
        print("📋 Obteniendo lista de chats...")
        chats = []

        # Verificar que el panel existe antes de buscar items
        panel_encontrado = False
        for sel_panel in ['//div[@aria-label="Lista de chats"]', '//div[@id="pane-side"]']:
            try:
                self.driver.find_element(By.XPATH, sel_panel)
                panel_encontrado = True
                break
            except Exception:
                continue
        if not panel_encontrado:
            print("⚠️  No se pudo encontrar el panel de chats")
            return chats

        # Obtener items de chat
        selectores = [
            '//div[@data-testid="cell-frame-container"]',
            '//div[contains(@class,"_ak8q")]',
        ]

        items = []
        for sel in selectores:
            items = self.driver.find_elements(By.XPATH, sel)
            if items:
                break

        print(f"   📊 {len(items)} chats encontrados en el panel")

        for item in items:
            try:
                # Nombre del contacto/grupo
                nombre = ""
                for xp in ['.//*[@data-testid="cell-frame-title"]',
                           './/*[contains(@class,"_ao3e")]',
                           './/span[@title]']:
                    try:
                        el = item.find_element(By.XPATH, xp)
                        nombre = el.get_attribute("title") or el.text
                        if nombre:
                            break
                    except Exception:
                        continue

                # Texto del último mensaje / timestamp
                preview = ""
                for xp in ['.//*[@data-testid="last-msg-status"]',
                           './/*[@data-testid="cell-frame-secondary"]',
                           './/span[contains(@class,"_ao3e")]']:
                    try:
                        el = item.find_element(By.XPATH, xp)
                        preview = el.text
                        if preview:
                            break
                    except Exception:
                        continue

                if nombre:
                    chats.append({"nombre": nombre, "preview": preview, "elemento": item})

            except Exception:
                continue

        return chats

    def buscar_y_abrir_chat(self, nombre_contacto: str) -> bool:
        """Busca y abre un chat por nombre usando la barra de búsqueda."""
        print(f"🔍 Buscando chat: {nombre_contacto}")
        try:
            # Click en barra de búsqueda
            barra = self.wait.until(
                EC.element_to_be_clickable(
                    (By.XPATH, '//div[@contenteditable="true"][@data-tab="3"]')
                )
            )
            barra.click()
            time.sleep(WAIT_SHORT)
            # clear() no funciona en contenteditable — usar triple-click + Delete
            ActionChains(self.driver).click(barra).click(barra).click(barra).perform()
            barra.send_keys(Keys.DELETE)
            time.sleep(0.2)
            barra.send_keys(nombre_contacto)
            time.sleep(WAIT_MEDIUM)

            # Primer resultado
            resultados = self.driver.find_elements(
                By.XPATH, '//div[@data-testid="cell-frame-container"]'
            )
            if not resultados:
                print(f"   ⚠️  Sin resultados para '{nombre_contacto}'")
                return False

            resultados[0].click()
            time.sleep(WAIT_MEDIUM)
            print(f"   ✅ Chat abierto: {nombre_contacto}")
            return True

        except Exception as e:
            print(f"   ❌ Error abriendo chat '{nombre_contacto}': {e}")
            return False

    def expandir_mensajes_largos(self):
        """Hace click en botones 'Ver más' para expandir mensajes truncados."""
        botones = ['//span[text()="Ver más"]', '//span[text()="Read more"]',
                   '//div[@data-testid="read-more-btn"]']
        expandidos = 0
        for xp in botones:
            try:
                elementos = self.driver.find_elements(By.XPATH, xp)
                for el in elementos:
                    try:
                        self.driver.execute_script("arguments[0].click();", el)
                        expandidos += 1
                        time.sleep(0.3)
                    except Exception:
                        pass
            except Exception:
                pass
        if expandidos:
            print(f"   📖 Expandidos {expandidos} mensajes largos")

    def extraer_mensajes_de_hoy(self) -> list[str]:
        """Extrae todos los mensajes recibidos hoy del chat activo."""
        mensajes_hoy = []

        # Ir al final del chat
        try:
            for sel in ['//div[@data-testid="chat-history"]',
                        '//div[@data-testid="conversation-panel-messages"]',
                        '//div[contains(@class,"copyable-area")]']:
                try:
                    cont = WebDriverWait(self.driver, 5).until(
                        EC.presence_of_element_located((By.XPATH, sel))
                    )
                    self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", cont)
                    time.sleep(WAIT_SHORT)
                    break
                except Exception:
                    continue
        except Exception:
            pass

        # Expandir mensajes largos
        self.expandir_mensajes_largos()

        # Extraer bloques de mensaje
        selectores_msg = [
            '//div[@class="x9f619 x1hx0egp x1yrsyyn xizg8k xu9hqtb xwib8y2"]',
            '//div[contains(@class,"message-in") or contains(@class,"message-out")]',
            '//div[@data-testid="msg-container"]',
        ]

        elementos = []
        for sel in selectores_msg:
            elementos = self.driver.find_elements(By.XPATH, sel)
            if elementos:
                break

        # Buscar indicadores de fecha de hoy en el chat
        # WhatsApp muestra separadores de fecha como "Hoy", la fecha corta, etc.
        fecha_hoy_encontrada = False
        recopilando = False

        for el in elementos:
            try:
                texto = el.text.strip()
                if not texto:
                    continue

                t_norm = normalizar(texto)

                # Detectar separador de fecha (ej: "HOY", "18/03/2026", "MIERCOLES 18 DE MARZO")
                es_separador_fecha = (
                    t_norm in ("HOY", "AYER") or
                    any(normalizar(v) in t_norm for v in [
                        self.fechas["largo"],
                        self.fechas["dd_mm"],
                        self.fechas["dd_mm_alt"],
                        self.fechas["dd_mm_yy"],
                    ]) or
                    # separador de solo la fecha en formato WhatsApp
                    bool(re.match(r'^\d{1,2}/\d{1,2}(/\d{2,4})?$', texto.strip()))
                )

                if es_separador_fecha:
                    # Si la fecha coincide con hoy, empezar a recopilar
                    if (normalizar(texto) == "HOY" or
                        any(normalizar(v) in normalizar(texto) for v in [
                            self.fechas["largo"],
                            self.fechas["dd_mm"],
                            self.fechas["dd_mm_yy"],
                        ])):
                        recopilando = True
                        fecha_hoy_encontrada = True
                        print(f"   📅 Fecha de hoy detectada: '{texto}'")
                    else:
                        # Otra fecha — dejar de recopilar
                        recopilando = False
                    continue

                if recopilando and len(texto) > 10:
                    mensajes_hoy.append(texto)

            except Exception:
                continue

        # Si no encontramos separador "Hoy", puede que todos los mensajes sean de hoy
        # (chat muy activo) — tomar todos los visibles como fallback
        if not fecha_hoy_encontrada:
            print("   ⚠️  No se encontró separador de fecha. Tomando todos los mensajes visibles.")
            for el in elementos:
                try:
                    texto = el.text.strip()
                    if texto and len(texto) > 10:
                        mensajes_hoy.append(texto)
                except Exception:
                    continue

        return mensajes_hoy

    def cerrar(self):
        if self.driver:
            self.driver.quit()


# ─────────────────────────────────────────────
# GEMINI — EXTRACCIÓN DE PRODUCTOS
# ─────────────────────────────────────────────

def extraer_productos_con_gemini(texto_crudo: str, nombre_chat: str, client) -> list[dict]:
    """Usa Gemini para extraer productos y precios de costo del texto crudo."""

    prompt = f"""Sos un asistente que extrae información de listas de precios de tecnología.

Analizá el siguiente texto que proviene del chat de WhatsApp de un proveedor llamado "{nombre_chat}".
Tu tarea es extraer TODOS los productos que tengan precio de costo (precio al que yo compro, no precio de venta al público).

Reglas:
- Extraé solo productos con precio numérico visible
- El precio puede estar en USD (U$S, USD, $, dólares) o ARS (pesos, $)
- Si hay precio en ambas monedas para el mismo producto, incluí ambas
- Ignorá mensajes que NO sean listas de precios (saludos, confirmaciones, etc.)
- Si hay variantes del mismo producto (colores, capacidades), incluilas como registros separados
- Limpiá los nombres: quitá emojis, caracteres raros, pero mantené el modelo exacto
- Si no hay productos con precio, devolvé un array vacío

Respondé SOLO con un JSON array válido, sin texto adicional, sin markdown, sin backticks.
Formato de cada item:
{{
  "producto": "nombre del producto limpio",
  "precio_costo": número o null,
  "moneda": "USD" o "ARS",
  "precio_ars": número o null,
  "precio_usd": número o null,
  "proveedor": "{nombre_chat}",
  "notas": "variante o info extra o vacío"
}}

Texto a analizar:
---
{texto_crudo[:8000]}
---
"""

    try:
        response = client.generate_content(model=GEMINI_MODEL, contents=prompt)
        raw = response.text.strip()

        # Limpiar posibles backticks de markdown
        raw = re.sub(r'^```(?:json)?', '', raw).strip()
        raw = re.sub(r'```$', '', raw).strip()

        productos = json.loads(raw)
        if isinstance(productos, list):
            return productos
        return []

    except json.JSONDecodeError as e:
        print(f"   ⚠️  Error parseando JSON de Gemini: {e}")
        print(f"   Raw (primeros 300 chars): {raw[:300]}")
        return []
    except Exception as e:
        print(f"   ❌ Error llamando a Gemini: {e}")
        return []


# ─────────────────────────────────────────────
# OUTPUT
# ─────────────────────────────────────────────

def guardar_resultados(todos_los_productos: list[dict], fecha_iso: str):
    """Guarda los productos extraídos en JSON y CSV."""
    os.makedirs("output", exist_ok=True)

    # ── JSON ──
    path_json = f"output/productos_extraidos_{fecha_iso}.json"
    with open(path_json, "w", encoding="utf-8") as f:
        json.dump(todos_los_productos, f, ensure_ascii=False, indent=2)
    print(f"📄 JSON guardado: {path_json}")

    # ── CSV ──
    path_csv = f"output/productos_extraidos_{fecha_iso}.csv"
    campos = ["proveedor", "producto", "precio_costo", "moneda", "precio_usd", "precio_ars", "notas"]
    with open(path_csv, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=campos, extrasaction="ignore")
        writer.writeheader()
        for prod in todos_los_productos:
            writer.writerow(prod)
    print(f"📊 CSV guardado:  {path_csv}")

    return path_json, path_csv


def imprimir_resumen(todos_los_productos: list[dict]):
    """Imprime un resumen legible por proveedor."""
    if not todos_los_productos:
        print("\n⚠️  No se extrajo ningún producto.")
        return

    por_proveedor: dict[str, list] = {}
    for p in todos_los_productos:
        prov = p.get("proveedor", "Desconocido")
        por_proveedor.setdefault(prov, []).append(p)

    print("\n" + "=" * 60)
    print(f"✅ EXTRACCIÓN COMPLETADA — {len(todos_los_productos)} productos totales")
    print("=" * 60)

    for prov, prods in por_proveedor.items():
        print(f"\n📦 {prov} — {len(prods)} productos")
        print("-" * 40)
        for p in prods[:10]:  # Mostrar max 10 por proveedor
            nombre = p.get("producto", "?")[:50]
            precio = p.get("precio_costo", "?")
            moneda = p.get("moneda", "")
            notas = p.get("notas", "")
            linea = f"   {nombre}"
            if precio:
                linea += f"  →  {moneda} {precio}"
            if notas:
                linea += f"  ({notas})"
            print(linea)
        if len(prods) > 10:
            print(f"   ... y {len(prods) - 10} más")

    print("\n" + "=" * 60)


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def parsear_args():
    parser = argparse.ArgumentParser(description="Extractor de productos con precios de costo desde WhatsApp")
    parser.add_argument("--contactos", type=str, default="",
                        help="Lista de contactos separados por coma. Ej: 'GcGroup,Kadabra'")
    parser.add_argument("--chat", type=str, default="",
                        help="Un solo contacto a escanear")
    parser.add_argument("--auto", action="store_true",
                        help="Modo automático: escanea chats con actividad hoy (default si no se especifica contacto)")
    parser.add_argument("--sin-browser", action="store_true",
                        help="Modo debug: procesar texto de archivo en vez de WhatsApp")
    parser.add_argument("--archivo", type=str, default="",
                        help="Ruta a archivo .txt para procesar en modo --sin-browser")
    return parser.parse_args()


def main():
    args = parsear_args()
    fechas = fecha_hoy_formatos()
    fecha_iso = fechas["iso"]

    print("=" * 60)
    print(f"🔎 EXTRACTOR DE MENSAJES — RAM Informática")
    print(f"📅 Fecha objetivo: {fecha_iso} ({fechas['largo']})")
    print("=" * 60)

    # ── Configurar Gemini ──
    api_key = cargar_gemini_key()
    if not api_key:
        print("❌ No se encontró GOOGLE_GENERATIVE_AI_API_KEY en .env.local ni en el entorno.")
        sys.exit(1)

    gemini = genai.Client(api_key=api_key).models
    print(f"🤖 Gemini configurado: {GEMINI_MODEL}")

    todos_los_productos = []

    # ── Modo sin browser (debug) ──
    if args.sin_browser:
        if not args.archivo:
            print("❌ En modo --sin-browser debes indicar --archivo <ruta>")
            sys.exit(1)
        with open(args.archivo, encoding="utf-8") as f:
            texto = f.read()
        nombre = os.path.basename(args.archivo).replace(".txt", "")
        print(f"📂 Procesando archivo: {args.archivo}")
        productos = extraer_productos_con_gemini(texto, nombre, gemini)
        todos_los_productos.extend(productos)
        print(f"   ✅ {len(productos)} productos extraídos")

    else:
        # ── Modo WhatsApp Web ──
        extractor = ExtractorWhatsApp()
        if not extractor.abrir_navegador():
            sys.exit(1)

        # Determinar lista de contactos a escanear
        if args.chat:
            contactos = [args.chat.strip()]
        elif args.contactos:
            contactos = [c.strip() for c in args.contactos.split(",") if c.strip()]
        else:
            # Auto: usar lista de proveedores conocidos + escanear panel
            contactos = list(CONTACTOS_PROVEEDORES)
            print(f"\n🔄 Modo automático: escaneando {len(contactos)} proveedores conocidos")

        print(f"\n📋 Contactos a procesar: {contactos}\n")

        textos_por_chat: dict[str, str] = {}

        for nombre_chat in contactos:
            print(f"\n{'─'*50}")
            print(f"💬 Procesando: {nombre_chat}")

            abierto = extractor.buscar_y_abrir_chat(nombre_chat)
            if not abierto:
                continue

            time.sleep(WAIT_MEDIUM)
            mensajes = extractor.extraer_mensajes_de_hoy()

            if not mensajes:
                print(f"   ⚠️  Sin mensajes de hoy en '{nombre_chat}'")
                continue

            texto_concatenado = "\n".join(mensajes)
            textos_por_chat[nombre_chat] = texto_concatenado

            print(f"   📝 {len(mensajes)} mensajes capturados ({len(texto_concatenado)} chars)")

            # Guardar texto crudo para referencia
            os.makedirs("output", exist_ok=True)
            nombre_archivo = nombre_chat.lower().replace(" ", "_")
            path_raw = f"output/raw_{nombre_archivo}_{fecha_iso}.txt"
            with open(path_raw, "w", encoding="utf-8") as f:
                f.write(texto_concatenado)
            print(f"   💾 Texto crudo guardado: {path_raw}")

            # Extraer con Gemini
            print(f"   🤖 Extrayendo productos con Gemini...")
            productos = extraer_productos_con_gemini(texto_concatenado, nombre_chat, gemini)

            if productos:
                print(f"   ✅ {len(productos)} productos extraídos de '{nombre_chat}'")
                todos_los_productos.extend(productos)
            else:
                print(f"   ⚠️  No se encontraron productos con precio en '{nombre_chat}'")

        extractor.cerrar()

    # ── Guardar y mostrar resultados ──
    if todos_los_productos:
        guardar_resultados(todos_los_productos, fecha_iso)
    else:
        print("\n⚠️  No se extrajeron productos. Verificá los chats o la conexión a WhatsApp Web.")

    imprimir_resumen(todos_los_productos)

    print(f"\n🎉 Extracción finalizada. Revisá la carpeta output/")


if __name__ == "__main__":
    main()
