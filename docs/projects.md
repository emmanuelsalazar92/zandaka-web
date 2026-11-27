# Proyectos · ZA-115

El módulo se abre desde Proyectos en el menú principal. La vista **Sin archivar** muestra activos y finalizados. La vista **Archivados** muestra los proyectos archivados. Desde el detalle se puede renombrar un proyecto activo, finalizarlo, reabrirlo, archivarlo y restaurarlo. La fecha de cierre se muestra en la zona contable de Costa Rica. Restaurar un proyecto finalizado conserva su cierre. Para cambiar su título, restaurar primero si está archivado y reabrir después.

Una revisión concurrente solicita actualizar antes de actuar de nuevo. Si se pierde la respuesta de creación, Reintentar creación usa la misma clave y el mismo título mientras el diálogo permanezca abierto. Si se cierra ese diálogo o se recarga la página, consultar la lista antes de iniciar otra creación. Los cambios de estado se comprueban actualizando antes de repetirlos cuando el resultado es incierto.

Este ticket entrega el ciclo de vida. ZA-116 incorpora vínculos con movimientos, ZA-117 agregados y gráficos, y ZA-118 PDF. La Web usa el proxy de la API y necesita la imagen que implementa el contrato. Si el entorno todavía no prepara la tabla project, muestra que la función no está habilitada. La guía de la API describe preparación, comprobación y reversión. El recorrido e2e/projects.spec.ts verifica diálogo con teclado, pérdida de respuesta en creación, título largo a 390 px, cierre, archivo, recarga y restauración con API sintética.

## Vínculos con movimientos · ZA-116

En el detalle de un proyecto activo, **Vincular movimientos** abre el buscador. Busca por descripción o por el ID exacto del movimiento, como `#123`. Los filtros de fecha, cuenta, categoría y moneda se combinan. Puedes elegir líneas individuales o seleccionar todas las líneas elegibles de un movimiento, incluidas las de otras categorías que aparecen en el resultado. La selección se conserva al cambiar de página, con un máximo de 100 líneas por envío.

Para incluir un ingreso, cambia el tipo a **Reembolso** y confirma con **Vincular como reembolso**. La lista muestra el importe y la moneda de cada línea, el movimiento original y su categoría. Quitar un vínculo lo retira del proyecto y conserva el movimiento. Los proyectos finalizados o archivados permiten consultar la lista. Si otra pestaña modifica la revisión, actualiza el proyecto antes de actuar.

Testing requiere la tabla `project_transaction_line` preparada por el instalador de la API. El recorrido sintético `e2e/projects.spec.ts` cubre búsqueda, vinculación parcial, vínculo completo, reembolso, retiro y consulta del proyecto cerrado.

## Costo del proyecto · ZA-117

El resumen muestra gastos, reembolsos y costo neto por moneda. Seleccionar CRC, USD u otra moneda registrada cambia el protagonista y la escala de la curva. Cada punto muestra el acumulado de un día contable con actividad. La tabla de evolución conserva las cifras exactas que devuelve la API.

Las barras representan gasto bruto. Cada barra funciona como un botón que filtra los vínculos por categoría y moneda. El desglose permite comprobar también reembolsos y neto y abrir la ficha del movimiento original. Desde la lista se puede volver a todos los vínculos.

La fecha de cálculo se presenta en horario de Costa Rica. Al actualizar, la pantalla indica si cambiaron las cifras de la misma revisión del proyecto. Si un movimiento aún vinculado registra una actualización posterior al cierre, aparece un aviso en el resumen. Los proyectos sin líneas elegibles conservan el estado vacío en la tabla.

`e2e/project-analysis.spec.ts` cubre dos monedas, reintento, teclado, desglose, ficha histórica, temas claro y oscuro, corrección posterior al cierre y estado vacío.

## Descargar el informe PDF · ZA-118

El botón **Descargar PDF** aparece en el detalle de proyectos activos, finalizados y archivados. El archivo registra el costo que se ve al momento de generar el informe, con totales por moneda, categorías y un anexo de las líneas vinculadas. Para reflejar correcciones posteriores del libro, descarga un informe nuevo.

Si el navegador no recibe el PDF, el botón vuelve a estar habilitado y muestra el motivo y cómo reintentar. El informe admite hasta 2.000 líneas elegibles. Los proyectos más grandes se pueden consultar en el desglose de la pantalla. `e2e/projects.spec.ts` verifica la descarga por teclado, el error por tiempo y el reintento a 390 px.

## Ancho del panel · ZA-140

El listado y la ficha ocupan el ancho disponible del área de contenido de Zandaka, con los mismos bordes exteriores que Conciliación. El límite de escritorio y los márgenes vienen de `AppLayout`. El panel de Proyectos conserva la superficie Marea y su espaciado interno.

`e2e/projects-layout.spec.ts` compara los bordes de las tres pantallas con datos sintéticos a 390, 1.280 y 1.920 px, en claro y oscuro. En escritorio cubre la barra lateral expandida y colapsada. El informe de Playwright adjunta capturas de las tres pantallas a 1.920 px con la barra expandida.

## Selector del listado · ZA-142

**Nuevo proyecto** es la acción principal. **Sin archivar** y **Archivados** son botones de vista con una línea de selección y estado anunciado mediante `aria-pressed`. Se recorren con Tab y se activan con Enter o Espacio. Cada cambio de vista abre su primera página. `e2e/projects.spec.ts` verifica el selector por teclado, la creación y la presencia de los finalizados en **Sin archivar** hasta que se archivan.

## Fechas del proyecto · ZA-143

El listado muestra una fecha por fila. **Creado el** identifica cuándo se registró un proyecto activo en Zandaka. **Cerrado el** identifica su finalización. **Archivado el** tiene prioridad cuando el proyecto está archivado. La ficha muestra la creación y las fechas aplicables de cierre y archivo.

Las fechas se muestran en español de Costa Rica, usando la zona contable `America/Costa_Rica`. Reabrir quita el cierre vigente. Restaurar quita la fecha de archivo y conserva el cierre si existía. La prueba de ciclo de vida en `e2e/projects.spec.ts` cubre estas transiciones y verifica el día de Costa Rica con el navegador configurado en UTC.

## Composición de la ficha · ZA-145

La ficha muestra el estado y las fechas junto al título. **Costo del proyecto** es la primera sección. Presenta el costo neto de la moneda seleccionada y muestra la hora de cálculo debajo del importe. **Actualizar costo** queda junto al encabezado de la sección. Los avisos y desgloses siguen disponibles después del resumen.

El regreso a Proyectos está en la [barra superior persistente](navigation.md#barra-superior-durante-el-desplazamiento--za-144). El título de la ficha es el destino de foco si el control que abrió un diálogo deja de estar disponible. La prueba de análisis adjunta capturas del primer pantallazo en claro y oscuro a 390 y 1.440 px.

## Acciones de la ficha · ZA-146

En un proyecto activo, **Vincular movimientos** abre el buscador desde el encabezado. Se habilita cuando se cargan los vínculos y la revisión permite editarlos. **Descargar PDF** acompaña como acción secundaria. En proyectos finalizados o archivados, **Descargar PDF** es la acción principal.

**Más acciones** ofrece editar, finalizar y archivar en proyectos activos, reabrir y archivar en finalizados, y restaurar en archivados. El menú y los diálogos se operan con teclado. Al cerrar un diálogo de gestión, el foco vuelve al menú o al título de la ficha si el menú ya no está disponible. El recorrido de `e2e/projects.spec.ts` comprueba las acciones por estado, la vinculación desde el encabezado y la descarga con reintento.
