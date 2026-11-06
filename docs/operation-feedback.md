# Feedback y microinteracciones — ZA-105

## Contrato compartido

Se reutiliza Atlántico: 140 ms para selección, filtros, controles y enlaces; 220 ms para entrada de capas. Solo se transicionan color, fondo, borde y sombra. Las cifras no cuentan desde cero, no cambian de tamaño con transiciones ni se interpolan. Las superficies de lectura mantienen posición y opacidad.

Con prefers-reduced-motion: reduce se desactivan animaciones/transiciones, incluidos spinners y pulsos; el desplazamiento pasa a auto. La información de carga permanece como texto visible o anuncio accesible, sin depender del movimiento. La preferencia no cambia importes, foco ni acciones.

Skeleton es decorativo (aria-hidden). LoadingSkeleton anuncia una sola explicación de carga y aria-busy; LoadingState mantiene texto visible y anuncio polite/atómico. Feedback usa status o alert según su tono, anuncio atómico y una acción opcional operable. Los errores de consulta no son estados vacíos; Movimientos adopta explícitamente Feedback de error con reintento conservando filtros.

Las notificaciones informativas duran seis segundos por defecto. Las destructivas permanecen hasta cerrarse, salvo duración explícita del llamador. Tras cerrar, el estado se retira de memoria en un segundo, no en dieciséis minutos. La notificación complementa el resultado junto a la tarea; no prueba por sí sola una escritura financiera.

## Operaciones y recuperación

Ajustes añade exclusión síncrona de envíos para perfil y reglas, indicador busy conservando el nombre del botón y mensajes persistentes del perfil. Un fallo conserva el borrador y ofrece consultar el perfil guardado. Un guardado incierto de una regla exige consultar las reglas antes de repetir; un rechazo HTTP 4xx permite corregir el formulario. El cambio no agrega idempotencia al servidor.

Reportes añade exclusión síncrona para generación/archivado. Durante generación, los campos están bloqueados y Escape/cierre no descartan la operación en curso. Un fallo conserva el formulario; si no se puede confirmar el resultado se comunica por revisar, sin afirmar que no se guardó. Se debe cerrar y actualizar el archivo antes de reintentar. El archivado fallido permanece en su diálogo con la misma indicación. Los éxitos muestran mes y versión confirmados y el siguiente paso. No se reintenta ninguna escritura automáticamente.

## Inventario por tarea

| Plantilla           | Carga / vacío / error / resultado                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Resumen             | Bloques independientes; ausencia confirmada distinta de saldo desconocido; incidencias y actividad conservan contexto.                       |
| Movimientos         | Timeline de carga; vacío con acción; error con reintento y filtros; confirmación al volver del registro.                                     |
| Cuentas y Sobres    | Lecturas independientes, contexto no disponible y vacío confirmado; formularios conservan borradores; resultados inciertos bloquean repetir. |
| Conciliación        | Carga de cuentas/historia; ausencia de cierres; incidencias verificables; confirmación de revisión conservando histórico.                    |
| Presupuestos        | Carga/lista vacía/error; fases y resultados de asignación de ZA-97; sin recalcular por motivos visuales.                                     |
| Reportes            | Archivo con carga anunciada y vacío confirmado; documento parcial fallido conserva resumen; generación/archivado con resultado explícito.    |
| Ajustes y catálogos | Carga por secciones, lista vacía confirmada y dependencias desconocidas; bloqueo de guardado y retorno de foco.                              |
| Importación         | Revisión por fila de ZA-95/96; pendientes distintos de errores; confirmados, rechazados e inciertos conservados.                             |

La galería /design-system contiene ejemplos sintéticos de carga/vacío/error/éxito. No consulta saldos ni se presenta como una operación real. Los estados de módulos ya implementados se conservan; este ticket no sustituye la validación financiera transversal de ZA-107 ni la sesión humana de ZA-108.

En catálogos, cerrar un diálogo durante la recarga lleva temporalmente el foco al contenido principal y lo devuelve al control de origen cuando vuelve a estar habilitado. Si el usuario ya eligió otro control, la respuesta tardía no roba el foco. Se verifican ambos casos con una recarga sintética retenida.

## Evidencia y entrega

Pruebas unitarias de anuncios y acciones; navegador con carga/error de ocho tareas, preferencia de movimiento normal/reducida, vacío confirmado y guardados pendientes/fallidos con transporte sintético. La regresión completa incluye teclado, foco, modales y los escenarios financieros existentes. Evidencia en operaciones/ZA-105 del workspace.

Solo web, staging y commit local sin push/deploy. Sin API, DB, migraciones, cambios monetarios ni nuevos requisitos de entorno. Conservar los requisitos acumulados de la guía de staging en una futura entrega por bloques.

La pasada completa inicial ejecutó 523 escenarios: 522 pasaron y uno detectó el retorno prematuro a un botón deshabilitado. Tras corregirlo se repite la suite completa de catálogos y se añaden los dos escenarios de foco diferido. Los informes inicial y posterior se conservan separados; no se presenta la pasada inicial como totalmente correcta.
