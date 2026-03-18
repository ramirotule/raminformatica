Quiero que actúes como un desarrollador senior full stack trabajando directamente sobre mi proyecto.

Objetivo:
Necesito automatizar el enriquecimiento de productos almacenados en Supabase.

Contexto de base de datos:
- Tengo una tabla `products`
- Tengo una tabla `product_images`
- En `product_images` existe un campo `product_id` que corresponde al campo `id` de la tabla `products`

Necesito que implementes una solución completa que haga lo siguiente:

1. Leer todos los productos de la tabla `products`
2. Para cada producto:
   - Generar o completar el campo `short_description`
   - Generar o completar el campo `long_description`
3. Buscar imágenes del producto en Mercado Libre
4. Guardar esas imágenes en la tabla `product_images`, vinculándolas correctamente con `product_id = products.id`

---

REGLAS GENERALES

- Solo completar `short_description` si está vacío o null
- Solo completar `long_description` si está vacío o null
- Solo buscar e insertar imágenes si el producto todavía no tiene imágenes asociadas en `product_images`
- No duplicar imágenes si el producto ya tiene registros cargados
- El proceso debe ser idempotente: si se ejecuta más de una vez, no debe duplicar ni romper información
- Debe manejar errores por producto sin frenar todo el proceso completo
- Debe dejar logs claros en consola indicando:
  - producto procesado
  - categoría detectada
  - short_description generada o salteada
  - long_description generada o salteada
  - imágenes encontradas
  - imágenes insertadas
  - errores si ocurren

---

REGLAS PARA short_description

IMPORTANTE:
La `short_description` NO debe ser un párrafo.
Debe ser un bloque corto, visual y escaneable, compuesto por líneas con emojis y características principales del producto, similar a una ficha resumida de specs.

Formato esperado:
- Una característica por línea
- Con emoji al inicio
- Texto corto y claro
- Orientado a e-commerce
- Fácil de copiar y pegar
- Sin introducción ni cierre comercial
- Máximo aproximado: entre 8 y 12 líneas
- Solo incluir specs realmente importantes según la categoría del producto

Ejemplo para MacBook:

💻 Pantalla 13" Liquid Retina
⚡ Procesador Apple A18 Pro
🧠 Memoria 8 GB RAM unificada
💾 Almacenamiento 256 GB / 512 GB SSD
🔋 Batería hasta 16 horas de uso
📷 Cámara FaceTime HD 1080p
🎧 Sonido con Dolby Atmos y audio espacial
📶 Conectividad Wi-Fi 6E / Bluetooth 6
🔌 Puertos USB-C (2) + Jack 3.5 mm
🔐 Seguridad Touch ID

Ejemplo para iPhone:

📱 Pantalla: 6.1" Super Retina XDR OLED
⚡ Procesador: Apple A16 Bionic
📸 Cámara principal: 48 MP
📷 Cámara Ultra Gran Angular
🎥 Video 4K Dolby Vision
📶 Conectividad 5G / Wi-Fi 6 / Bluetooth
🔐 Seguridad Face ID
🔋 Batería optimizada para todo el día
🔌 Conector USB-C
📱 Dynamic Island

La lógica debe adaptarse a la categoría del producto.

Por ejemplo:
- Si es una MacBook, priorizar pantalla, procesador, RAM, almacenamiento, batería, cámara, audio, conectividad, puertos y seguridad
- Si es un celular, priorizar pantalla, procesador, cámara, video, conectividad, seguridad, batería, tipo de carga, rasgos distintivos
- Si es una consola, priorizar tipo de consola, pantalla, almacenamiento, conectividad, autonomía, resolución, controles, modos de uso
- Si es un smartwatch, priorizar pantalla, salud, batería, resistencia al agua, conectividad, sensores, compatibilidad
- Si es un auricular, priorizar cancelación de ruido, batería, conectividad, calidad de audio, micrófono, resistencia
- Si es una tablet, priorizar pantalla, procesador, almacenamiento, batería, cámaras, compatibilidad con accesorios, conectividad

No uses siempre las mismas etiquetas.
Elegí campos relevantes según el tipo de producto.

Si faltan datos exactos:
- completar con la mejor información confiable disponible
- evitar inventar especificaciones no verificables
- si no se puede verificar una spec importante, omitirla antes que inventarla

---

REGLAS PARA long_description

La `long_description` sí debe ser una descripción larga, clara, profesional y orientada a e-commerce.

Debe:
- estar redactada en español neutro
- sonar profesional
- explicar beneficios reales
- incluir las características más relevantes del producto
- estar bien estructurada
- evitar humo excesivo o frases vacías
- servir para ficha de producto en una tienda online

Formato esperado:
- texto corrido con buena redacción
- puede incluir pequeños bloques o separaciones
- no hace falta HTML salvo que el proyecto ya lo use
- tono comercial pero técnico y creíble

