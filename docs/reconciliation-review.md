# Conciliación guiada — ZA-94

La pantalla adopta Atlántico/Marea: un resumen cobalto de la cuenta seleccionada, superficies neutrales y oscuro carbón. Fecha de corte, estado, diferencia registrada y acceso al detalle permanecen juntos en cada revisión. La lista y el conteo se presentan en filas o tarjetas según el ancho disponible del contenedor; no requieren desplazamiento horizontal en móvil.

## Qué significan los estados y los importes

- **Abierta:** el backend mantiene la revisión activa. La diferencia que se muestra pertenece al registro original; no se presenta como una medición nueva del saldo actual.
- **Conciliada:** el registro está cerrado. Puede haberse creado sin diferencia o cerrado automáticamente después de que los movimientos al corte cuadraran con el saldo real. El backend conserva el importe original: una diferencia histórica no nula no se presenta como un problema abierto.
- **Ignorada:** la revisión se cerró sin resolver la diferencia. No se generaron movimientos ni se alteraron saldos por ignorarla.
- **Cerrada/Revisar estado:** se explican combinaciones históricas que no permiten afirmar que una diferencia está abierta o resuelta. No se habilitan acciones de corrección por inferencia.

El detalle distingue fecha contable de corte, fecha de registro y fecha de cierre. El corte no se convierte desde UTC; los timestamps se presentan con el helper común de Costa Rica. Una fecha de cierre ausente se indica como no disponible. Los saldos calculado/real y la diferencia son los guardados al registrar, no los saldos actuales del banco o del libro. El desglose de efectivo usa valores, cantidades y subtotales almacenados, incluso si la denominación ya no existe en el catálogo actual.

No se introduce un botón de cierre contable directo. El backend cierra automáticamente cuando corresponde. La única acción de cierre explícito de esta pantalla es Ignorar, con una confirmación que explica que no resuelve la diferencia ni mueve dinero. Solo se ofrece para una revisión abierta y activa. No hay edición ni borrado de importes históricos.

## Registrar una revisión

1. Elegir la cuenta desde el selector buscable. Nombre, institución y moneda quedan visibles. Se consulta tanto su historial como la conciliación activa, mediante el contrato existente. Si hay una abierta se ofrece revisarla y se bloquea otra creación; el servidor vuelve a imponer la restricción al guardar.
2. Abrir Nueva conciliación y elegir la fecha de corte, inicialmente el día de Costa Rica. La cuenta permanece fija durante este borrador. Para cambiarla se cierra el formulario y se elige otra, evitando transportar importes entre cuentas o monedas.
3. Introducir el saldo real manual o contar billetes y monedas en cuentas de efectivo. La comparación solicita el saldo del libro hasta el corte. Una respuesta fallida, incoherente o de otro contexto se muestra como no disponible, sin sustituirla por cero.
4. Revisar saldo calculado, saldo real y diferencia antes de crear. La previsión explica si, de confirmarse esos importes, quedaría conciliada/cerrada o abierta. Solo la respuesta coherente del servidor confirma el resultado final; no se crea un ajuste automático.

El saldo manual admite importes con signo y valida precisión y rango con los helpers monetarios existentes. No elimina letras, exponentes ni separadores de miles para fabricar otro número. El separador decimal puede ser punto o coma; no se interpretan separadores de miles.

Las cantidades de efectivo son enteros seguros de cero o más. Una entrada como -2 o 1.5 se conserva y explica, en lugar de transformarse en 2 o 15. Cada campo tiene etiqueta, error asociado y subtotal. Los subtotales y la suma reutilizan la aritmética existente; los desbordamientos bloquean la comparación. Sin cantidades introducidas el total queda por confirmar. Como en el flujo anterior, el payload de denominaciones incluye cantidades positivas; para un efectivo contado de cero puede usarse el saldo manual de 0.

## Lecturas y confirmaciones

