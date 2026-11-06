# Importación por lotes — ZA-96

Flujo local: pegar/procesar, revisar/asignar y confirmar resultados. La selección masiva aplica cuenta, sobre y tipo solo a filas válidas de la misma moneda; no cambia magnitudes ni fechas; elegir ingreso/gasto ajusta el signo según el contrato de la API. Las propuestas automáticas conservan su explicación y permiten corrección. El resumen de confirmación separa monedas y las filas con resultado permanecen visibles.

La API vigente crea un movimiento individual por petición y no ofrece idempotencia de importación. La web no reintenta automáticamente: registra un intento pendiente en sessionStorage antes de enviar, exige una confirmación JSON con ID y conserva resultado por fila. Fallos de transporte, 5xx o confirmaciones incompletas quedan inciertos. Una creación confirmada no se vuelve a enviar dentro del lote. Una fila rechazada o incierta requiere revisión explícita de Movimientos antes de habilitar otro intento; el usuario asume esa decisión, no se afirma idempotencia del servidor.

El diario guarda huellas y estados, no texto bancario, importes ni nombres. La huella FNV-64 es un detector de coincidencias, no una prueba de identidad ni anonimización criptográfica. Una colisión provoca revisión conservadora, nunca eliminación. Filas iguales del lote y coincidencias con intentos de esta pestaña se bloquean para revisión; pueden ser operaciones legítimas y el usuario puede autorizar cada una. No se descartan automáticamente.

Límites: protección de esta sesión/pestaña, no entre dispositivos ni sesiones nuevas. No detecta todo el histórico del servidor. Borrar datos del navegador elimina el diario; no equivale a cancelar una petición enviada. Si falla el almacenamiento se bloquea el envío. Resolver una incertidumbre requiere consultar Movimientos; autorizar otro intento sin verificar puede duplicar una operación. La garantía global requiere un contrato idempotente de API separado; este ticket no agrega tablas ni migra DB.

Commit local en staging, sin push ni deploy. Pruebas usan datos sintéticos; la copia productiva no se toca. ZA-95 sigue proporcionando validación visible por fila.
