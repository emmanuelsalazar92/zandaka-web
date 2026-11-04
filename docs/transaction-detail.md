# Ficha completa de movimientos — ZA-88

Cada fila o tarjeta de Movimientos abre una ficha mediante toque, clic, Enter o Espacio. El botón cubre la tarjeta y tiene el nombre accesible «Ver detalle del movimiento N». La ficha consulta `GET /api/transactions/:id?userId=...` al abrir; no reutiliza el desglose abreviado del listado como si fuera completo. No hay precarga por tarjeta ni descarga de todo el historial.

## Lectura y significado financiero

El resumen Marea utiliza el protagonista cobalto y los neutros compartidos, incluido el oscuro carbón. El resto se organiza en secciones y filas con divisores, sin envolver cada dato en una tarjeta. Descripción, cuentas, instituciones y sobres se leen completos; se conservan saltos de línea y se parten referencias sin espacios.

Se muestran identificador, tipo, fecha contable, fecha de registro disponible, descripción y todas las líneas. La API incluye sobres inactivos y enlaces históricos sin resolver; no hereda el filtro de sobres activos del listado. Los nombres son los actuales del catálogo, no una reconstrucción de sus nombres históricos. El importe y el signo vienen del registro y no se normalizan según el tipo al leer.

La fecha contable no se convierte desde UTC. El timestamp SQLite de registro se interpreta como UTC y se presenta en `America/Costa_Rica` mediante el helper existente. Su ausencia se indica como «No disponible»; no se inventa a partir de la fecha del movimiento.

Una transferencia presenta salidas y entradas por separado, además de sus líneas ordenadas; no se calcula un gasto neto cero ni se escoge la línea mayor como importe de todo el traslado. Los totales se agrupan por moneda con `sumMoney`, sin tasas ni conversión. Si falta la moneda o el total no puede representarse con seguridad, se invita a consultar cada línea. Un importe sin moneda conserva su cifra con «Moneda no disponible»; no se supone CRC. Las líneas repetidas conservan identidad por ID. Los datos faltantes y los registros sin líneas no se convierten en ceros ficticios.

## Accesibilidad y conservación del historial

El diálogo tiene título y descripción accesibles. El foco inicial va al título; Radix mantiene el foco dentro y Escape cierra. La X y «Volver al historial» ofrecen cierre explícito. Al cerrar se devuelve el foco al botón de la tarjeta con `preventScroll`.

Abrir, reintentar o cerrar no altera filtros, página, tamaño de página, lista ni su posición; tampoco solicita un refresco del historial. El diálogo tiene desplazamiento propio y pie de cierre accesible. Mantiene las áreas de interacción del sistema y admite texto al 200 % sin desbordamiento horizontal. La posición de lectura interna comienza de nuevo al abrir otra ficha.

## Carga, errores y correcciones

Cada apertura realiza una petición de solo lectura y `no-store`. Cerrar cancela la petición; se ignoran resultados de instancias desmontadas. Hay timeout de 15 segundos, carga visible y reintento explícito, sin bucles. 403 y 404 se explican sin ofrecer acciones de corrección ni repetir automáticamente la petición. Los errores de conexión/servidor o una respuesta incoherente permiten volver a cargar.

Zod verifica ID/usuario de la solicitud, IDs de línea únicos e importes numéricos finitos. Una respuesta incompleta o de otro movimiento se trata como error; no aparece una ficha parcial presentada como éxito. No se muestran mensajes internos del servidor. React presenta descripciones y nombres como texto, sin HTML.

La ficha es de solo lectura. La API no tiene un flujo auditado de edición, borrado o reversión histórica; se explica y no se muestran botones inoperantes. Esto describe la capacidad del producto, no un supuesto rol del usuario. No se incorpora una política nueva de permisos. `userId` sigue el contrato actual y **no constituye autenticación**; el endpoint restringe la consulta al propietario solicitado y protege nombres relacionados, sin sustituir una futura capa de identidad.

## Pruebas y entrega

`tests/transaction-detail.test.ts` cubre validación, signos, multiplicidad, suma decimal, monedas separadas y metadatos faltantes. `e2e/transaction-detail.spec.ts` usa datos sintéticos en el servidor local aislado: descripción/nombres largos, dos extremos de transferencia, 360/390/1440 px, ambos temas y texto 100/200 %, axe AA, geometría, teclado, retorno de foco, filtros/página/scroll y errores o respuestas atrasadas. La API verifica con DB sintética que GET no cambia filas, esquema ni valores históricos.

Ejecutar los checks de [staging](staging.md) de ambos repositorios. Las pruebas automáticas no equivalen a una sesión física con lector de pantalla ni a zoom nativo. Evidencia del workspace en `auditoria-uiux-2026-11-04/ZA-88`.

**Despliegue por bloque:** promover una pareja compatible web/API que incluya ZA-88. Con una API anterior, la ficha presenta «no disponible»; el historial sigue funcionando. No hay cambios de esquema, saneamientos ni recálculos. Si el bloque incluye ZA-90, sigue vigente la preparación explícita de `transfer_request`, según la guía de despliegue de la API. Esta implementación no despliega testing ni abre bases del usuario.