Tomá como referencia el estilo de descripciones generadas con ChatGPT, pero NO te limites solo a eso.
Quiero que el sistema quede abierto a obtener información desde la fuente más fidedigna posible.

---

FUENTES DE INFORMACIÓN PARA short_description y long_description

Importante:
Yo usé ChatGPT como referencia para el estilo deseado de `short_description` y `long_description`, pero la implementación NO debe depender exclusivamente de ChatGPT.

Quiero que el sistema:
- pueda usar IA para redactar
- pero priorice información confiable y verificable cuando esté disponible

Orden de prioridad sugerido para obtener specs y datos:
1. datos ya existentes en la tabla `products`
2. nombre, marca, modelo y categoría del producto
3. fuentes oficiales del fabricante
4. fuentes confiables de ficha técnica
5. contenido generado con IA para redactar y estructurar
6. otras fuentes complementarias razonables si hicieran falta

Es válido usar ChatGPT o un proveedor de IA para transformar y redactar la información,
pero la base técnica del contenido debe buscarse en datos confiables siempre que sea posible.

No quiero texto inventado ni specs falsas.

---

REGLAS PARA LAS IMÁGENES

- Buscar imágenes relevantes y limpias del producto en Mercado Libre
- Priorizar imágenes de buena calidad y que representen correctamente el producto
- Evitar miniaturas rotas, imágenes irrelevantes o de mala calidad
- Insertar en `product_images` solamente imágenes válidas
- Si la tabla `product_images` tiene más campos además de `product_id`, inspeccionar el schema real y adaptar la inserción
- Si existe un campo de orden, guardar el orden de inserción
- Si existe un campo como `is_primary`, marcar la primera imagen como principal
- No duplicar imágenes existentes

---

REQUISITOS TÉCNICOS

- Inspeccioná primero la estructura real del proyecto y las tablas antes de escribir la lógica
- No asumas nombres de columnas extra si no existen
- Reutilizá la configuración existente del proyecto
- Si ya existe cliente de Supabase, usalo
- Si no existe, creá un módulo limpio y reutilizable
- Implementá esto como script ejecutable o comando utilitario dentro del proyecto
- El código debe ser claro, mantenible y modular
- Si existe tipado TypeScript, respetalo
- Si el proyecto ya tiene utilidades para categorías o productos, reutilizalas

---

LÓGICA DE CATEGORIZACIÓN

Antes de generar descripciones, detectá la categoría del producto usando:
- categoría ya guardada en la base, si existe
- nombre del producto
- marca
- keywords del modelo

La categoría debe influir directamente en:
- qué specs se priorizan en `short_description`
- cómo se redacta `long_description`
- cómo se busca la imagen correcta

---

FLUJO DE TRABAJO QUE QUIERO

Paso 1:
Inspeccioná el proyecto y detectá:
- stack usado
- ubicación del cliente de Supabase
- estructura real de las tablas involucradas
- si ya existen tipos, helpers o servicios para productos e imágenes

Paso 2:
Mostrame un plan breve de implementación antes de modificar archivos

Paso 3:
Implementá la solución completa, incluyendo:
- lectura de productos
- detección de categoría
- generación de short_description con formato visual por líneas y emojis
- generación de long_description
- búsqueda de imágenes en Mercado Libre
- inserción en `product_images`
- control de duplicados
- logs
- manejo de errores

Paso 4:
Dejá un script fácil de ejecutar, por ejemplo:
- `npm run enrich-products`
o equivalente según el stack real del proyecto

Paso 5:
Explicame al final:
- qué archivos creaste o modificaste
- cómo ejecutar el proceso
- qué supuestos tomaste
- qué fuentes usaste para obtener datos
- qué mejoras futuras convendría hacer

---

RESTRICCIONES IMPORTANTES

- No inventes nombres de columnas
- No sobrescribas datos existentes que ya estén completos
- No borres imágenes previas
- No dupliques registros
- Si un producto no tiene suficiente información para inferir correctamente specs o imágenes, loguealo y saltealo
- Si no encontrás una forma estable de obtener imágenes desde Mercado Libre, igual dejá implementada una arquitectura desacoplada para poder cambiar la fuente después
- Antes de correr masivamente, validá con un lote pequeño de prueba si es posible
- Priorizá claridad, robustez e idempotencia

Calidad del contenido:
- Evitá frases vacías como "producto de excelente calidad"
- Evitá repetir lo mismo en distintos productos
- Evitá marketing exagerado
- Priorizá claridad, credibilidad y utilidad real para el cliente
- Las descripciones deben parecer escritas para una tienda profesional

Quiero que escribas el código directamente en el proyecto, no solo una explicación teórica.