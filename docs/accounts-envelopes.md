# Cuentas y Sobres Marea — ZA-102

Implementación del 6 de noviembre de 2026, en `staging`, con commit local. Sin push, inspección/publicación de imágenes Docker o deploy. Adopta la composición elegida en ZA-111: protagonista cobalto, filas abiertas y contexto turquesa sobre los neutros Marea. Los catálogos completos de instituciones y categorías conservan sus rutas; esta entrega integra únicamente las tareas necesarias desde Cuentas/Sobres.

## Cuentas: dónde está el dinero

La lectura usa el reporte existente de cuentas activas. Los saldos se presentan **por moneda**, sin sumar CRC y USD ni consultar una cotización para esta vista. El selector del protagonista cambia la moneda destacada; la lista tiene su propio filtro explícito. Una moneda con algún saldo desconocido queda por confirmar, conservando los demás importes conocidos.

La lista agrupa por institución, ofrece búsqueda por nombre, orden y densidad Cómoda/Compacta. La ordenación por saldo separa monedas antes de comparar importes; la alfabética ordena por nombre. Cada fila declara banco, moneda, estado, saldo registrado y sobres activos, con accesos a sobres y movimientos. El saldo registrado de la cuenta no certifica una conciliación bancaria.

Crear cuenta permite crear una institución dentro del mismo diálogo, conservando nombre, moneda y elección de sobregiro del borrador. La institución se guarda con una acción propia y queda seleccionada por su ID confirmado; **cancelar la cuenta no elimina la institución ya creada**. La moneda e institución de una cuenta existente siguen siendo de solo lectura: editar envía únicamente su nombre. Se conserva el valor previo por defecto de sobregiro, ahora con un control visible.

## Sobres: contexto completo de una cuenta

El selector incluye cuenta, institución y moneda. Un enlace `/envelopes?accountId=ID` selecciona esa cuenta; si ya no está disponible no se muestra otra en su lugar. Elegir otra cuenta cambia saldo, distribución, lista, acciones y enlaces. Las lecturas anteriores se abortan y su resultado no puede aparecer bajo el nuevo encabezado.

El protagonista suma exclusivamente **sobres activos de la cuenta seleccionada**. El contexto lateral conserva por separado el saldo registrado de la cuenta, cuyo alcance puede incluir líneas de sobres inactivos. No se presenta esa diferencia como dinero libre ni se ajustan saldos.

El reparto usa la suma de saldos positivos como denominador. Negativos y ceros no participan en sus barras/porcentajes, pero los negativos sí forman parte del saldo firmado. Si falta un saldo se retienen total y porcentajes como por confirmar; los negativos conocidos siguen siendo revisables. Los estados son Saldo positivo, Sin saldo, Saldo negativo y Por confirmar. Ninguna participación equivale a salud, suficiencia o cumplimiento de una meta.

Búsqueda sin sensibilidad a acentos, orden, filtros de estado y densidad actúan localmente: no vuelven a consultar la API ni cambian el saldo/denominador global de la cuenta. Los vacíos distinguen ausencia de sobres de ausencia de coincidencias; los errores no se convierten en cero. Cada fila abre todos los movimientos de ese sobre.

## Instituciones y categorías dentro de la tarea

Vincular categoría carga las opciones cuando se abre el diálogo. Excluye categorías ya vinculadas y grupos/intermedias, ofreciendo las categorías hijas disponibles. Permite crear un grupo y luego una categoría sin perder lo introducido. Son acciones persistentes separadas: cancelar la vinculación no elimina un grupo/categoría ya creados.

Crear una categoría **no vincula ni asigna automáticamente**: su ID confirmado queda seleccionado y el usuario debe pulsar Vincular categoría. Vincular crea o reactiva el sobre conforme al contrato existente; no registra ingreso, transferencia, conversión o fondeo.

Las escrituras tienen bloqueo inmediato contra doble envío. Solo se aceptan identificadores devueltos por el servidor: no se inventan IDs ni éxitos optimistas. Un fallo de red, confirmación inválida o error de servidor potencialmente ambiguo mantiene el borrador y bloquea otro envío desde ese intento. El usuario debe cerrar, actualizar/revisar el listado y decidir cómo continuar; no existe recuperación idempotente nueva para estos catálogos ni un reintento automático.

## Actividad, restricciones y lecturas

Los enlaces a Movimientos usan `source=account-context`, `accountId` y, para un sobre, **categoryId, no envelopeId**. Se validan IDs positivos seguros y parámetros duplicados. No aplican mes, corte o filtro adicional: muestran la historia completa de ese conjunto. Los enlaces previos del Resumen y Conciliación siguen funcionando. Desde Sobres también se puede abrir Conciliación en la misma cuenta.

Desactivar un sobre exige saldo conocido exactamente cero. Desactivar una cuenta exige confirmar que no tiene sobres activos; no se añade una regla de saldo cero de cuenta que el backend no tiene. El servidor vuelve a validar las restricciones y un conflicto conserva el recurso visible, con error seguro. La desactivación conserva movimientos históricos. No hay una activación ficticia ni eliminación de datos.

Las cuentas, instituciones y categorías conservan el contexto actual de perfil 1; se excluyen opciones que declaren otro propietario. Esto no introduce autenticación nueva en los endpoints existentes. Las respuestas se validan por forma, IDs, moneda e importes, con una lectura independiente por fuente, cancelación y límite de 15 segundos. Sobres consulta una sola cuenta por selección; no hace una petición por fila. Un fallo del catálogo no vacía la información financiera disponible.

## Validación y siguiente entrega

`tests/account-context.test.ts` cubre saldos desconocidos, monedas, denominadores, búsqueda/orden, filtros de actividad, restricciones y confirmaciones inválidas. Las pruebas de dinero y semántica de sobres anteriores permanecen intactas.

`e2e/accounts-envelopes.spec.ts` usa 35 sobres sintéticos y prueba 390/1440 px, claro/oscuro, texto 100/200 %, Arial/Verdana adicionales, geometría, axe, selección rápida, búsquedas/densidad, creación integrada, foco, errores/confirmaciones perdidas y desactivación. Las escrituras están interceptadas: ninguna prueba usa la DB del propietario. La regresión general de accesibilidad cubre también el resto de rutas. No equivale a una sesión con lector de pantalla ni a usabilidad con usuarios.

Backend sin cambios: se reutilizan reportes, catálogos y operaciones existentes. **ZA-102 no requiere preparar DB, migrar dinero ni recalcular historia o snapshots.** Para un futuro bloque conservar la pareja compatible del proyecto; el requisito API de ZA-99 sigue vigente porque esta web lo incluye. Testing continúa ejecutando el release anterior documentado hasta que el propietario solicite otra entrega.

Validación local: 182 unitarias y 104 pruebas de navegador distintas aprobadas (76 del bloque/regresión general y 28 de la referencia Marea/fixture compartida); formato, lint, tipos y build correctos. Tras el ajuste de confirmaciones se repitieron ocho recorridos focalizados; la última validación de adopción/turquesa pasó 63 casos, incluidos los 35 específicos del ticket. No sumar esas repeticiones a las 104 pruebas distintas. La primera regresión tuvo dos timeouts en diálogos de Conciliación/Reportes: pasaron aislados sin ampliar límites y la corrida completa posterior quedó limpia. Se acotaron las capturas a vistas representativas, manteniendo las aserciones de geometría y axe sobre todos los elementos. Los cambios ajenos del workspace y el repositorio API se conservaron mediante hashes.
