# Resumen Marea — ZA-99

Entrega local del 6 de noviembre de 2026, sobre `staging`. Completa la primera versión Atlántico siguiendo la composición elegida en ZA-111: saldo protagonista cobalto, actividad con filas abiertas, distribución sobria y contexto turquesa. No se ha hecho push, publicación de imágenes ni deploy en este ticket.

## Recorrido y significado

- Nuevo movimiento e Importar inician los flujos existentes desde el encabezado. No guardan una operación al pulsarlos.
- El protagonista conserva el consolidado de los **saldos registrados de sobres activos**, con originales CRC/USD y cotización fechada. No representa el saldo bancario conciliado ni un cierre histórico del mes seleccionado. La cotización es la referencia del proveedor existente, no la compra/venta manual del presupuesto ni la cotización del banco del propietario.
- Período de gastos y actividad controla ambas fuentes. La actividad aparece antes de la distribución y la atención en el orden DOM/móvil; muestra hasta cinco movimientos del mes y abre la ficha completa de ZA-88, con Escape y retorno de foco. Las líneas de transferencia conservan entrada/salida; nunca se presentan como un gasto neto cero.
- En qué gastaste usa únicamente `EXPENSE`, agrupa por moneda y calcula porcentajes contra **todo el gasto de esa moneda**. Muestra hasta cinco categorías por moneda, indicando si existen más; no compara importes CRC contra USD ni inventa tendencias. Ver gastos del período abre el historial con tipo y límites inclusivos del mes.
- Atención conserva su alcance registrado, independiente del mes: lista los sobres negativos y diferencias abiertas que devolvieron sus respectivas fuentes. Cada sobre abre el historial completo de su cuenta/categoría; cada diferencia selecciona la cuenta correspondiente en Conciliación. Una cuenta del enlace que ya no está disponible produce un estado explícito, sin mostrar otra cuenta como si fuera la solicitada.

Los enlaces de Resumen incluyen `source=dashboard`; sus meses e IDs se validan antes de aplicar filtros. No se toma userId desde esos enlaces. Los filtros manuales del historial y los enlaces previos de Conciliación siguen funcionando.

## Lecturas, rendimiento y fallos

`fetchDashboardSummary` consulta seis fuentes independientes: totales CRC/USD, negativos, diferencias, moneda del perfil y cotización. Solo el refresco explícito del panorama/atención vuelve a consultarlas. `fetchDashboardPeriod` hace dos GET por mes: distribución de gastos y página 1 del historial, acotada a diez registros para mostrar cinco. Cambiar de mes no recarga el panorama.

Las consultas tienen límite de 15 segundos. Cambiar de período o desmontar aborta sus lecturas; el estado se vincula a mes/intento, oculta resultados anteriores mientras carga e ignora respuestas obsoletas. Un fallo en gastos no oculta actividad válida ni viceversa. Cada área tiene reintento explícito. Un vacío confirmado ofrece otro período o iniciar un movimiento.

Las respuestas se validan: forma, monedas, importes, paginación y pertenencia al mes. Los datos incompletos o inválidos no se convierten en un cero, una distribución o ausencia de incidencias. Un saldo original conocido puede mostrarse aunque falle la otra moneda. El consolidado queda por confirmar si falta una moneda, preferencia o cotización necesaria. Conserva las reglas de compra/venta y aritmética exacta existentes.

## Compatibilidad y validación

Requiere una pareja web/API de ZA-99: `GET /api/reports/monthly-expenses?month=YYYY-MM&type=EXPENSE`. La extensión API mantiene el comportamiento anterior cuando se omite type. No hay cambios de esquema, preparación de tablas, migración monetaria, recálculo ni escrituras en bases del usuario. No desplegar solamente esta web con una API que ignore el filtro nuevo. El estado real del deploy anterior sigue registrado en `docs/deployments`.

Pruebas: `tests/dashboard-period.test.ts` cubre calendario, divisas, transferencias, fuentes parciales y enlaces; `tests/dashboard-summary.test.ts` conserva consolidación. `e2e/dashboard.spec.ts` prueba 390/1440 px, claro/oscuro, texto 100/200 %, Arial/Verdana adicionales en móvil, geometría/axe, períodos rápidos, recuperación, navegación exacta, acciones y foco de la ficha. Se corrigió el ancho intrínseco del campo de mes a texto ampliado, manteniendo el límite original de desbordamiento. La suite previa de Conciliación y la cotización fechada siguen formando parte de la regresión. Todo usa fixtures sintéticos o SQLite temporal; no accede a testing/producción. No equivale a una sesión con lector de pantalla ni a una prueba de usabilidad con usuarios.

Validación local de la entrega: 173 unitarias web, 24 pruebas finales de Resumen/cotización y 63 de Conciliación aprobadas; formato, lint, tipos y build correctos. La API pasó 124 pruebas y sus checks. No se consultó CI remoto ni se inspeccionaron imágenes para completar este ticket; la publicación y el deploy siguen fuera del alcance solicitado.
