# Registro de ingresos y gastos — ZA-91

## Comportamiento

Movimientos → Nuevo movimiento abre por defecto un gasto simple. Ingreso y Gasto usan `MovementComposer`; Transferencia conserva el compositor de ZA-90 y Ajuste conserva su editor existente. Cambiar de tipo conserva fecha y descripción; cambiar entre ingreso/gasto mantiene los detalles y aplica las reglas de signo existentes.

La primera vista tiene fecha contable, tipo, descripción y un detalle de cuenta/sobre/importe. La cuenta se busca por nombre, institución o moneda; la opción seleccionada mantiene los tres visibles. La institución procede de `institution` (o `institution_name` en datos compatibles), ya incluida en `/api/accounts`; no se deduce del nombre ni requiere otra consulta. Si no está disponible, se indica «Institución sin identificar».

La moneda aparece en la etiqueta y junto al importe, incluso si la cuenta se llama solamente «Viajes». Antes de elegir cuenta el importe permanece deshabilitado. Los sobres se consultan exclusivamente para la cuenta seleccionada y son buscables con los componentes compartidos. Enter/Espacio abren; escribir filtra; flechas y Enter seleccionan; Escape cierra y devuelve el foco.

## Cambios de contexto y opciones

- Cambiar cuenta elimina el sobre anterior y explica que debe seleccionarse uno de la cuenta nueva. Reabrir la misma opción no invalida el detalle.
- Si cambia la moneda, también se borra el importe previo y se explica el motivo. No se convierte ni se interpreta la cifra anterior como otra moneda.
- Las peticiones se comparten entre detalles de una misma cuenta mientras el compositor está abierto. El caché se limita a esa instancia; cerrar aborta las cargas pendientes. Una respuesta atrasada de otra cuenta no cambia la selección vigente.
- Una carga fallida conserva el borrador y ofrece un reintento explícito. No se vuelve a solicitar en bucle por cada render o tecla. Una respuesta de catálogo malformada es un error, no una lista vacía confirmada.
- Un catálogo vacío muestra «Esta cuenta no tiene sobres»; un error o una cuenta no disponible impiden guardar un detalle incompleto. El backend conserva sus validaciones de actividad y pertenencia en el momento de escribir.

## Recientes sin asignación silenciosa

«Usados recientemente» ofrece hasta tres combinaciones únicas del mismo tipo a partir de los movimientos **ya cargados en la página actual del historial** y las cuentas activas disponibles. Se ordenan por fecha/ID; no se promete que sean los últimos de todo el historial, pues dependen de filtros y paginación. No se hace una descarga adicional del historial.

Nada se aplica al abrir. Un clic explícito propone cuenta y sobre para el primer detalle; el sobre se verifica contra el catálogo actual antes de seleccionarlo. Si ya no existe, el aviso pide elegir otro. No se copian fecha, descripción o importe del movimiento anterior. La propuesta y el borrador solo viven en memoria; no se guardan en localStorage/sessionStorage ni se envían a analítica.

## Desglose progresivo y precisión

«Desglosar en varias líneas» agrega un segundo detalle y enfoca su cuenta. Después permite añadir y quitar detalles; al quitar, el foco vuelve a una cuenta conservada. Cada fila tiene una clave estable independiente de su índice. Si queda una sola, puede volver al registro simple sin perderla.

Los importes usan `normalizeAmountInput` y `transactionAmount` existentes: ingreso positivo y gasto negativo; el cambio de signo se explica y se refleja al salir del campo. La entrada inválida permanece visible; no se eliminan letras, notación científica, comas o decimales extra para convertirla silenciosamente en una cifra válida. Se usa punto decimal, sin separadores de miles, con la precisión de la moneda.

El resumen muestra contexto de cuenta/institución/sobre y totales calculados con `sumMoney`. Varias monedas se muestran **por separado**, sin conversión ni total consolidado. Dos detalles de 0.1 y 0.2 producen 0.3 en su moneda. Se admiten extremos repetidos en distintos detalles conforme al contrato actual; la confirmación se compara como multiconjunto para no aceptar una línea duplicada en lugar de otra.

