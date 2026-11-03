# ZA-78: acciones de Movimientos sin recorte

## Resultado y causa

El encabezado se adapta al ancho disponible sin ocultar desbordamiento horizontal. Filtros, Importar y Nuevo movimiento conservan sus etiquetas y funcionan a 360, 390, 768 y 1440 px, con temas claro/oscuro y tamaño de texto normal o ampliado al 200%.

La primera corrección móvil permitía saltos entre botones, pero el botón principal heredaba whitespace-nowrap y altura fija. A 360 px con texto al 200%, su contenido era más ancho que el contenedor; Movimientos tampoco podía partirse. ZA-78 limita las acciones al ancho útil, admite varias líneas dentro del botón, permite crecer su altura y deja envolver el título. Los controles del encabezado tienen una altura mínima de 2.75rem (44 px con el tamaño base). El resto de los botones del producto conserva su contrato actual.

La agrupación de acciones tiene nombre accesible. Se reutilizan Link, Button y Dialog; el cambio no altera montos, fechas, payloads, permisos ni rutas del backend. El compositor sigue siendo el existente.

El contenedor principal permite encogerse mediante min-width: 0. En escritorio, el ancho del sidebar se limita al menor de 16rem y 50vw; esto conserva el ancho normal y evita que el texto ampliado ocupe casi toda una pantalla de 768 px. No se oculta el desbordamiento ni se cambia la preferencia de apertura del usuario.

## Regresión reproducible en navegador

Desde la raíz web:

```sh
npm ci
npx playwright install --with-deps --only-shell chromium
npm run build
npm run test:e2e
```

Playwright está fijado como dependencia de desarrollo en package.json/package-lock.json. La configuración inicia y detiene su propio servidor de producción en 127.0.0.1:3212. Rechaza reutilizar un proceso que ocupe el puerto; nunca apunta a testing ni producción. Requiere Node 20 o posterior y el navegador correspondiente a la versión fijada.

La suite intercepta todas las peticiones API con fixtures sintéticos, rechaza cualquier escritura, bloquea destinos externos y evita llamadas de analítica. No inicia la API ni abre SQLite. Las rutas desconocidas fallan para que un nuevo contrato no pase inadvertido.

La matriz contiene 16 combinaciones: cuatro anchos × dos tamaños de texto × dos temas. Cada caso:

1. Carga el shell y la página reales, con historial y paginación visibles.
2. Mide encabezado, título, descripción y acciones contra el ancho útil; comprueba contenido interno y recortes por ancestros. Una tolerancia de 1 px contempla redondeos subpíxel.
3. Verifica ausencia de desbordamiento horizontal del documento con tamaño normal.
4. Guarda geometría y captura del encabezado.
5. Abre/cierra Filtros, abre/cierra el compositor y navega a Importar, sin guardar movimientos.

Un caso adicional reproduce deliberadamente el encabezado móvil original sin saltos y comprueba que la medición detecta Nuevo movimiento fuera del área útil. Ese control negativo verifica la capacidad de la prueba de detectar el defecto, incluso si alguien intentara disimularlo con overflow hidden.

El texto ampliado se comprueba cambiando el tamaño raíz a 200% y verificando su tamaño efectivo antes de medir. Esta es una prueba de ampliación tipográfica; no se presenta como zoom nativo de la interfaz del navegador ni como una auditoría de accesibilidad de todas las pantallas. La revisión del contenido completo al 200%, los diálogos y la página de importación pertenecen a los tickets de accesibilidad y flujos correspondientes.

## CI y evidencias

El job quality instala Chromium y ejecuta la suite después del build. La imagen de staging depende de quality, de modo que esta regresión debe aprobarse antes de publicar. El artefacto browser-layout-report conserva reporte HTML, capturas y trazas de fallo durante siete días. Estos archivos están excluidos de Git, Prettier y el contexto Docker; no forman parte de la imagen publicada.

Consulta local: npx playwright show-report. Para regenerar resultados después de cambiar el producto, volver a compilar primero: el servidor de pruebas usa el build de producción.

## Entrega

Trabajo en staging, con revisión de alcance antes del commit. ZA-78 es un cambio web; no necesita un commit artificial del backend ni una migración. Las dos imágenes continúan promoviéndose a testing por bloques con el procedimiento de docs/staging.md. Publicar esta rama no constituye un despliegue a testing.

Referencias: [Playwright webServer](https://playwright.dev/docs/test-webserver), [aserciones y esperas](https://playwright.dev/docs/test-assertions).
