# Historial de Movimientos — ZA-106

Movimientos adopta Atlántico/Marea en su contenido: un protagonista cobalto con el número de registros encontrados, neutros compartidos y oscuro carbón. Ese número procede de la paginación del servidor, no es un saldo ni una suma de monedas. Mientras carga o falla la consulta se muestra «Buscando…» o «Sin confirmar», nunca un cero aparente.

## Lectura y densidad

El historial es una lista semántica agrupada por fecha contable, más reciente primero. Cada registro conserva descripción, contexto de cuenta/sobre, tipo, moneda e importe. En escritorio se presenta en filas abiertas con columnas alineadas y divisores. El modo Compacta es inicial; Cómoda aumenta el espacio y la descripción disponible sin cambiar datos ni solicitar otra consulta.

El ancho disponible del propio historial, no solo el viewport, decide la distribución mediante una consulta de contenedor de 48 rem. Móvil y texto ampliado conservan las mismas listas y controles, en tarjetas de lectura vertical. No se duplica una tabla oculta ni se impone desplazamiento horizontal para leer el registro. La selección de densidad vive en memoria de esta pantalla; no se guardan búsquedas ni descripciones financieras en almacenamiento persistente.

Se abre la [ficha completa ZA-88](transaction-detail.md) desde toda fila/tarjeta con clic, toque, Enter o Espacio. La descripción puede ocupar una o dos líneas en el resumen y los nombres largos usan elipsis; el contenido íntegro está en la ficha. Se indica el número de líneas visibles, sin afirmar que el listado contiene toda la historia: su contrato puede omitir sobres inactivos y la ficha los recupera.

Los signos históricos no se normalizan según el tipo al leer. Los importes visibles se agregan con los helpers existentes por moneda; una transferencia separa salidas y entradas, sin mostrar gasto neto cero ni elegir arbitrariamente la línea mayor. Las monedas diferentes permanecen separadas, sin conversión. Una moneda ausente no se deduce del importe ni se sustituye por CRC; se puede usar la moneda conocida de la cuenta del catálogo actual. Si no se puede verificar el importe agregado, se invita a abrir la ficha. No se editan módulos monetarios ni reglas de contabilización.

## Filtros y paginación

El panel conserva un borrador independiente. Buscar aplica los campos y vuelve a página 1. Los filtros aplicados permanecen visibles fuera del panel, con nombres en español, limpieza individual y «Quitar filtros». Quitar Cuenta elimina también Sobre para no conservar una combinación incompatible. Abrir/cerrar la ficha no altera filtros, densidad, página, tamaño o posición del historial.

Desde/Hasta e importes mínimo/máximo se validan antes de solicitar resultados; el mensaje se asocia al campo y el foco permite corregirlo. Se mantiene el contrato del backend: `categoryId` identifica el filtro por categoría/sobre y los importes filtran el total neto con signo, sin conversión. Los gastos son negativos y una transferencia suele tener neto cero; la UI no cambia ese significado ni recalcula los filtros por importe mostrado.

Los tamaños disponibles son 10, 25, 50 y 100. Cambiar tamaño vuelve a página 1; cambiar página conserva los filtros. Un estado vivo `polite` y atómico anuncia carga y el rango real recibido, total, página y tamaño. Los controles tienen nombres accesibles y áreas de interacción del sistema. Una página que deja de existir al cambiar el conjunto se recupera en la última disponible.

La paginación conserva el foco después de cargar, incluso si el control nativo se deshabilitó temporalmente. Si el botón deja de estar disponible al llegar a un extremo, el foco vuelve a un control habilitado de la paginación. No se roba el foco de otra tarea que el usuario haya iniciado mientras esperaba.

## Consultas y estados

La web reutiliza `GET /api/transactions` con el mismo contrato y orden por fecha descendente. Carga únicamente la página solicitada, sin descargar todo el libro ni precargar fichas. La nueva lectura usa AbortController, timeout de 15 segundos, `no-store` y guardas de instancia: una respuesta antigua no reemplaza filtros o páginas recientes. Cambiar de consulta retira las filas anteriores mientras carga para no presentarlas bajo otro filtro.

Se validan estructura, importes finitos, identificadores únicos y coherencia de página/tamaño/conteo antes de anunciar resultados. Un JSON incompleto o una página equivocada son errores recuperables, no un historial vacío. La API actual recibe `userId` del contrato existente; este parámetro no autentica al cliente ni añade roles.

Hay un estado vacío único: un resultado filtrado permite quitar filtros; un historial inicial vacío ofrece registrar el primer movimiento. Un error conserva filtros y ofrece volver a intentar. Los catálogos de cuentas/sobres fallidos tienen reintento explícito, sin bucles automáticos. Los resultados del editor legado de Ajuste se refrescan desde el servidor, sin insertar una fila optimista que contradiga los filtros o el tamaño de página. Los flujos de ingresos/gastos y transferencias de ZA-91/90 mantienen sus contratos.

## Verificación y despliegue

`tests/transaction-history.test.ts` cubre query/contrato, rangos, anuncios, signos, suma exacta y monedas separadas. `e2e/transaction-history.spec.ts` usa 60 registros sintéticos, un lote de 50, ambos modos, 360/390/1440 px, claro/oscuro, texto 100/200 % y Arial/Verdana adicionales en móvil. Comprueba axe AA, geometría, detalle y foco, filtros/paginación/scroll, fallos, reintentos y respuestas atrasadas. La suite completa conserva las regresiones anteriores.

Ejecutar formato, lint, tipos, unitarias, build y `npm run test:e2e`. Estas comprobaciones no equivalen a una sesión física con lector de pantalla ni a zoom nativo. Evidencia del workspace en `auditoria-uiux-2026-11-04/ZA-106`.

**ZA-106 cambia solo web. No añade endpoints ni cambios de DB.** La ficha sigue necesitando la API de ZA-88 ya documentada. Promover imágenes compatibles por bloque siguiendo [staging](staging.md). Si el bloque incluye ZA-90, continúa la preparación explícita independiente de `transfer_request`; este ticket no la ejecuta. No se abrió una base del usuario ni se desplegó testing.