## Guardado y confirmaciones inciertas

El contrato sigue siendo `POST /api/transactions` con `{ userId, date, description, type, lines: [{ accountId, envelopeId, amount }] }`. La moneda es contexto de las cuentas, no un valor libre añadido al POST. No se modifica el contrato de identidad, permisos o precisión del backend.

Un bloqueo síncrono y los controles deshabilitados impiden activaciones repetidas durante el envío. Mientras guarda, se impide cerrar por Escape, clic exterior, X o Cancelar. La petición tiene un límite de 30 segundos; agotarlo no implica que el servidor haya revertido una escritura.

Se acepta como confirmación una respuesta coherente con usuario, tipo, fecha, descripción y todos los detalles/importes enviados. Después se refresca el historial desde el servidor y se muestra un aviso de registro confirmado, aclarando que la lista conserva sus filtros actuales. No se inserta una fila optimista que contradiga esos filtros.

Solo los códigos conocidos de rechazo previo a escritura permiten seguir editando; el texto se conserva y «Actualizar opciones» vuelve a consultar cuentas y sobres. Un fallo de red, timeout, error desconocido o 2xx incongruente bloquea el reenvío y muestra «Resultado por confirmar». «Revisar movimientos» filtra el historial por fecha, tipo y descripción del intento y mantiene una explicación visible para comparar detalles; **no afirma que el movimiento ya exista**.

Este endpoint **no ofrece idempotencia durable** como `/api/transfers`. No se promete deduplicación tras cerrar, recargar o navegar fuera, ni recuperación entre sesiones. No se genera una clave aparente que el backend ignore. Revisar el historial antes de iniciar otra operación cuando se perdió la confirmación.

## Marea y alcance visual

La composición adopta el contexto y resumen protagonista de [Marea](atlantico-composition.md), con un recorrido simple, detalles progresivos y acción de confirmación al pie. `--marea-*` centraliza los neutros aprobados en `app/globals.css`; `.marea-surface` los aplica únicamente al diálogo de ingresos/gastos. La referencia original usa alias a esos mismos valores, sin cambio visual. No se replica una paleta diferente por módulo ni se cambian globalmente las pantallas anteriores. Los popovers y overlays siguen los componentes compartidos.

La moneda y el signo siguen explícitos, independientemente del acento de marca. El formulario refluye a una columna en móvil y permite desplazamiento vertical, con pie de acciones persistente. El importe editable de una sola línea puede desplazarse horizontalmente dentro de su campo; el diálogo y sus controles no deben desbordar el documento.

## Verificación y despliegue

Unitarias comprueban normalización, importes inválidos, suma decimal exacta, monedas independientes, pertenencia, fechas, recientes y confirmaciones con multiplicidad. Las regresiones del formulario mantienen 1000/10000 al escribir y validan ajuste negativo y transferencia por su contrato propio.

Playwright usa datos y red sintéticos, controles reales y teclado. Cubre ingreso/gasto a 360/390/1440 px, claro/oscuro, texto 100/200 %, Arial/Verdana adicionales, axe AA, geometría, cuenta USD sin USD en el nombre, registro simple/multilínea, recientes válidos/obsoletos, cambios de moneda, respuestas atrasadas, fallo/reintento de opciones, confirmación incierta y cierre bloqueado durante un envío. La API real y las bases del usuario no participan. Las pruebas de navegador no sustituyen una sesión manual con lector de pantalla o dispositivos físicos.

Ejecutar formato, lint, tipos, unitarias, build y la suite de navegador. Evidencia del workspace en `auditoria-uiux-2026-11-04/ZA-91`.

Entrega solo web sobre `staging`. **ZA-91 no requiere cambios de DB, migraciones ni una nueva API.** Testing se actualiza por el bloque acordado con imágenes de GitHub; si ese bloque incluye ZA-90, sigue vigente su preparación explícita de `transfer_request`, documentada en la guía de despliegue. Este ticket no ejecuta esa preparación ni despliega testing.
