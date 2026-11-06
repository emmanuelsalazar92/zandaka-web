# Presupuestos Marea — ZA-97

El módulo aprobado se implementa en `/budgets` y `/budgets/plans/:uuid`. Composición [Marea](atlantico-composition.md): neto protagonista en cobalto, filas abiertas por grupo y contexto turquesa para el día 1. Usa los tokens globales Atlántico en claro/oscuro, sin introducir una paleta propia. La implementación del 5 de noviembre de 2026 no despliega testing ni modifica ninguna base del usuario.

## Recorrido

1. **Crear presupuesto.** Elegir mes de uso y mes en que se recibió el ingreso. La entrada inicial es neto disponible; opcionalmente registrar salario bruto, CCSS/renta reales y dos quincenas. El comprobante debe cerrar en cero. No se aplican deducciones nuevamente al neto ni se calcula la renta con una cotización supuesta.
2. **Tipo de cambio.** Introducir compra/venta del banco, fuente, fecha y margen. Se explica USD → CRC y CRC → USD, mostrando las tasas ajustadas y el redondeo dirigido. No usa automáticamente una tasa API.
3. **Plan del mes.** Editar asignaciones de los grupos 50/30/20. Cada línea muestra reserva USD, importe de pago y sobre destino. El editor distingue fijo USD/CRC, porcentaje del neto y suscripción antes de impuesto; su desglose explica la conversión, el impuesto y los redondeos. Un porcentaje no se sube al dólar entero. Los grupos son referencias; no se obliga a gastarlos completos.
4. **Revisar sobres.** Elegir cuenta USD para el libre y un sobre con fondos existentes por cuenta de destino. Guardar, verificar fondos y preparar el plan. Desde el primer día del mes, confirmar fecha y asignaciones para redistribuir el dinero a sobres. Preparar no asigna; la confirmación final sí genera movimientos balanceados. La conversión y los traslados bancarios reales se registran por sus flujos correspondientes antes de asignar. El libre permanece USD.

La lista tiene paginación y muestra estado, neto y libre. **Presupuestos anteriores** abre `/budgets/legacy`; sus detalles `/budgets/:numericId`, reglas y datos se conservan. Copiar asignaciones propone las líneas del plan nuevo inmediatamente anterior y pide confirmación antes de reemplazar; no copia el ingreso ni las tasas. Se guarda después de revisar. No importa automáticamente el Excel ni convierte documentos legados.

## Guardado, conflictos y recuperación

Los IDs del plan, sus líneas y los intentos se generan con el helper criptográfico compartido basado en `crypto.getRandomValues`, disponible también en el origen HTTP de la LAN de testing. Las pruebas del módulo deshabilitan `crypto.randomUUID` para cubrir esa diferencia respecto de localhost y verifican crear, añadir líneas, guardar, asignar y recuperar el intento. La ausencia de aleatoriedad criptográfica bloquea la generación de IDs.

Los cambios del editor son locales hasta **Guardar borrador**. Un borrador incompleto puede guardarse; preparar exige resolver los datos y referencias. Después de preparar se puede volver a borrador; un plan asignado queda en consulta con recibo y enlaces a sus movimientos.

Cada pestaña conserva su borrador y el intento pendiente en `sessionStorage`, con ID estable y revisión base. No se guardan credenciales. Los importes y comprobantes introducidos sí quedan en el almacenamiento de esa pestaña: no usar una sesión compartida con personas no autorizadas. El servidor conserva el plan únicamente tras una escritura explícita. Si el almacenamiento local no está disponible, la UI informa y no envía una operación sin poder conservar el intento.

Una respuesta de escritura perdida o inválida muestra **Resultado por confirmar** y bloquea nuevas ediciones del intento. **Consultar resultado** recupera el documento/recibo original; **Reintentar mismo intento** conserva UUID, revisión, fecha y cuerpo. No emitir otra clave por una pérdida de red. Una respuesta 409 requiere actualizar y revisar; los borradores locales de otra revisión no sobreescriben el servidor silenciosamente. Los recibos se validan por plan, estado, revisión, UUID, fecha, líneas, moneda, destinos e importes antes de mostrar éxito.

La identidad mantiene el contrato actual `userId=1`; el módulo no incorpora login. El servidor es la autoridad de saldos, fechas, pertenencia y revisión. La previsualización no garantiza disponibilidad futura: al confirmar se vuelve a validar y el lote es atómico. No hay conversión bancaria, envío de dinero externo ni ejecución programada implícita.

## Precisión y accesibilidad

Los cálculos usan Decimal con 60 dígitos de precisión y cadenas de resultados. El formateo a dos decimales es el último paso de presentación. Los pagos a sobres se liquidan a centavos HALF_UP; el porcentaje conserva precisión intermedia y su explicación muestra el valor anterior. La reserva y el libre pueden tener más precisión que su etiqueta de pantalla. El [contrato API](https://github.com/emmanuelsalazar92/zandaka-api/blob/staging/docs/budget-plans.md) documenta las fórmulas y los límites.

El orden DOM sigue encabezado, neto, pestañas, contenido y resumen del día 1. Las pestañas admiten flechas, Home/End y selección con foco; los diálogos usan Radix, etiquetas asociadas, foco contenido y cancelación. El diseño refluye según ancho disponible y tamaño del texto, sin depender solo del viewport. Se verifican 360/390/1440 px, claro/oscuro y texto 100/200 %, con axe y geometría sin desbordamiento. Los controles principales conservan 44 px de altura mínima.

## Validación y entrega

- `tests/budget-plan.test.ts`: neto/comprobantes, origen USD, porcentajes, dos sentidos de cambio, IVA, redondeo y libre.
- `tests/budget-plan-api.test.ts`: contrato, errores seguros, intentos y recibos no confirmados.
- `e2e/budget-plan.spec.ts`: matriz de lectura/accesibilidad, creación, guardado, copia, preparación, confirmación, pérdida de respuesta y recuperación sin duplicación. Usa API simulada sintética; las pruebas HTTP reales y de atomicidad están en la API.

Requiere imágenes compatibles web/API y la tabla auxiliar **`budget_plan`** preparada explícitamente; `transfer_request` sigue siendo necesario para asignar. Si falta preparación se muestra un estado indisponible con reintento, sin simular éxito ni volver al fondeo anterior. **Ambas tablas quedaron preparadas/verificadas en la [entrega real del 5 de noviembre](deployments/2026-11-05-testing.md).** Para otro bloque seguir [la guía de despliegue API](https://github.com/emmanuelsalazar92/zandaka-api/blob/staging/docs/deploy-testing.md): la ampliación del worker y la aceptación Windows están completas; crear un plan nuevo con perfil `za90-za97` y verificar compatibilidad después del backup. La aceptación previa no había preparado DB ni desplegado. Publicar imágenes tampoco lo hace.