Las consultas están acotadas por cuenta, fecha o ID, con cancelación y protección frente a respuestas atrasadas, timeout y no-store. Los catálogos y previsualizaciones fallidos tienen reintento explícito que conserva el borrador, sin bucles automáticos. Los DTO se verifican antes de mostrarse: identidad, importes presentes y seguros, tipos/estados conocidos, líneas únicas y contexto de cuenta/fecha. No se supone CRC ante una moneda desconocida ni se convierte un JSON incompleto en saldo cero.

Al crear o ignorar, un bloqueo síncrono evita doble activación. Durante la petición se bloquean el cierre, Escape, exterior, campos y cancelación, y se anuncia la carga. Las respuestas confirmadas refrescan historial y estado desde servidor; no insertan una conciliación optimista.

Un rechazo conocido previo a escritura conserva el borrador editable. Ante pérdida de red, timeout o confirmación incoherente, el formulario queda en Resultado por confirmar y no permite reenviar ese borrador; ofrece revisar el historial. El cierre del diálogo también conserva un aviso de revisión. Ignorar ofrece actualizar el estado si no pudo confirmar su resultado.

**No se añade idempotencia durable a conciliación.** Recargar o abandonar la página no conserva una clave de reintento como ZA-90; se debe revisar el historial antes de volver a registrar una operación incierta. El bloqueo de la UI no es una garantía de deduplicación entre pestañas.

## Investigar diferencias

Revisar movimientos del corte abre Movimientos con la cuenta y un Hasta inclusivo validados. No se inventa una fecha inicial ni la causa de la diferencia. La pantalla de destino aplica esos filtros, los muestra y permite ampliar el período. El enlace no crea movimientos, conciliaciones o ajustes. Solo se admite esta inicialización explícita desde source=reconciliation y con ID/fecha válidos.

El historial muestra hasta 50 revisiones recientes, como el contrato anterior; no se presenta como un total de toda la cuenta. La consulta independiente de la conciliación activa impide suponer que no existe una abierta solo porque no aparece entre esas 50. Un 404 sin el código esperado no se interpreta como ausencia confirmada. El endpoint de cuentas existente entrega las activas; no se amplía su alcance ni se implementa aquí una consulta nueva de cuentas archivadas.

## Accesibilidad y alcance técnico

Los diálogos tienen título/descripción y foco inicial en el título; Radix confina el teclado. Cerrar devuelve el foco al control de origen o al encabezado del historial si ese control dejó de estar disponible al actualizar el resultado. La comparación usa listas de términos/valores; estado, signo y contexto no dependen solo del color. Las notas y nombres largos se parten sin perder la descripción íntegra del detalle. El conteo conserva etiquetas y subtotales en móvil.

La implementación está separada en página, creación, detalle, comparación y lectura cancelable. No se añaden dependencias, fuentes ni assets externos. Los límites de acceso siguen siendo los del backend existente; la UI no constituye autenticación ni inventa roles.

## Verificación y despliegue

Las pruebas de navegador usan red aislada y registros sintéticos: lista, efectivo y detalle a 360/390/1440 px, ambos temas y texto 100/200 %, Arial/Verdana adicionales en móvil, axe AA y geometría. Los flujos cubren decimales, snapshots históricos, cierre confirmado por ignorar, creación ya conciliada, investigación, errores, respuesta perdida/incoherente, rechazo definitivo, bloqueo durante guardado y lecturas atrasadas. Las unitarias cubren precisión, cantidades inválidas, estados y contratos. La suite del backend con DB temporales verifica las restricciones y cierre automático por movimientos.

Ejecutar formato, lint, tipos, unitarias, build y test:e2e. Estas comprobaciones no equivalen a una sesión física con lector de pantalla ni a zoom nativo. Evidencia local en auditoria-uiux-2026-11-04/ZA-94.

**Cambios solo en web. Sin endpoints nuevos, cambios de esquema, migraciones, saneamientos o recálculos.** Se reutilizan GET/POST de conciliación y la lectura del estado activo ya existentes. Los módulos monetarios y el backend no cambian. Testing no se despliega por este ticket; seguir [staging](staging.md) para la promoción por bloques. La preparación auxiliar de transfer_request de ZA-90 sigue siendo un requisito independiente cuando ese ticket está incluido.
