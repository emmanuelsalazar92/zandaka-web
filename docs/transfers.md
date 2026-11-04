# Transferencias desde origen, destino e importe — ZA-90

En Movimientos → Nuevo movimiento → Transferencia se abre un compositor específico. El usuario elige cuenta y sobre de origen, cuenta y sobre de destino, fecha, descripción e importe positivo. No introduce líneas opuestas ni suma cero. Ingresos, gastos y ajustes conservan su editor existente.

## Interacción y significado

- Los selectores de cuenta muestran moneda y permiten buscar; los sobres dependen de su cuenta. Una misma cuenta puede usarse en ambos extremos con sobres diferentes.
- Se valida pertenencia de las selecciones, extremos distintos, fecha contable, descripción e importe representable con la precisión de la moneda. El texto inválido permanece visible y el error se asocia a su control.
- Se muestran cuentas de distintas monedas para que el usuario pueda reconocerlas; elegir una combinación incompatible explica el bloqueo antes de guardar. No se inventa una tasa ni se aproxima una conversión.
- Cambiar la moneda de origen borra el importe previo, evitando interpretar accidentalmente la misma cifra como otra moneda.
- El resumen «Así se moverá tu dinero» muestra cuánto sale y entra, con signos, moneda, cuentas y sobres. El traslado usa texto y dirección; no se presenta como un gasto ni un ingreso nuevo.
- Los sobres se consultan bajo demanda y las dos selecciones comparten la petición si usan la misma cuenta. Los errores no provocan un bucle automático de solicitudes; «Volver a cargar opciones» es una acción explícita.

El importe de entrada usa punto decimal y no acepta signos, notación científica ni separadores de miles. La presentación usa el formateador es-CR existente. No cambia el motor compartido `lib/money.ts` ni se redondea silenciosamente una entrada inválida.

## Guardado y recuperación

Antes del POST se genera un UUID v4 usando `crypto.getRandomValues`, disponible también en el origen HTTP de testing en LAN. No depende de `randomUUID`, que puede requerir contexto seguro, ni utiliza Math.random.

La web conserva **un intento pendiente por usuario y pestaña** en `sessionStorage`, con UUID, cuerpo inmutable y etiquetas para el resumen. Incluye importe, fecha, descripción e IDs necesarios para recuperar el intento; no almacena credenciales. No se usa localStorage ni se envían estos datos a analítica. El borrador pendiente se elimina después de confirmar o de recibir un rechazo autoritativo. No se borra automáticamente por tiempo ante una confirmación incierta. El almacenamiento es de la sesión de la pestaña y no ofrece recuperación entre dispositivos o después de limpiar los datos del navegador.

Si no puede guardar el intento antes de enviar, la operación no se envía. Un doble clic queda bloqueado de forma síncrona y el botón comunica carga. Un fallo de red, 5xx o respuesta 2xx incongruente conserva el intento y bloquea su edición. El usuario puede cerrarlo y revisarlo después desde el aviso en Movimientos, incluso al recargar la página.

«Reintentar transferencia» usa exactamente el mismo UUID y cuerpo. El servidor devuelve la confirmación original si ya existe; si el intento anterior no llegó a confirmarse, lo procesa una sola vez. La web acepta únicamente una confirmación con usuario, fecha, descripción, extremos e importes coincidentes. Refresca la lista desde el servidor al confirmar para evitar duplicar una fila recuperada.

Solo los códigos conocidos de rechazo previo a escritura (validación, pertenencia, registro inexistente o actividad), y la falta explícita de preparación, liberan el intento y conservan el texto editable. Un timeout HTTP o cualquier error desconocido mantiene el UUID, incluso con estado 4xx: una respuesta de un intermediario puede ocultar un movimiento confirmado. `IDEMPOTENCY_CONFLICT` conserva el intento y pide revisar movimientos; no crea otro UUID para eludirlo. Un registro de recuperación malformado bloquea la creación y solicita revisar la operación, en lugar de empezar silenciosamente otra.

No se promete deduplicación cuando el usuario inicia una intención nueva con otro UUID. Los reintentos seguros dependen de conservar la clave del intento original.

## Compatibilidad y despliegue

El compositor requiere la nueva API `POST /api/transfers` y su tabla auxiliar preparada explícitamente. [Contrato y preparación del backend](https://github.com/emmanuelsalazar92/zandaka-api/blob/staging/docs/transfers.md) en el repositorio API. La ausencia de preparación se muestra como «Las transferencias guiadas aún no están habilitadas»; no se usa el endpoint anterior como fallback.

Promover un par compatible de imágenes web/API desde staging durante el bloque de testing acordado. Esta entrega no ejecuta la preparación contra bases del usuario ni despliega testing. Instrucciones operativas en `zandaka-api/docs/transfers.md` y `docs/staging.md` de ambos repositorios.

## Verificación

Pruebas unitarias cubren importes y precisión, extremos y monedas, fecha real, UUID, persistencia por pestaña, recuperación malformada y coincidencia de la confirmación. La regresión de Movimientos comprueba el cuerpo positivo del nuevo endpoint y mantiene los casos monetarios de otros tipos.

Playwright usa controles reales, teclado, datos sintéticos y red aislada. Revisa 360/390/1440 px, claro/oscuro, texto 100/200 %, contraste axe, geometría, resumen, bloqueo de combinaciones inválidas, confirmación perdida o inválida, recarga/reintento con el mismo cuerpo y almacenamiento bloqueado sin POST. La integración SQLite y la conservación de saldos se comprueban en el backend, no se infieren del mock del navegador.

Ejecutar formato, lint, typecheck, unitarias, build y `npm run test:e2e`. Ampliar texto no equivale a zoom nativo ni sustituye una revisión manual con lector de pantalla o dispositivos físicos.
