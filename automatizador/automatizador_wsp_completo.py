import time
import re
import os
import subprocess
import sys
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

class AutomatizadorWSP:
    def __init__(self):
        """Inicializar el automatizador con configuración de Selenium"""
        self.driver = None
        self.mensaje_objetivo_encontrado = False
        self.elemento_mensaje_objetivo = None
        # Permitir al usuario indicar un día específico; si se deja vacío, usar hoy
        self.fecha_hoy = self.solicitar_fecha_objetivo()
        self.proveedores = {
            "GcGroup": {
                "archivo_salida": "output/lista_gcgroup.txt",
                "filtro_inicio": ["lista de hoy"],  # Específico para GcGroup
                "nombre_corto": "gcgroup",
                "busqueda_alternativa": ["gc", "group", "gcgroup"]
            },
            "Kadabra Tecnología": {  # Simplificado
                "archivo_salida": "output/lista_kadabra.txt", 
                "filtro_inicio": ["lista", "precios", "iphone", "samsung"],
                "nombre_corto": "kadabra",
                "busqueda_alternativa": ["kadabra", "kadabra tecnologia", "kadabra tecnología"]
            },
            "Zentek BA": {
                "archivo_salida": "output/lista_zentek.txt",
                "filtro_inicio": ["lista de hoy"],  # Específico para Zentek BA
                "nombre_corto": "zentek",
                "busqueda_alternativa": ["zentek", "zentekba", "zentek ba"]
            },
        }
        
    def obtener_fecha_hoy(self):
        """Obtener la fecha de hoy en formato dinámico para buscar en WhatsApp"""
        fecha_actual = datetime.now()
        
        # Mapear días y meses en español (sin acentos para coincidencia flexible)
        dias_semana = {
            0: "LUNES", 1: "MARTES", 2: "MIERCOLES", 3: "JUEVES", 
            4: "VIERNES", 5: "SABADO", 6: "DOMINGO"
        }
        
        meses = {
            1: "ENERO", 2: "FEBRERO", 3: "MARZO", 4: "ABRIL",
            5: "MAYO", 6: "JUNIO", 7: "JULIO", 8: "AGOSTO", 
            9: "SEPTIEMBRE", 10: "OCTUBRE", 11: "NOVIEMBRE", 12: "DICIEMBRE"
        }
        
        dia_semana = dias_semana[fecha_actual.weekday()]
        dia = fecha_actual.day
        mes = meses[fecha_actual.month]
        # Formato: "VIERNES 14 DE NOVIEMBRE" (sin acentos para coincidencia flexible)
        fecha_formateada = f"{dia_semana} {dia:02d} DE {mes}"
        print(f"🗓️ Fecha objetivo: {fecha_formateada}")
        
        return fecha_formateada

    def solicitar_fecha_objetivo(self):
        """Pide al usuario un día (número) para buscar la lista de ese día. Si está vacío, usa hoy."""
        try:
            entrada = input("Ingrese el día del mes a extraer (ej: 6) o ENTER para hoy: ").strip()
        except Exception:
            entrada = ""

        if entrada == "":
            return self.obtener_fecha_hoy()

        # Intentar interpretar como número de día
        try:
            dia_int = int(entrada)
        except ValueError:
            print("Valor inválido, se usará la fecha de hoy.")
            return self.obtener_fecha_hoy()

        # Usar el mismo mes y año actuales
        hoy = datetime.now()
        try:
            fecha_objetivo = datetime(hoy.year, hoy.month, dia_int)
        except Exception as e:
            print(f"Fecha inválida: {e}. Usando fecha de hoy.")
            return self.obtener_fecha_hoy()

        # Mapear días y meses (sin acentos)
        dias_semana = {
            0: "LUNES", 1: "MARTES", 2: "MIERCOLES", 3: "JUEVES", 
            4: "VIERNES", 5: "SABADO", 6: "DOMINGO"
        }
        meses = {
            1: "ENERO", 2: "FEBRERO", 3: "MARZO", 4: "ABRIL",
            5: "MAYO", 6: "JUNIO", 7: "JULIO", 8: "AGOSTO", 
            9: "SEPTIEMBRE", 10: "OCTUBRE", 11: "NOVIEMBRE", 12: "DICIEMBRE"
        }

        dia_semana = dias_semana[fecha_objetivo.weekday()]
        dia = fecha_objetivo.day
        mes = meses[fecha_objetivo.month]

        fecha_formateada = f"{dia_semana} {dia:02d} DE {mes}"
        print(f"🗓️ Fecha objetivo seleccionada: {fecha_formateada}")
        return fecha_formateada
    
    def normalizar_texto(self, texto):
        """Normalizar texto eliminando acentos para búsqueda flexible"""
        # Diccionario de reemplazos de acentos
        reemplazos = {
            'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
            'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
            'Ñ': 'N', 'ñ': 'n'
        }
        
        texto_normalizado = texto
        for acento, sin_acento in reemplazos.items():
            texto_normalizado = texto_normalizado.replace(acento, sin_acento)
        
        return texto_normalizado
        
    def configurar_navegador(self):
        """Configurar y abrir navegador con sesión persistente"""
        print("🔧 Configurando navegador...")
        
        # Determinar la ruta del perfil según el sistema operativo
        import platform
        if platform.system() == 'Darwin':  # macOS
            user_data_dir = os.path.expanduser("~/Library/Application Support/Google/Chrome/selenium_wsp")
        elif platform.system() == 'Windows':
            user_data_dir = "C:/selenium_wsp"
        else:  # Linux
            user_data_dir = os.path.expanduser("~/.config/google-chrome/selenium_wsp")
        
        # Crear directorio si no existe
        os.makedirs(user_data_dir, exist_ok=True)
        print(f"📁 Usando perfil: {user_data_dir}")
        
        options = webdriver.ChromeOptions()
        options.add_argument(f"--user-data-dir={user_data_dir}")
        options.add_argument("--profile-directory=Default")
        options.add_argument("--start-maximized")
        options.add_argument("--no-first-run")
        options.add_argument("--no-default-browser-check")
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_experimental_option('excludeSwitches', ['enable-logging', 'enable-automation'])
        options.add_experimental_option('useAutomationExtension', False)
        options.add_experimental_option("prefs", {
            "credentials_enable_service": False,
            "profile.password_manager_enabled": False
        })
        
        try:
            self.driver = webdriver.Chrome(
                service=Service(ChromeDriverManager().install()), 
                options=options
            )
            
            print("✅ Abriendo WhatsApp Web...")
            self.driver.get("https://web.whatsapp.com")
            print("⏳ Esperando 8 segundos para cargar WhatsApp...")
            time.sleep(30)
            return True
            
        except Exception as e:
            print(f"❌ Error configurando navegador: {e}")
            return False
    
    def buscar_mensaje_objetivo_hoy(self):
        """Buscar específicamente el mensaje con la fecha de hoy - MÉTODO OPTIMIZADO"""
        try:
            print(f"🎯 Buscando mensaje: 'BUEN DIA TE DEJO LA LISTA DE HOY {self.fecha_hoy}'")
            
            # PASO 1: Ir al final del chat (mensajes más recientes) SIN scroll excesivo
            print("📍 Posicionándose al final del chat...")
            try:
                chat_container = None
                selectores_chat = [
                    '//div[@data-testid="chat-history"]',
                    '//div[@data-testid="conversation-panel-messages"]', 
                    '//div[contains(@class, "copyable-area")]'
                ]
                
                for selector in selectores_chat:
                    try:
                        chat_container = WebDriverWait(self.driver, 5).until(
                            EC.presence_of_element_located((By.XPATH, selector))
                        )
                        break
                    except:
                        continue
                
                if chat_container:
                    # IR DIRECTAMENTE al final (mensajes más recientes)
                    self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", chat_container)
                    time.sleep(2)
                    print("   ✅ Posicionado al final del chat")
                else:
                    print("   ⚠️ No se pudo encontrar contenedor del chat")
                    
            except Exception as e:
                print(f"   ⚠️ Error posicionándose al final: {e}")
            
            # PASO 2: Buscar el elemento específico con la clase exacta que mencionaste
            print("🔍 Buscando elemento con clase específica...")
            selector_objetivo = '//div[@class="x9f619 x1hx0egp x1yrsyyn xizg8k xu9hqtb xwib8y2"]'
            
            elementos_encontrados = self.driver.find_elements(By.XPATH, selector_objetivo)
            print(f"   📊 Encontrados {len(elementos_encontrados)} elementos con clase específica")
            
            # PASO 2.1: EXPANDIR MENSAJES LARGOS ANTES DE EXTRAER
            print("📖 Expandiendo mensajes largos antes de extraer...")
            self.expandir_mensaje_especifico()
            
            # Re-buscar elementos después de la expansión
            elementos_encontrados = self.driver.find_elements(By.XPATH, selector_objetivo)
            print(f"   📊 Después de expandir: {len(elementos_encontrados)} elementos")
            
            # PASO 3: Buscar dentro de esos elementos el mensaje con la fecha de hoy
            for i, elemento in enumerate(elementos_encontrados):
                try:
                    texto_elemento = elemento.text.strip()
                    if not texto_elemento:
                        continue
                        
                    # Convertir a mayúsculas y normalizar (sin acentos) para comparación
                    texto_upper = texto_elemento.upper()
                    texto_normalizado = self.normalizar_texto(texto_upper)
                    fecha_normalizada = self.normalizar_texto(self.fecha_hoy)
                    
                    # EXCLUSIÓN: Ignorar completamente listas de colores
                    if "LISTA DE MODELOS Y COLORES" in texto_normalizado:
                        print(f"   ❌ Elemento {i+1} IGNORADO: Contiene 'LISTA DE MODELOS Y COLORES'")
                        continue
                    
                    if "📱👇🏻📱" in texto_elemento:
                        print(f"   ❌ Elemento {i+1} IGNORADO: Contiene emojis de lista de colores")
                        continue
                    
                    # BÚSQUEDA: Mensaje con fecha de hoy (sin acentos para mayor flexibilidad)
                    if (("BUEN DIA TE DEJO LA LISTA DE HOY" in texto_normalizado or 
                         "LISTA DE HOY" in texto_normalizado) and 
                        fecha_normalizada in texto_normalizado):
                        
                        print(f"   🎯 ¡MENSAJE OBJETIVO ENCONTRADO! (Elemento {i+1})")
                        print(f"   📝 Longitud: {len(texto_elemento)} caracteres")
                        print(f"   📝 Inicio: '{texto_elemento[:150]}...'")
                        
                        # VERIFICACIÓN DE COMPLETITUD
                        if texto_elemento.endswith("…") or texto_elemento.endswith("...") or "Leer más" in texto_elemento:
                            print(f"   ⚠️ MENSAJE PARECE INCOMPLETO - Aplicando expansión agresiva...")
                            
                            # ESTRATEGIA AGRESIVA: Expandir TODO en el área del mensaje
                            try:
                                self.driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", elemento)
                                time.sleep(2)
                                
                                # Buscar TODOS los posibles botones "Leer más" en un área amplia
                                selectores_expansion = [
                                    './/span[contains(text(), "Leer más")]',
                                    './/span[contains(text(), "Lee más")]',
                                    './/span[contains(text(), "…")]',
                                    './/span[contains(text(), "...")]',
                                    './/*[contains(text(), "Read more")]',
                                    './/div[@role="button"]',
                                    './/*[contains(@class, "read-more")]'
                                ]
                                
                                # También buscar en el contenedor padre y hermanos
                                areas_busqueda = [elemento]
                                try:
                                    contenedor_padre = elemento.find_element(By.XPATH, '..')
                                    areas_busqueda.append(contenedor_padre)
                                    
                                    # Y en el contenedor abuelo
                                    contenedor_abuelo = contenedor_padre.find_element(By.XPATH, '..')
                                    areas_busqueda.append(contenedor_abuelo)
                                except:
                                    pass
                                
                                total_botones_expandidos = 0
                                
                                for area in areas_busqueda:
                                    for selector in selectores_expansion:
                                        try:
                                            botones = area.find_elements(By.XPATH, selector)
                                            if botones:
                                                print(f"     🎯 Encontrados {len(botones)} botones con '{selector}' en área")
                                                
                                                for j, boton in enumerate(botones):
                                                    try:
                                                        if boton.is_displayed() and boton.is_enabled():
                                                            # Hacer scroll al botón específico
                                                            self.driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", boton)
                                                            time.sleep(1)
                                                            
                                                            # Múltiples métodos de clic
                                                            click_exitoso = False
                                                            
                                                            # Método 1: JavaScript click
                                                            try:
                                                                self.driver.execute_script("arguments[0].click();", boton)
                                                                click_exitoso = True
                                                                print(f"       ✅ Botón {j+1} expandido con JS")
                                                                time.sleep(3)  # Tiempo extendido para expansión
                                                            except:
                                                                pass
                                                            
                                                            # Método 2: Click directo
                                                            if not click_exitoso:
                                                                try:
                                                                    boton.click()
                                                                    click_exitoso = True
                                                                    print(f"       ✅ Botón {j+1} expandido con click directo")
                                                                    time.sleep(3)
                                                                except:
                                                                    pass
                                                            
                                                            # Método 3: Doble clic
                                                            if not click_exitoso:
                                                                try:
                                                                    self.driver.execute_script("arguments[0].dispatchEvent(new MouseEvent('click', {bubbles: true}));", boton)
                                                                    click_exitoso = True
                                                                    print(f"       ✅ Botón {j+1} expandido con evento")
                                                                    time.sleep(3)
                                                                except:
                                                                    pass
                                                            
                                                            if click_exitoso:
                                                                total_botones_expandidos += 1
                                                            
                                                    except Exception as btn_error:
                                                        continue
                                        except:
                                            continue
                                
                                print(f"   🎉 Total de botones expandidos en expansión agresiva: {total_botones_expandidos}")
                                
                                # Dar tiempo para que TODO se cargue
                                time.sleep(5)
                                
                                # Re-extraer el texto después de la expansión agresiva
                                tiempo_espera = 0
                                max_espera = 15  # 15 segundos máximo
                                
                                while tiempo_espera < max_espera:
                                    try:
                                        texto_actualizado = elemento.text.strip()
                                        if len(texto_actualizado) > len(texto_elemento) and not texto_actualizado.endswith("…"):
                                            print(f"   🎉 ¡EXPANSIÓN EXITOSA! Texto expandido de {len(texto_elemento)} a {len(texto_actualizado)} caracteres")
                                            texto_elemento = texto_actualizado
                                            break
                                        else:
                                            time.sleep(1)
                                            tiempo_espera += 1
                                    except:
                                        time.sleep(1)
                                        tiempo_espera += 1
                                
                                if tiempo_espera >= max_espera:
                                    print(f"   ⚠️ Tiempo de espera agotado, usando texto actual de {len(texto_elemento)} caracteres")
                                    
                            except Exception as e:
                                print(f"   ⚠️ Error en expansión agresiva: {e}")
                        
                        # Guardar referencia al elemento
                        self.mensaje_objetivo_encontrado = True
                        self.elemento_mensaje_objetivo = elemento
                        
                        return texto_elemento
                        
                except Exception as e:
                    print(f"   ⚠️ Error procesando elemento {i+1}: {e}")
                    continue
            
            # PASO 4: Si no se encontró con la clase específica, búsqueda alternativa MÁS FLEXIBLE
            print("🔄 Búsqueda alternativa: buscando mensaje más reciente del día...")
            
            # Buscar simplemente por "LISTA DE HOY" y el número del día (usar día seleccionado)
            m = re.search(r"\b(\d{1,2})\b", self.fecha_hoy)
            dia_numero = m.group(1).lstrip('0') if m else str(datetime.now().day)
            selector_alternativo = f'//div[contains(text(), "LISTA DE HOY") and contains(text(), "{dia_numero}")]'
            elementos_alternativos = self.driver.find_elements(By.XPATH, selector_alternativo)
            
            if elementos_alternativos:
                print(f"   ✅ Encontrado en búsqueda alternativa!")
                elemento_alternativo = elementos_alternativos[-1]  # Tomar el más reciente (último)
                
                # Buscar el contenedor padre que tenga todo el mensaje
                contenedor_padre = elemento_alternativo
                for nivel in range(10):  # Máximo 10 niveles hacia arriba
                    try:
                        contenedor_padre = contenedor_padre.find_element(By.XPATH, '..')
                        texto_contenedor = contenedor_padre.text.strip()
                        
                        # Si el contenedor tiene suficiente contenido, usarlo
                        if len(texto_contenedor) > 500:  # Mínimo para una lista
                            print(f"   📦 Usando contenedor padre (nivel {nivel+1})")
                            print(f"   📝 Longitud: {len(texto_contenedor)} caracteres")
                            
                            self.mensaje_objetivo_encontrado = True
                            self.elemento_mensaje_objetivo = contenedor_padre
                            
                            return texto_contenedor
                            
                    except Exception as e:
                        break
            
            # PASO 5: BÚSQUEDA EXHAUSTIVA - Si aún no se encontró completo
            print("🔍 BÚSQUEDA EXHAUSTIVA: Buscando versión completa en todo el chat...")
            
            # Expandir TODOS los mensajes del día de hoy para asegurar completitud
            self.expandir_todos_los_mensajes_hoy()
            
            # Re-buscar después de expansión exhaustiva
            elementos_exhaustivos = self.driver.find_elements(By.XPATH, selector_objetivo)
            
            for i, elemento in enumerate(elementos_exhaustivos):
                try:
                    texto_elemento = elemento.text.strip()
                    if not texto_elemento:
                        continue
                        
                    texto_upper = texto_elemento.upper()
                    texto_normalizado = self.normalizar_texto(texto_upper)
                    fecha_normalizada = self.normalizar_texto(self.fecha_hoy)
                    
                    # Solo mensajes con la fecha de hoy y que contengan precios
                    if (fecha_normalizada in texto_normalizado and 
                        ("BUEN DIA TE DEJO LA LISTA DE HOY" in texto_normalizado or 
                         "LISTA DE HOY" in texto_normalizado) and
                        "$ " in texto_elemento):
                        
                        # Verificar si es más completo que versiones anteriores
                        if not texto_elemento.endswith("…") and not texto_elemento.endswith("..."):
                            print(f"   🎉 ¡VERSIÓN COMPLETA ENCONTRADA! (Búsqueda exhaustiva)")
                            print(f"   📝 Longitud: {len(texto_elemento)} caracteres")
                            
                            self.mensaje_objetivo_encontrado = True
                            self.elemento_mensaje_objetivo = elemento
                            
                            return texto_elemento
                        else:
                            print(f"   ⚠️ Versión encontrada pero aún incompleta: {len(texto_elemento)} chars")
                            
                except Exception as e:
                    continue
            
            print("   ❌ No se encontró el mensaje objetivo")
            return None
            
        except Exception as e:
            print(f"❌ Error en búsqueda del mensaje objetivo: {e}")
            return None
    
    def expandir_mensaje_especifico(self):
        """Expandir específicamente mensajes que contengan la fecha de hoy - ACTUALIZADO CON HTML REAL"""
        try:
            print("🎯 Buscando mensajes específicos para expandir con selectores actualizados...")
            
            # Buscar botones "Lee más" usando la información HTML real proporcionada
            botones_encontrados = []
            
            # Método 1: Buscar botones cerca de elementos que contengan la fecha
            try:
                elementos_con_fecha = self.driver.find_elements(By.XPATH, 
                    f'//*[contains(text(), "{self.fecha_hoy}")]')
                
                for elemento in elementos_con_fecha:
                    # Buscar botones "Lee más" cerca de este elemento usando los selectores reales
                    try:
                        # Selector específico basado en el HTML real proporcionado
                        botones_cerca = elemento.find_elements(By.XPATH, 
                            './/following-sibling::*//div[@role="button" and contains(@class, "read-more-button")]')
                        botones_encontrados.extend(botones_cerca)
                        
                        # También buscar texto "Leer más" en divs con role="button"
                        botones_texto = elemento.find_elements(By.XPATH, 
                            './/following-sibling::*//div[@role="button" and contains(text(), "Leer más")]')
                        botones_encontrados.extend(botones_texto)
                        
                        # Buscar en contenedor padre con clases específicas
                        contenedor = elemento.find_element(By.XPATH, '..')
                        botones_padre = contenedor.find_elements(By.XPATH, 
                            './/div[@role="button" and contains(@class, "read-more-button")]')
                        botones_encontrados.extend(botones_padre)
                    except:
                        continue
                        
            except Exception as e:
                print(f"   ⚠️ Error buscando elementos con fecha: {e}")
            
            # Método 2: Buscar todos los botones "Lee más" visibles con selectores actualizados
            try:
                selectores_boton = [
                    # Selector principal basado en HTML real
                    '//div[@role="button" and contains(@class, "read-more-button")]',
                    '//div[@role="button" and contains(text(), "Leer más")]',
                    '//div[@role="button" and contains(@class, "xuxw1ft") and contains(text(), "Leer más")]',
                    # Selectores de fallback
                    '//span[contains(text(), "Lee más")]',
                    '//span[contains(text(), "…")]',
                    '//*[contains(text(), "Read more")]',
                    '//*[@role="button" and contains(text(), "más")]'
                ]
                
                for selector in selectores_boton:
                    botones = self.driver.find_elements(By.XPATH, selector)
                    if botones:
                        print(f"   📍 Selector '{selector[:60]}...' encontró {len(botones)} botones")
                    botones_encontrados.extend(botones)
                    
            except Exception as e:
                print(f"   ⚠️ Error buscando botones Lee más: {e}")
            
            # Eliminar duplicados por posición
            botones_unicos = []
            posiciones_vistas = set()
            
            for boton in botones_encontrados:
                try:
                    location = boton.location
                    pos_key = f"{location['x']},{location['y']}"
                    if pos_key not in posiciones_vistas:
                        posiciones_vistas.add(pos_key)
                        botones_unicos.append(boton)
                except:
                    botones_unicos.append(boton)
            
            print(f"   📊 Encontrados {len(botones_unicos)} botones únicos para expandir")
            
            # Expandir cada botón con métodos optimizados para la estructura HTML real
            expandidos = 0
            for i, boton in enumerate(botones_unicos):
                try:
                    if boton.is_displayed() and boton.is_enabled():
                        # Hacer scroll hacia el botón
                        self.driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", boton)
                        time.sleep(1)
                        
                        # Intentar hacer clic con múltiples métodos optimizados para el HTML real
                        click_exitoso = self.hacer_click_optimizado_leer_mas(boton, i + 1)
                        if click_exitoso:
                            expandidos += 1
                            print(f"   ✅ Botón {i+1} expandido exitosamente")
                            time.sleep(2)  # Tiempo para que se expanda
                        else:
                            print(f"   ❌ No se pudo expandir botón {i+1}")
                        
                except Exception as e:
                    print(f"   ⚠️ Error procesando botón {i+1}: {e}")
                    continue
            
            print(f"✅ Total de botones expandidos: {expandidos}")
            
        except Exception as e:
            print(f"⚠️ Error expandiendo mensajes específicos: {e}")

    def hacer_click_optimizado_leer_mas(self, boton, numero_boton):
        """Método optimizado para hacer clic en botones 'Leer más' con la estructura HTML real"""
        try:
            # Obtener información del botón para debugging
            try:
                tag_name = boton.tag_name
                classes = boton.get_attribute("class")
                role = boton.get_attribute("role")
                texto = boton.text
                print(f"     🎯 Botón {numero_boton}: <{tag_name}> role='{role}' texto='{texto[:20]}'")
            except:
                print(f"     🎯 Botón {numero_boton}: Información no accesible")
            
            # Método 1: Clic JavaScript directo (más compatible con elementos complejos)
            try:
                self.driver.execute_script("arguments[0].click();", boton)
                print(f"       ✅ Método 1 (JS click): Exitoso")
                return True
            except Exception as e:
                print(f"       ⚠️ Método 1 falló: {type(e).__name__}")
            
            # Método 2: Trigger de evento click manualmente
            try:
                self.driver.execute_script("""
                    var evt = new MouseEvent('click', {
                        view: window,
                        bubbles: true,
                        cancelable: true,
                        clientX: arguments[0].getBoundingClientRect().left + arguments[0].offsetWidth/2,
                        clientY: arguments[0].getBoundingClientRect().top + arguments[0].offsetHeight/2
                    });
                    arguments[0].dispatchEvent(evt);
                """, boton)
                print(f"       ✅ Método 2 (Event dispatch): Exitoso")
                return True
            except Exception as e:
                print(f"       ⚠️ Método 2 falló: {type(e).__name__}")
            
            # Método 3: Clic directo con WebDriver
            try:
                boton.click()
                print(f"       ✅ Método 3 (Direct click): Exitoso")
                return True
            except Exception as e:
                print(f"       ⚠️ Método 3 falló: {type(e).__name__}")
            
            # Método 4: Clic usando ActionChains (para casos complejos)
            try:
                from selenium.webdriver.common.action_chains import ActionChains
                actions = ActionChains(self.driver)
                actions.move_to_element(boton).click().perform()
                print(f"       ✅ Método 4 (ActionChains): Exitoso")
                return True
            except Exception as e:
                print(f"       ⚠️ Método 4 falló: {type(e).__name__}")
            
            # Método 5: Focus + Enter (simular teclado)
            try:
                self.driver.execute_script("arguments[0].focus();", boton)
                boton.send_keys('\ue007')  # Enter key
                print(f"       ✅ Método 5 (Focus + Enter): Exitoso")
                return True
            except Exception as e:
                print(f"       ⚠️ Método 5 falló: {type(e).__name__}")
            
            print(f"       ❌ Todos los métodos fallaron para botón {numero_boton}")
            return False
            
        except Exception as e:
            print(f"       ❌ Error general en click optimizado: {e}")
            return False
    
    def expandir_todos_los_mensajes_hoy(self):
        """Expansión exhaustiva de TODOS los mensajes que puedan contener la lista de hoy - ACTUALIZADO CON HTML REAL"""
        try:
            print("🚀 EXPANSIÓN EXHAUSTIVA: Expandiendo todos los mensajes posibles con selectores actualizados...")
            
            # Buscar TODOS los botones "Lee más" visibles en la página usando selectores basados en HTML real
            selectores_exhaustivos = [
                # Selectores principales basados en HTML real proporcionado
                '//div[@role="button" and contains(@class, "read-more-button")]',
                '//div[@role="button" and contains(text(), "Leer más")]',
                '//div[@role="button" and contains(@class, "xuxw1ft") and contains(text(), "Leer más")]',
                '//div[@role="button" and contains(@class, "x1ypdohk") and contains(text(), "Leer más")]',
                # Selectores de fallback tradicionales
                '//span[contains(text(), "Lee más")]',
                '//span[contains(text(), "…")]', 
                '//span[contains(text(), "...")]',
                '//*[contains(text(), "Read more")]',
                '//div[@role="button" and contains(., "más")]',
                '//*[contains(@class, "read-more")]'
            ]
            
            todos_los_botones = []
            
            for selector in selectores_exhaustivos:
                try:
                    botones = self.driver.find_elements(By.XPATH, selector)
                    if botones:
                        print(f"   📊 Selector '{selector[:50]}...' encontró {len(botones)} botones")
                    todos_los_botones.extend(botones)
                except:
                    continue
            
            # Eliminar duplicados por posición
            botones_unicos = []
            posiciones_vistas = set()
            
            for boton in todos_los_botones:
                try:
                    if boton.is_displayed():
                        location = boton.location
                        pos_key = f"{location['x']},{location['y']}"
                        if pos_key not in posiciones_vistas:
                            posiciones_vistas.add(pos_key)
                            botones_unicos.append(boton)
                except:
                    continue
            
            print(f"   🎯 Total de botones únicos encontrados: {len(botones_unicos)}")
            
            # Expandir todos los botones encontrados con método optimizado
            expandidos_exitosos = 0
            
            for i, boton in enumerate(botones_unicos):
                print(f"   🔄 Procesando botón {i+1}/{len(botones_unicos)}...")
                
                try:
                    # Verificar que el botón sigue siendo válido
                    if not (boton.is_displayed() and boton.is_enabled()):
                        print(f"     ⚠️ Botón {i+1} ya no es válido")
                        continue
                        
                    # Scroll hacia el botón
                    self.driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", boton)
                    time.sleep(0.5)
                    
                    # Usar el método optimizado de clic
                    click_exitoso = self.hacer_click_optimizado_leer_mas(boton, i + 1)
                    if click_exitoso:
                        expandidos_exitosos += 1
                        print(f"     ✅ Botón {i+1} expandido exitosamente")
                        time.sleep(1.5)  # Tiempo para que se expanda
                    else:
                        print(f"     ❌ No se pudo expandir botón {i+1}")
                        
                except Exception as e:
                    print(f"     ❌ Error procesando botón {i+1}: {e}")
                    continue
                
                # Cada 3 expansiones, pausa para que WhatsApp procese
                if (i + 1) % 3 == 0:
                    print(f"   ⏳ Pausa de procesamiento ({i+1}/{len(botones_unicos)})")
                    time.sleep(2)
            
            print(f"🎉 EXPANSIÓN EXHAUSTIVA COMPLETADA")
            print(f"   ✅ Botones expandidos exitosamente: {expandidos_exitosos}/{len(botones_unicos)}")
            
            # Dar tiempo para que todos los mensajes se carguen completamente
            time.sleep(3)
            
        except Exception as e:
            print(f"❌ Error en expansión exhaustiva: {e}")
    
    def ir_al_final_del_chat(self):
        """Ir directamente al final del chat para obtener SOLO los mensajes más recientes (hoy)"""
        try:
            print("📍 Yendo al final del chat para buscar SOLO mensajes de hoy...")
            
            # Encontrar el contenedor del chat
            chat_container = None
            selectores = [
                '//div[@data-testid="chat-history"]',
                '//div[@data-testid="conversation-panel-messages"]', 
                '//div[contains(@class, "copyable-area")]'
            ]
            
            for selector in selectores:
                try:
                    chat_container = WebDriverWait(self.driver, 5).until(
                        EC.presence_of_element_located((By.XPATH, selector))
                    )
                    print(f"   ✅ Contenedor encontrado con: {selector}")
                    break
                except:
                    continue
            
            if not chat_container:
                print("   ⚠️ No se pudo encontrar el contenedor del chat")
                return False
            
            # Ir al final del chat (mensajes más recientes)
            self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", chat_container)
            time.sleep(2)
            print("   ✅ Posicionado al final del chat (mensajes más recientes)")
            
            # NO hacer scroll hacia arriba - mantener solo en la zona más reciente
            # Solo un pequeño ajuste para asegurar que los mensajes estén completamente visibles
            self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollTop - 100;", chat_container)
            time.sleep(1)
            
            print("   🎯 Enfocado en mensajes más recientes (zona de hoy)")
            return True
            
        except Exception as e:
            print(f"⚠️ Error al ir al final del chat: {e}")
            return False
    
    def expandir_mensajes_largos(self):
        """Expandir mensajes que tengan 'Lee más...' con múltiples pasadas"""
        try:
            print("📖 Expandiendo mensajes largos...")
            total_expandidos = 0
            max_intentos = 5  # Máximo 5 pasadas para evitar bucle infinito
            
            for intento in range(max_intentos):
                # RE-BUSCAR botones "Lee más..." en CADA iteración para evitar stale elements
                print(f"   🔄 Pasada {intento + 1}: Re-buscando botones 'Lee más'...")
                
                # Buscar botones "Lee más..." con múltiples selectores - RENOVADOS EN CADA PASADA
                def buscar_botones_leer_mas():
                    botones_encontrados = []
                    
                    # Selector 1: Elementos span con texto
                    try:
                        botones_span = self.driver.find_elements(By.XPATH, 
                            '//span[contains(text(), "Lee más") or contains(text(), "Read more") or '
                            'contains(text(), "Show more") or contains(text(), "Ver más") or '
                            'contains(text(), "más...") or contains(text(), "...")]'
                        )
                        botones_encontrados.extend(botones_span)
                    except:
                        pass
                    
                    # Selector 2: Div con clase read-more-button
                    try:
                        botones_div_class = self.driver.find_elements(By.XPATH, 
                            '//div[contains(@class, "read-more-button")]'
                        )
                        botones_encontrados.extend(botones_div_class)
                    except:
                        pass
                    
                    # Selector 3: Cualquier elemento con texto "Leer más"
                    try:
                        botones_general = self.driver.find_elements(By.XPATH, 
                            '//*[contains(text(), "Leer más") or contains(text(), "Read more")]'
                        )
                        botones_encontrados.extend(botones_general)
                    except:
                        pass
                    
                    # Selector 4: Elementos clickeables con role="button"
                    try:
                        botones_role = self.driver.find_elements(By.XPATH, 
                            '//div[@role="button" and contains(text(), "más")]'
                        )
                        botones_encontrados.extend(botones_role)
                    except:
                        pass
                    
                    # Selector 5: Elementos que contengan "…" (pueden ser botones cortados)
                    try:
                        botones_puntos = self.driver.find_elements(By.XPATH, 
                            '//*[contains(text(), "…") and not(ancestor::*[contains(@class, "message")])]'
                        )
                        botones_encontrados.extend(botones_puntos)
                    except:
                        pass
                    
                    # Eliminar duplicados basándose en posición
                    botones_unicos = []
                    posiciones_vistas = set()
                    
                    for boton in botones_encontrados:
                        try:
                            # Usar la posición del elemento como identificador único
                            location = boton.location
                            pos_key = f"{location['x']},{location['y']}"
                            if pos_key not in posiciones_vistas:
                                posiciones_vistas.add(pos_key)
                                botones_unicos.append(boton)
                        except:
                            # Si no se puede obtener la posición, incluirlo de todos modos
                            botones_unicos.append(boton)
                    
                    return botones_unicos
                
                botones_leer_mas = buscar_botones_leer_mas()
                
                if not botones_leer_mas:
                    if intento == 0:
                        print("   ℹ️ No se encontraron mensajes para expandir")
                        # Debug: buscar elementos similares
                        try:
                            debug_elements = self.driver.find_elements(By.XPATH, '//*[contains(text(), "más")]')
                            if debug_elements:
                                print(f"   🔍 Debug: Encontrados {len(debug_elements)} elementos con 'más':")
                                for elem in debug_elements[:3]:  # Mostrar solo los primeros 3
                                    try:
                                        print(f"     - <{elem.tag_name}> '{elem.text[:50]}...'")
                                    except:
                                        print(f"     - <elemento no accesible>")
                        except:
                            pass
                    break
                
                print(f"   � Encontrados {len(botones_leer_mas)} botones en esta pasada")
                
                expandidos_en_pasada = 0
                # Procesar cada botón INMEDIATAMENTE después de encontrarlo
                for i in range(len(botones_leer_mas)):
                    try:
                        # RE-BUSCAR el botón específico para evitar stale reference
                        botones_actuales = buscar_botones_leer_mas()
                        
                        if i >= len(botones_actuales):
                            print(f"     ⚠️ Botón {i+1} ya no existe (posiblemente expandido)")
                            continue
                            
                        boton = botones_actuales[i]
                        
                        # Verificar si el botón aún es válido y visible
                        try:
                            if not (boton.is_displayed() and boton.is_enabled()):
                                continue
                        except:
                            print(f"     ⚠️ Botón {i+1} se volvió inválido")
                            continue
                        
                        # Obtener información del botón ANTES de hacer clic
                        try:
                            texto_boton = boton.text[:30] if boton.text else "Sin texto"
                            tag_name = boton.tag_name
                        except:
                            texto_boton = "No accesible"
                            tag_name = "unknown"
                        
                        print(f"     🎯 Clickeando botón {i+1}: <{tag_name}> '{texto_boton}'...")
                        
                        # Hacer scroll hacia el botón
                        try:
                            self.driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", boton)
                            time.sleep(1)
                        except:
                            print(f"     ⚠️ No se pudo hacer scroll al botón {i+1}")
                            continue
                        
                        # Intentar hacer clic con manejo robusto de errores
                        click_exitoso = False
                        
                        # Método 1: JavaScript click
                        try:
                            self.driver.execute_script("arguments[0].click();", boton)
                            click_exitoso = True
                            print(f"       ✅ Click exitoso con JavaScript")
                            time.sleep(2)
                        except Exception as e:
                            print(f"       ⚠️ Fallo JavaScript click: {type(e).__name__}")
                        
                        # Método 2: Click directo si el primero falló
                        if not click_exitoso:
                            try:
                                boton.click()
                                click_exitoso = True
                                print(f"       ✅ Click exitoso directo")
                                time.sleep(2)
                            except Exception as e:
                                print(f"       ⚠️ Fallo click directo: {type(e).__name__}")
                        
                        if click_exitoso:
                            expandidos_en_pasada += 1
                            print(f"       🎉 Mensaje expandido exitosamente!")
                            
                            # Pausa para que se cargue completamente
                            time.sleep(1.5)
                            
                            # Cada 2 expansiones exitosas, pausa más larga
                            if expandidos_en_pasada % 2 == 0:
                                print(f"       ⏳ Pausa de procesamiento...")
                                time.sleep(3)
                        else:
                            print(f"       ❌ No se pudo hacer click en botón {i+1}")
                        
                    except Exception as e:
                        print(f"       ⚠️ Error procesando botón {i+1}: {type(e).__name__}")
                        continue
                
                total_expandidos += expandidos_en_pasada
                print(f"   ✅ Expandidos en esta pasada: {expandidos_en_pasada}")
                
                # Si no se expandió ninguno en esta pasada, salir del bucle
                if expandidos_en_pasada == 0:
                    break
                
                # Pausa entre pasadas para que WhatsApp procese los cambios
                time.sleep(3)  # Aumentado tiempo entre pasadas
            
            print(f"✅ Total de mensajes expandidos: {total_expandidos}")
            
            # VERIFICACIÓN ADICIONAL: Buscar mensajes que aún puedan estar cortados
            if total_expandidos > 0:
                print("   🔍 Verificación final: Buscando mensajes que puedan estar incompletos...")
                try:
                    # Buscar elementos que terminen con "..." o estén cortados
                    elementos_cortados = self.driver.find_elements(By.XPATH, 
                        '//*[contains(text(), "...") or contains(text(), "…")]'
                    )
                    if elementos_cortados:
                        print(f"   ⚠️ Detectados {len(elementos_cortados)} elementos que pueden estar cortados")
                        
                        # Intentar hacer scroll y volver a expandir
                        for elem in elementos_cortados[:3]:  # Solo los primeros 3
                            try:
                                self.driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", elem)
                                time.sleep(1)
                                texto = elem.text
                                if "…" in texto or "..." in texto:
                                    print(f"   🔄 Reintentando expansión para: '{texto[:50]}...'")
                                    # Buscar botones "Lee más" cerca de este elemento
                                    botones_cerca = elem.find_elements(By.XPATH, './/following-sibling::*//span[contains(text(), "Lee más")]')
                                    if botones_cerca:
                                        botones_cerca[0].click()
                                        time.sleep(2)
                            except:
                                continue
                                
                except Exception as e:
                    print(f"   ⚠️ Error en verificación final: {e}")
            
            # Hacer scroll final para asegurar que todos los mensajes estén cargados
            if total_expandidos > 0:
                print("   📜 Haciendo scroll final para cargar contenido expandido...")
                try:
                    # Buscar el contenedor del chat con múltiples selectores
                    chat_container = None
                    selectores_chat = [
                        '//div[@data-testid="chat-history"]',  # Corregido el typo
                        '//div[@data-testid="conversation-panel-messages"]', 
                        '//div[contains(@class, "copyable-area")]'
                    ]
                    
                    for selector in selectores_chat:
                        try:
                            chat_container = self.driver.find_element(By.XPATH, selector)
                            break
                        except:
                            continue
                    
                    if chat_container:
                        self.driver.execute_script("arguments[0].scrollTop = 0;", chat_container)
                        time.sleep(2)  # Más tiempo para cargar
                        # Scroll hacia abajo para cargar todo el contenido
                        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", chat_container)
                        time.sleep(1)
                    else:
                        print("   ⚠️ No se pudo encontrar contenedor para scroll final")
                        
                except Exception as scroll_error:
                    print(f"   ⚠️ Error en scroll final: {scroll_error}")
                    print("   ℹ️ Continuando sin scroll final...")
        
        except Exception as e:
            print(f"⚠️ Error al expandir mensajes: {e}")
            print("   ℹ️ Continuando con la extracción...")
    
    def filtrar_mensajes_del_dia(self, textos, filtro_inicio):
        """Filtrar mensajes que contengan palabras clave de listas de precios (NO colores)"""
        mensajes_filtrados = []
        
        print(f"🔍 Filtrando {len(textos)} mensajes buscando SOLO listas de precios...")
        
        for i, texto in enumerate(textos):
            texto_upper = texto.upper()
            
            # EXCLUIR específicamente listas de colores/modelos
            criterios_exclusion = [
                "LISTA DE MODELOS Y COLORES",
                "MODELOS Y COLORES DEL DÍA",
                "MODELOS Y COLORES",
                "DISPONIBILIDAD",
                "STOCK DISPONIBLE", 
                "COLORES DISPONIBLES"
            ]
            
            # Verificar si el mensaje debe ser excluido
            excluir_mensaje = False
            for criterio_exclusion in criterios_exclusion:
                if criterio_exclusion in texto_upper:
                    excluir_mensaje = True
                    print(f"   ❌ Mensaje {i+1} EXCLUIDO: Contiene '{criterio_exclusion}' (es lista de colores)")
                    break
            
            # Verificación adicional: Si contiene productos sin precios ($), excluir
            if not excluir_mensaje and "$ " not in texto:
                # Contar líneas de productos vs líneas con precios
                lineas = texto.split('\n')
                lineas_con_productos = 0
                lineas_con_precios = 0
                
                for linea in lineas:
                    linea_clean = linea.strip()
                    if len(linea_clean) > 10:  # Líneas significativas
                        if any(marca in linea_clean.upper() for marca in ['IPHONE', 'SAMSUNG', 'MOTOROLA', 'XIAOMI', 'INFINIX']):
                            lineas_con_productos += 1
                        if '$ ' in linea_clean:
                            lineas_con_precios += 1
                
                # Si hay muchos productos pero ningún precio, es lista de colores
                if lineas_con_productos > 5 and lineas_con_precios == 0:
                    excluir_mensaje = True
                    print(f"   ❌ Mensaje {i+1} EXCLUIDO: {lineas_con_productos} productos sin precios (lista de disponibilidad)")
            
            
            if excluir_mensaje:
                continue
            
            # Buscar SOLO mensajes con precios reales
            criterios_busqueda = [
                # Mensajes tradicionales con precios (deben contener $)
                "BUEN DIA TE DEJO LA LISTA DE HOY",
                "BUEN DÍA TE DEJO LA LISTA DE HOY", 
                # Mensajes de precios específicos
                "LISTA DE PRECIOS",
                "PRECIOS DEL DIA", 
                "PRECIOS DEL DÍA",
                "LISTA ACTUALIZADA"
            ]
            
            encontrado = False
            tipo_mensaje = ""
            
            for criterio in criterios_busqueda:
                if criterio in texto_upper:
                    # VERIFICACIÓN OBLIGATORIA: DEBE contener precios ($) para CUALQUIER criterio
                    if "$ " not in texto:
                        print(f"   ⚠️ Mensaje {i+1} contiene '{criterio}' pero NO tiene precios ($) - RECHAZADO")
                        continue  # Saltar si no tiene precios
                    
                    # Verificación adicional: Contar ratio precios vs productos
                    lineas = texto.split('\n')
                    productos_encontrados = 0
                    precios_encontrados = 0
                    
                    for linea in lineas:
                        linea_clean = linea.strip()
                        if len(linea_clean) > 5:
                            if any(marca in linea_clean.upper() for marca in ['IPHONE', 'SAMSUNG', 'MOTOROLA', 'XIAOMI', 'INFINIX']):
                                productos_encontrados += 1
                            if '$ ' in linea_clean:
                                precios_encontrados += 1
                    
                    # Debe haber una proporción razonable de precios por productos
                    if productos_encontrados > 10 and precios_encontrados == 0:
                        print(f"   ⚠️ Mensaje {i+1} tiene {productos_encontrados} productos pero 0 precios - RECHAZADO (es lista de disponibilidad)")
                        continue
                    
                    encontrado = True
                    tipo_mensaje = criterio
                    print(f"   ✅ Mensaje VÁLIDO: {productos_encontrados} productos, {precios_encontrados} precios")
                    break
            
            if encontrado:
                print(f"   ✅ Mensaje {i+1} aceptado: Contiene '{tipo_mensaje}' CON PRECIOS")
                print(f"   📝 Longitud: {len(texto)} caracteres")
                print(f"   📝 Inicio: '{texto[:100]}...'")
                mensajes_filtrados.append(texto)
            else:
                print(f"   ❌ Mensaje {i+1} rechazado: No contiene criterios de búsqueda")
                print(f"   📝 Vista previa: '{texto[:100]}...'")
                
        if not mensajes_filtrados:
            print("   ⚠️ NINGÚN mensaje pasó el filtro. Aplicando filtro de emergencia...")
            # Filtro de emergencia: aceptar cualquier mensaje que contenga "LISTA" y sea largo
            for i, texto in enumerate(textos):
                texto_upper = texto.upper()
                if ("LISTA" in texto_upper and len(texto) > 500):  # Mensajes largos con "LISTA"
                    print(f"   🆘 FILTRO DE EMERGENCIA: Aceptando mensaje {i+1} (contiene LISTA y es largo)")
                    print(f"   📝 Longitud: {len(texto)} caracteres")
                    mensajes_filtrados.append(texto)
                    break  # Solo tomar el primero que encuentre
                
        return mensajes_filtrados
    
    def verificar_chat_tiene_mensajes_hoy(self):
        """Verificar específicamente si existe el mensaje objetivo de hoy - VERSIÓN REFACTORIZADA"""
        try:
            print("🔍 Verificación rápida: ¿Existe el mensaje de hoy?")
            
            # Buscar directamente el mensaje objetivo
            mensaje_encontrado = self.buscar_mensaje_objetivo_hoy()
            
            if mensaje_encontrado:
                print("   ✅ ¡Mensaje de hoy confirmado!")
                return True
            else:
                print("   ❌ No se encontró mensaje de hoy")
                return False
                
        except Exception as e:
            print(f"   ❌ Error verificando mensaje de hoy: {e}")
            return False

    def buscar_y_abrir_chat(self, nombre_proveedor, config):
        """Buscar y abrir el chat del proveedor con búsqueda flexible"""
        try:
            print(f"🔍 Buscando chat: {nombre_proveedor}")
            
            # Buscar el campo de búsqueda y hacer clic para asegurar que esté activo
            search_box = WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.XPATH, '//div[@contenteditable="true"][@data-tab="3"]'))
            )
            
            # Hacer clic explícito en el campo de búsqueda para activarlo
            print("   🎯 Activando campo de búsqueda...")
            self.driver.execute_script("arguments[0].click();", search_box)
            time.sleep(1)
            
            # Intentar con el nombre completo primero
            nombres_a_probar = [nombre_proveedor] + config.get("busqueda_alternativa", [])
            
            for nombre_busqueda in nombres_a_probar:
                print(f"   🔎 Probando con: '{nombre_busqueda}'")
                
                # Limpiar COMPLETAMENTE antes de cada intento
                self.forzar_limpieza_busqueda(search_box)
                time.sleep(1)

                # Escribir el nombre del proveedor
                search_box.send_keys(nombre_busqueda)
                time.sleep(3)
                
                # Buscar en la lista de chats
                chat_list = self.driver.find_elements(By.XPATH, '//span[@title]')
                chat_match = None
                
                for chat in chat_list:
                    titulo = chat.get_attribute("title").lower()
                    # Búsqueda más flexible
                    if (nombre_busqueda.lower() in titulo or 
                        any(alt.lower() in titulo for alt in config.get("busqueda_alternativa", []))):
                        chat_match = chat
                        print(f"   ✅ Encontrado: '{chat.get_attribute('title')}'")
                        break
                
                if chat_match:
                    # Hacer clic en el chat
                    chat_match.click()
                    time.sleep(4)
                    print(f"✅ Chat abierto: {chat.get_attribute('title')}")
                    return True
            
            print(f"❌ No se encontró ningún chat para: {nombre_proveedor}")
            return False
            
        except Exception as e:
            print(f"❌ Error abriendo chat {nombre_proveedor}: {e}")
            return False
    
    def extraer_mensaje_objetivo_optimizado(self):
        """Extracción optimizada del mensaje objetivo - REFACTORIZADO"""
        try:
            print("📝 Extrayendo mensaje objetivo con método optimizado...")
            
            # OPCIÓN 1: Si ya tenemos el mensaje guardado
            if (hasattr(self, 'mensaje_objetivo_encontrado') and self.mensaje_objetivo_encontrado and 
                hasattr(self, 'elemento_mensaje_objetivo') and self.elemento_mensaje_objetivo):
                
                print("   🎯 Usando mensaje objetivo encontrado anteriormente")
                try:
                    # Verificar si el elemento sigue siendo válido
                    if self.elemento_mensaje_objetivo.is_displayed():
                        texto_completo = self.elemento_mensaje_objetivo.text.strip()
                        if texto_completo:
                            print(f"   ✅ Mensaje extraído exitosamente: {len(texto_completo)} caracteres")
                            return [texto_completo]
                    else:
                        print("   ⚠️ Elemento guardado ya no está visible, re-buscando...")
                except Exception as e:
                    print(f"   ⚠️ Error con elemento guardado: {e}")
                    print("   🔄 Re-buscando mensaje objetivo...")
            
            # OPCIÓN 2: Buscar el mensaje objetivo desde cero
            mensaje_encontrado = self.buscar_mensaje_objetivo_hoy()
            
            if mensaje_encontrado:
                print(f"   ✅ Mensaje objetivo extraído: {len(mensaje_encontrado)} caracteres")
                return [mensaje_encontrado]
            else:
                print("   ❌ No se pudo extraer el mensaje objetivo")
                return []
                
        except Exception as e:
            print(f"❌ Error en extracción optimizada: {e}")
            return []

    def extraer_mensajes_desde_ultima_etiqueta(self):
        """MÉTODO REFACTORIZADO: Extracción directa y optimizada del mensaje objetivo"""
        try:
            print("📝 Iniciando extracción optimizada del mensaje objetivo...")
            
            # EXTRACCIÓN DIRECTA: Usar el nuevo método optimizado
            mensajes_extraidos = self.extraer_mensaje_objetivo_optimizado()
            
            if mensajes_extraidos:
                print(f"📊 Mensaje extraído exitosamente: {len(mensajes_extraidos[0])} caracteres")
                return mensajes_extraidos
            else:
                print("⚠️ No se pudo extraer el mensaje con el método optimizado")
                return []
            
        except Exception as e:
            print(f"❌ Error en extracción desde última etiqueta: {e}")
            return []
    
    def extraer_mensajes_por_etiquetas_dom(self):
        """Método original de extracción por etiquetas DOM"""
        try:
            print("� Buscando última etiqueta de fecha...")
            
            # Buscar todas las etiquetas de fecha (Hoy, Ayer, fechas específicas)
            # Incluir el selector específico proporcionado para el elemento "Hoy"
            selectores_fecha = [
                # Selector específico para el elemento "Hoy" con las clases exactas
                '//span[contains(@class, "x140p0ai") and contains(@class, "x1gufx9m") and contains(@class, "x1s928wv") and text()="Hoy"]',
                # Selector más general pero específico para "Hoy"
                '//span[contains(@class, "x140p0ai") and text()="Hoy"]',
                # Selectores originales como fallback
                '//span[contains(@class, "x140p0ai") and (text()="Hoy" or text()="Ayer" or text()="Today" or text()="Yesterday")]',
                '//span[text()="Hoy" or text()="Ayer" or text()="Today" or text()="Yesterday"]',
                '//div[contains(@class, "x1n2onr6")]//span[contains(@class, "x140p0ai")]'
            ]
            
            ultima_etiqueta = None
            etiqueta_hoy_encontrada = False
            
            for selector in selectores_fecha:
                try:
                    etiquetas = self.driver.find_elements(By.XPATH, selector)
                    if etiquetas:
                        # Priorizar específicamente la etiqueta "Hoy"
                        for etiqueta in reversed(etiquetas):  # Empezar por las más recientes
                            texto_etiqueta = etiqueta.text.strip()
                            if texto_etiqueta in ["Hoy", "Today"]:
                                ultima_etiqueta = etiqueta
                                etiqueta_hoy_encontrada = True
                                print(f"   🎯 Etiqueta 'Hoy' encontrada: '{texto_etiqueta}'")
                                break
                        
                        # Si encontramos "Hoy", salir del bucle principal
                        if etiqueta_hoy_encontrada:
                            break
                            
                        # Si no encontramos "Hoy", usar la última etiqueta como fallback
                        if not ultima_etiqueta:
                            ultima_etiqueta = etiquetas[-1]
                            texto_etiqueta = ultima_etiqueta.text
                            print(f"   ✅ Última etiqueta encontrada (fallback): '{texto_etiqueta}'")
                except:
                    continue
            
            if not ultima_etiqueta:
                print("   ⚠️ No se encontró ninguna etiqueta de fecha")
                return []
            
            # Verificar si realmente encontramos la etiqueta "Hoy"
            texto_final = ultima_etiqueta.text.strip()
            if not etiqueta_hoy_encontrada:
                print(f"   ⚠️ ADVERTENCIA: No se encontró etiqueta 'Hoy', usando '{texto_final}' como fallback")
                print("   💡 Esto podría significar que no hay mensajes de hoy o que la estructura del DOM cambió")
            else:
                print(f"   ✅ Confirmado: Procesando mensajes desde etiqueta 'Hoy'")
            
            # Buscar todos los mensajes que están después de esta etiqueta
            textos = []
            
            try:
                # Encontrar el contenedor padre de la etiqueta
                contenedor_etiqueta = ultima_etiqueta
                for _ in range(10):  # Subir hasta 10 niveles para encontrar el contenedor principal
                    contenedor_etiqueta = contenedor_etiqueta.find_element(By.XPATH, '..')
                    
                    # Buscar todos los mensajes siguientes en el chat
                    selectores_mensajes = [
                        './/following::div[contains(@class, "copyable-text")]',
                        './/following::span[contains(@class, "selectable-text")]',
                        './/following::div[@data-testid="msg-container"]//span',
                        './/following::div[contains(@class, "message")]//span[contains(@class, "selectable-text")]'
                    ]
                    
                    for selector_msg in selectores_mensajes:
                        try:
                            mensajes = contenedor_etiqueta.find_elements(By.XPATH, selector_msg)
                            if mensajes:
                                print(f"   📋 Encontrados {len(mensajes)} mensajes después de la etiqueta")
                                for msg in mensajes:
                                    texto = msg.text.strip()
                                    if texto and len(texto) > 2:
                                        textos.append(texto)
                                if textos:
                                    break
                        except:
                            continue
                    
                    if textos:
                        break
                        
            except Exception as e:
                print(f"   ⚠️ Error buscando mensajes después de etiqueta: {e}")
            
            # Si no encontró mensajes con el método anterior, usar método directo
            if not textos:
                print("   🔄 Intentando método directo...")
                try:
                    # Buscar mensajes directamente después de cualquier etiqueta de fecha
                    mensajes_directos = self.driver.find_elements(By.XPATH, 
                        '//span[text()="Hoy" or text()="Ayer"]/ancestor::div[1]/following-sibling::div//span[contains(@class, "selectable-text")]'
                    )
                    
                    if not mensajes_directos:
                        # Método alternativo más amplio
                        mensajes_directos = self.driver.find_elements(By.XPATH, 
                            '//div[contains(@class, "copyable-text")]'
                        )
                        # Tomar solo los últimos 20 mensajes
                        mensajes_directos = mensajes_directos[-20:] if len(mensajes_directos) > 20 else mensajes_directos
                    
                    for msg in mensajes_directos:
                        texto = msg.text.strip()
                        if texto and len(texto) > 2:
                            textos.append(texto)
                            
                except Exception as e:
                    print(f"   ⚠️ Error en método directo: {e}")
            
            # Eliminar duplicados manteniendo orden
            textos_unicos = []
            for texto in textos:
                if texto not in textos_unicos:
                    textos_unicos.append(texto)
            
            print(f"📊 Total mensajes extraídos desde última etiqueta: {len(textos_unicos)}")
            return textos_unicos
            
        except Exception as e:
            print(f"❌ Error extrayendo mensajes desde última etiqueta: {e}")
            return []
    
    def extraer_mensajes_fallback(self):
        """Método de fallback para extraer mensajes si no se encuentra la etiqueta 'Hoy'"""
        try:
            print("🔄 Ejecutando extracción de fallback...")
            
            # Intentar múltiples selectores para los mensajes
            selectores_mensajes = [
                '//div[@class="copyable-text"]',
                '//div[contains(@class, "copyable-text")]',
                '//span[@class="_ao3e selectable-text copyable-text"]',
                '//div[@data-testid="conversation-panel-messages"]//span',
                '//div[contains(@class, "message")]//span[contains(@class, "selectable-text")]'
            ]
            
            textos = []
            mensajes_encontrados = False
            
            for selector in selectores_mensajes:
                try:
                    mensajes_divs = self.driver.find_elements(By.XPATH, selector)
                    if mensajes_divs:
                        print(f"   ✅ Mensajes encontrados con selector fallback: {selector}")
                        for msg in mensajes_divs:
                            texto = msg.text.strip()
                            if texto and len(texto) > 2:
                                textos.append(texto)
                        mensajes_encontrados = True
                        break
                except Exception as e:
                    continue
            
            if not mensajes_encontrados:
                print("   ⚠️ Método de fallback también falló")
                return []
            
            # Eliminar duplicados manteniendo orden
            textos_unicos = []
            for texto in textos:
                if texto not in textos_unicos:
                    textos_unicos.append(texto)
            
            print(f"📊 Total mensajes fallback extraídos: {len(textos_unicos)}")
            return textos_unicos
            
        except Exception as e:
            print(f"❌ Error en método de fallback: {e}")
            return []
    
    def guardar_archivo_txt(self, textos, archivo_salida, nombre_proveedor):
        """Guardar mensajes en archivo .txt"""
        try:
            # Crear directorio si no existe
            os.makedirs("output", exist_ok=True)
            
            # Escribir archivo
            with open(archivo_salida, 'w', encoding='utf-8') as file:
                # Escribir encabezado
                file.write(f"# Lista de precios - {nombre_proveedor}\n")
                file.write(f"# Extraído automáticamente el {datetime.now().strftime('%d/%m/%Y %H:%M')}\n")
                file.write("# " + "="*60 + "\n\n")
                
                # Escribir mensajes
                for texto in textos:
                    file.write(texto + "\n")
            
            print(f"✅ Archivo guardado: {archivo_salida}")
            print(f"📄 Líneas escritas: {len(textos)}")
            return True
            
        except Exception as e:
            print(f"❌ Error guardando archivo {archivo_salida}: {e}")
            return False
    
    def limpiar_busqueda(self):
        """Limpiar el campo de búsqueda para el siguiente proveedor"""
        try:
            print("🧹 Limpiando campo de búsqueda...")
            search_box = WebDriverWait(self.driver, 5).until(
                EC.presence_of_element_located((By.XPATH, '//div[@contenteditable="true"][@data-tab="3"]'))
            )
            self.forzar_limpieza_busqueda(search_box)
            time.sleep(1)
            
            # Limpiar variables del mensaje objetivo para el siguiente proveedor
            self.mensaje_objetivo_encontrado = False
            self.elemento_mensaje_objetivo = None
            
        except Exception as e:
            print(f"⚠️ Error limpiando búsqueda: {e}")

    def forzar_limpieza_busqueda(self, search_box):
        """Método ultra-robusto para limpiar el buscador de WhatsApp"""
        try:
            # 1. Intentar hacer clic en el botón "X" (Cerrar búsqueda) si aparece
            try:
                x_button = self.driver.find_elements(By.XPATH, '//button[@aria-label="Cerrar búsqueda"] | //span[@data-icon="x-alt"]/..')
                if x_button:
                    self.driver.execute_script("arguments[0].click();", x_button[0])
                    time.sleep(0.5)
                    # Si el botón X funcionó, el search_box podría haber cambiado o estar vacío
            except:
                pass

            # 2. Limpieza vía JavaScript con disparador de eventos (crucial para React/frameworks)
            self.driver.execute_script("""
                var el = arguments[0];
                el.focus();
                el.innerText = '';
                el.innerHTML = '';
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            """, search_box)
            time.sleep(0.3)

            # 3. Limpieza vía teclado (respaldo físico)
            self.driver.execute_script("arguments[0].click();", search_box)
            search_box.send_keys('\ue009' + 'a')  # Ctrl+A
            time.sleep(0.2)
            search_box.send_keys('\ue003')  # Backspace
            time.sleep(0.2)
            search_box.send_keys('\ue017')  # Delete
            
            # 4. Escape para cerrar menús desplegables de búsqueda
            search_box.send_keys('\ue00c') # Escape
            
            # 5. Verificación final vía JS
            self.driver.execute_script("arguments[0].innerText = '';", search_box)
            self.driver.execute_script("arguments[0].dispatchEvent(new Event('input', { bubbles: true }));", search_box)
            
        except Exception as e:
            print(f"⚠️ Error en forzar_limpieza: {e}")

    def verificar_mensaje_completo(self, mensaje, numero_mensaje):
        """Verificar si un mensaje está completo o fue cortado"""
        try:
            # Verificaciones para detectar mensajes incompletos
            mensaje_lower = mensaje.lower()
            
            # 1. Verificar si termina abruptamente (con "..." o "…")
            if mensaje.endswith("…") or mensaje.endswith("..."):
                print(f"   ⚠️ Mensaje {numero_mensaje} parece estar cortado (termina con puntos suspensivos)")
                return False
            
            # 2. Verificar si hay palabras cortadas al final
            ultima_linea = mensaje.strip().split('\n')[-1].strip()
            if ultima_linea and len(ultima_linea) > 0:
                # Si la última línea termina con una palabra muy corta o extraña
                palabras_ultima_linea = ultima_linea.split()
                if palabras_ultima_linea:
                    ultima_palabra = palabras_ultima_linea[-1]
                    # Palabras sospechosamente cortas que podrían estar cortadas
                    if len(ultima_palabra) <= 3 and not ultima_palabra.isdigit() and "$" not in ultima_palabra:
                        print(f"   ⚠️ Mensaje {numero_mensaje} posiblemente cortado (última palabra: '{ultima_palabra}')")
                        return False
            
            # 3. Verificar estructura típica de lista completa
            lineas = mensaje.split('\n')
            tiene_header = False
            tiene_productos = False
            
            for linea in lineas:
                linea_clean = linea.strip().upper()
                if "BUEN DIA" in linea_clean or "LISTA" in linea_clean:
                    tiene_header = True
                if any(marca in linea_clean for marca in ['IPHONE', 'SAMSUNG', 'MOTOROLA', 'XIAOMI']):
                    tiene_productos = True
            
            # Un mensaje completo debería tener header y productos
            if not (tiene_header and tiene_productos):
                print(f"   ⚠️ Mensaje {numero_mensaje} no tiene estructura completa (header: {tiene_header}, productos: {tiene_productos})")
                return False
            
            # 4. Verificar longitud razonable
            if len(mensaje) < 500:
                print(f"   ⚠️ Mensaje {numero_mensaje} es muy corto ({len(mensaje)} caracteres) para ser una lista completa")
                return False
            
            print(f"   ✅ Mensaje {numero_mensaje} parece estar completo ({len(mensaje)} caracteres)")
            return True
            
        except Exception as e:
            print(f"   ⚠️ Error verificando completitud del mensaje {numero_mensaje}: {e}")
            return True  # En caso de error, asumir que está completo

    def procesar_proveedor(self, nombre_proveedor, config):
        """Procesar un proveedor específico"""
        print(f"\n{'='*60}")
        print(f"🏪 PROCESANDO: {nombre_proveedor}")
        print(f"{'='*60}")
        
        # Abrir chat
        if not self.buscar_y_abrir_chat(nombre_proveedor, config):
            return False
        
        # NUEVA VERIFICACIÓN: Comprobar si hay mensaje objetivo de hoy
        if not self.verificar_chat_tiene_mensajes_hoy():
            print(f"⏭️  SALTANDO {nombre_proveedor}: No tiene mensaje objetivo de hoy")
            return False
        
        print(f"✅ Confirmado: {nombre_proveedor} tiene mensaje objetivo de hoy - Continuando...")
        
        # EXTRACCIÓN DIRECTA: Sin scroll excesivo hacia atrás
        print("📝 Extrayendo mensaje objetivo directamente...")
        mensajes = self.extraer_mensajes_desde_ultima_etiqueta()
        if not mensajes:
            print(f"⚠️ No se encontraron mensajes para {nombre_proveedor}")
            return False
        
        # Filtrar mensajes del día
        mensajes_filtrados = self.filtrar_mensajes_del_dia(mensajes, config["filtro_inicio"])
        print(f"🎯 Mensajes filtrados del día: {len(mensajes_filtrados)}")
        
        # VALIDACIÓN: Verificar si algún mensaje está incompleto
        mensajes_completos = []
        for i, mensaje in enumerate(mensajes_filtrados):
            esta_completo = self.verificar_mensaje_completo(mensaje, i + 1)
            if esta_completo:
                mensajes_completos.append(mensaje)
            else:
                print(f"   🔄 Intentando re-extraer mensaje {i + 1}...")
                # Intentar re-extraer el mensaje
                mensajes_reextraidos = self.extraer_mensajes_desde_ultima_etiqueta()
                if mensajes_reextraidos:
                    # Tomar el mensaje más largo/completo
                    mensaje_mejor = max(mensajes_reextraidos, key=len)
                    if self.verificar_mensaje_completo(mensaje_mejor, i + 1):
                        mensajes_completos.append(mensaje_mejor)
                        print(f"   ✅ Mensaje {i + 1} re-extraído exitosamente")
                    else:
                        print(f"   ⚠️ Mensaje {i + 1} sigue incompleto, guardando versión actual")
                        mensajes_completos.append(mensaje)
        
        if not mensajes_completos:
            print(f"⚠️ No se encontraron mensajes completos del día para {nombre_proveedor}")
            print(f"⛔ No se guardarán mensajes viejos ni fallback.")
        
        # Guardar archivo
        exito = self.guardar_archivo_txt(
            mensajes_completos, 
            config["archivo_salida"], 
            nombre_proveedor
        )
        
        # Limpiar búsqueda para el próximo proveedor
        self.limpiar_busqueda()
        
        return exito
    
    def procesar_todos_proveedores(self):
        """Procesar todos los proveedores automáticamente"""
        print("🚀 INICIANDO AUTOMATIZACIÓN DE WHATSAPP PARA TODOS LOS PROVEEDORES")
        print("="*70)
        
        # Estadísticas de eficiencia
        chats_procesados = 0
        chats_saltados = 0
        
        # Configurar navegador
        if not self.configurar_navegador():
            return False
        
        resultados = {}
        try:
            for nombre_proveedor, config in self.proveedores.items():
                print(f"\n🔍 Procesando: {nombre_proveedor}")
                
                # Intentar procesar proveedor
                exito = self.procesar_proveedor(nombre_proveedor, config)
                
                if exito:
                    chats_procesados += 1
                else:
                    chats_saltados += 1
                    
                resultados[nombre_proveedor] = exito
            
            # Mostrar estadísticas de eficiencia
            print(f"\n{'='*70}")
            print("📊 ESTADÍSTICAS DE EFICIENCIA")
            print(f"{'='*70}")
            print(f"✅ Chats procesados (con mensajes de hoy): {chats_procesados}")
            print(f"⏭️  Chats saltados (sin mensajes de hoy): {chats_saltados}")
            
            # Mostrar resumen final
            self.mostrar_resumen(resultados)
            
            # Si hubo algún éxito, ejecutar procesamiento automático de los scripts
            if chats_procesados > 0:
                print("\n⏳ Ejecutando procesamiento automático en 3 segundos...")
                time.sleep(3)
                self.ejecutar_procesamiento_automatico(resultados)
            else:
                print("\n⚠️ No se ejecutará el procesamiento automático porque no hubo extracción exitosa de ningún proveedor")
            return True
        except Exception as e:
            print(f"❌ Error general: {e}")
            return False
        finally:
            if self.driver:
                self.driver.quit()
                print("🔒 Navegador cerrado")

    
    def ejecutar_procesamiento_automatico(self, resultados):
        """Ejecutar scripts de procesamiento automáticamente para cada proveedor exitoso"""
        print(f"\n{'='*70}")
        print("🔄 INICIANDO PROCESAMIENTO AUTOMÁTICO")
        print(f"{'='*70}")
        
        # Mapeo de proveedores a sus scripts
        mapeo_scripts = {
            "GcGroup": {
                "nombre": "procesar_gcgroup.py",
                "descripcion": "Procesamiento específico de GCGroup - Genera productos_gcgroup.json"
            },
            "Kadabra Tecnología": {
                "nombre": "procesar_kadabra.py",
                "descripcion": "Procesamiento de Kadabra - Genera productos_kadabra.json"
            },
            "Zentek BA": {
                "nombre": "procesar_zentekba.py",
                "descripcion": "Procesamiento de Zentek BA - Genera productos_zentek.json"
            }
        }
        
        for nombre_proveedor, exito in resultados.items():
            if not exito:
                continue
                
            script = mapeo_scripts.get(nombre_proveedor)
            if not script:
                print(f"⚠️ No hay script configurado para {nombre_proveedor}")
                continue
                
            print(f"\n🚀 Ejecutando: {script['nombre']} (Proveedor: {nombre_proveedor})")
            print(f"📝 {script['descripcion']}")
            print("-" * 50)
            
            try:
                if not os.path.exists(script['nombre']):
                    print(f"❌ Archivo no encontrado: {script['nombre']}")
                    continue
                
                resultado = subprocess.run(
                    [sys.executable, script['nombre']], 
                    capture_output=True, 
                    text=True,
                    encoding='utf-8',
                    errors='replace',
                    cwd=os.getcwd()
                )
                
                # Mostrar salida
                if resultado.stdout:
                    for linea in resultado.stdout.split('\n'):
                        if linea.strip(): print(f"   {linea}")
                
                if resultado.stderr:
                    print(f"⚠️ Advertencias/Errores:")
                    for linea in resultado.stderr.split('\n'):
                        if linea.strip(): print(f"   {linea}")
                
                if resultado.returncode == 0:
                    print(f"✅ {script['nombre']} ejecutado exitosamente")
                else:
                    print(f"❌ Error ejecutando {script['nombre']} (código: {resultado.returncode})")
                    
            except Exception as e:
                print(f"❌ Error ejecutando {script['nombre']}: {e}")

        # Consolidar todos los productos en un solo archivo productos_ram.json
        print(f"\n🚀 Ejecutando consolidación final de precios...")
        try:
            if os.path.exists("consolidar_precios.py"):
                subprocess.run([sys.executable, "consolidar_precios.py"], cwd=os.getcwd())
                print("✅ Consolidación final completada")
            else:
                print("⚠️ No se encontró consolidar_precios.py")
        except Exception as e:
            print(f"❌ Error en consolidación final: {e}")

        print(f"\n{'='*70}")
        print("🎉 PROCESAMIENTO AUTOMÁTICO COMPLETADO")
        print(f"{'='*70}")
        print("📁 Revisa la carpeta 'output/' para ver todos los archivos generados:")
        print("   • Lista extraída de WhatsApp (TXT) - SOLO PRECIOS")
        print("   • Lista procesada con precios calculados (Excel)")
        print("   • Productos categorizados (JSON) - productos_ram.json actualizado")
        print("   • Archivo de difusión para WhatsApp (TXT)")
        print("\n🌐 El archivo productos_ram.json ha sido actualizado para la web")

    def mostrar_resumen(self, resultados):
        """Mostrar resumen de la ejecución"""
        print(f"\n{'='*70}")
        print("📋 RESUMEN DE EXTRACCIÓN")
        print(f"{'='*70}")
        
        exitosos = 0
        fallidos = 0
        
        for proveedor, exito in resultados.items():
            estado = "✅ EXITOSO" if exito else "❌ FALLIDO"
            print(f"   {proveedor}: {estado}")
            if exito:
                exitosos += 1
            else:
                fallidos += 1
        
        print(f"\n📊 ESTADÍSTICAS:")
        print(f"   ✅ Exitosos: {exitosos}")
        print(f"   ❌ Fallidos: {fallidos}")
        print(f"   📁 Archivos generados en carpeta 'output/'")
        
        if exitosos > 0:
            print(f"\n🎉 ¡Extracción de WhatsApp completada!")
            print(f"� Continuando con procesamiento automático...")
        else:
            print(f"\n⚠️ No se pudo extraer información de ningún proveedor")
        
        print(f"{'='*70}")

def main():
    """Función principal"""
    # Borrar productos_ram.json antes de iniciar, si existe
    try:
        ruta_json = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "public", "productos_ram.json")
        )
        if os.path.isfile(ruta_json):
            os.remove(ruta_json)
            print(f"🗑️ Eliminado antes de iniciar: {ruta_json}")
        else:
            print(f"ℹ️ No existe productos_ram.json para borrar: {ruta_json}")
    except Exception as e:
        print(f"⚠️ No se pudo borrar productos_ram.json antes de iniciar: {e}")

    automatizador = AutomatizadorWSP()
    automatizador.procesar_todos_proveedores()

if __name__ == "__main__":
    main()