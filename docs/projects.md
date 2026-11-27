# Proyectos · ZA-115

El módulo se abre desde Proyectos en el menú principal. La lista muestra activos y finalizados por defecto y ofrece una vista Archivados. Desde el detalle se puede renombrar un proyecto activo, finalizarlo, reabrirlo, archivarlo y restaurarlo. La fecha de cierre se muestra en la zona contable de Costa Rica. Restaurar un proyecto finalizado conserva su cierre. Para cambiar su título, restaurar primero si está archivado y reabrir después.

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
