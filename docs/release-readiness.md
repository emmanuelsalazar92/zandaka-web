# Candidata y rendimiento del rediseño — ZA-109

Revisión del 22 de noviembre de 2026. **Preparación local; sin push ni nuevo deploy.** La candidata funcional es web `5818dad`, con las herramientas/documentación de ZA-108/109 añadidas después. API compatible: runtime de `af90bae`; `ad8bdee` agrega documentación de regresión. Al publicar/desplegar usar las revisiones finales reales, no asumir que estos hashes de referencia incluyen cambios posteriores.

La evaluación humana pendiente está en [ZA-108](usability-review.md); la regresión automática y las correcciones de legibilidad están en [ZA-107](critical-regression.md). Una medición local no acredita el estado vigente del Mac ni una aceptación con usuarios.

## Comparación reproducible antes/después

No existía una medición de rendimiento anterior al rediseño. Se reconstruyó el antes desde **`baa47e95eaa8e2f656e04f64f2976d548f8aa945`**, inmediatamente anterior a la primera base Atlántico; no se presenta como una medición tomada en aquella fecha. El después es **`5818dad3612ca8e76353b533acd052a657c75897`**. Se usaron archivos exportados con `git archive`, sin cambiar los checkouts ni usar bases reales.

Ambas copias se compilaron como producción con **Next 16.0.10 / webpack**, las mismas dependencias runtime instaladas y el mismo Node. Las publicaciones normales pueden usar otro empaquetador: esta comparación aísla las revisiones con un compilador común, no predice bytes o tiempos exactos de la imagen GHCR. No se instalaron paquetes ni se descargaron fuentes para medir.

Windows x64, Intel Core Ultra 7 155H, 22 CPUs lógicas; Node 24.12.0, Chromium 156.0.8078.4. Rutas `/`, `/transactions`, `/reports`; cinco muestras por revisión/ruta/perfil, **60 navegaciones medidas**, secuenciales y alternando el orden antes/después. Servidores calientes tras precalentar ambas versiones; contexto nuevo y caché de navegador deshabilitada en cada muestra. No se ejecutan builds ni otras suites durante las muestras.

- Desktop: 1440 × 1000, CPU sin throttling, red local sin límite simulado.
- Móvil de laboratorio: 390 × 844, CPU ×4, latencia 100 ms, descarga 200 000 bytes/s y subida 100 000 bytes/s. Es emulación sobre el mismo PC, no un teléfono físico.
- Misma API sintética interceptada, con demora fija de 120 ms; no mide SQLite, Internet ni la API real. Se exige contenido de la fixture visible, además de ausencia de carga y estabilización de red.
- FCP por Paint Timing; LCP/CLS y tareas largas observados en una ventana acotada de carga. El tiempo de interacción es un cambio de tema, desde el clic hasta dos frames posteriores a la mutación de clase. **No es INP de campo ni tiempo humano de completar una tarea.**

Datos y método: [resultado JSON](reviews/performance-2026-11-22.json). Los valores siguientes son medianas de cinco muestras; no se publican puntuaciones Lighthouse inventadas ni se extrapola al rendimiento real de usuarios.

| Ruta        | FCP desktop antes → después | FCP móvil antes → después | Bloqueo observado móvil antes → después | JS comprimido antes → después |
| ----------- | --------------------------- | ------------------------- | --------------------------------------- | ----------------------------- |
| Resumen     | 64 → 72 ms                  | 892 → 968 ms              | 117 → 193 ms                            | 195 825 → 225 748 B           |
| Movimientos | 56 → 88 ms                  | 904 → 920 ms              | 156 → 82 ms                             | 206 278 → 248 596 B           |
| Reportes    | 56 → 56 ms                  | 904 → 900 ms              | 125 → 118 ms                            | 215 662 → 223 460 B           |

La candidata **no mejora todas las métricas**. Resumen aumenta 76 ms de FCP y 76 ms de bloqueo observado en móvil. Movimientos añade aproximadamente 42 kB de JS comprimido, aunque baja el bloqueo observado en estas muestras. Los compositores, ficha y recuperación del nuevo flujo forman parte del código inicial; no se atribuye cada byte a un módulo sin un profiler específico. Se conserva la funcionalidad/seguridad y se registra ese coste, en vez de introducir carga diferida con estados de error/foco sin demostrar una necesidad mayor.

El LCP observado del Resumen desktop pasa de 64 a 304 ms: cambió la composición y el elemento de mayor tamaño, que ahora incluye el saldo protagonista dependiente de datos. En móvil pasa de 892 a 968 ms. El CLS observado del Resumen móvil pasa de 0,0041 a 0,0253; las otras dos rutas quedan en 0. No ocultar estos aumentos tras una reducción de recursos global.

En desktop desaparece el logo rasterizado optimizado de 133 113 B, sustituido por un SVG de 304 B. Eso reduce recursos totales, **pero no demuestra una reducción de JS**. En móvil el sidebar cerrado no descarga ese logo: no corresponde adjudicarle allí el mismo ahorro. El JSON separa scripts, CSS, imágenes y documento; `assetBytes` incluye recursos/prefetch no API, por lo que no equivale exactamente a la suma de esas categorías.

No hay fuentes web remotas ni blur decorativo en estas rutas Marea. Persisten dos usos de `backdrop-blur` en vistas legacy de detalle/asignación de presupuestos; no se midieron en estas tres rutas ni se declara su coste cero. Sombras/materiales acotados y reducción de movimiento siguen el sistema visual.

## Decisión y límites

La candidata queda preparada para revisión en testing por el propietario. No se observa un aumento grande de primera pintura en estas rutas del laboratorio; sí existe coste de JS y de bloqueo en Resumen, documentado arriba. No se acepta como garantía de producción ni se cierra la medición de backend/SQL por este experimento.

Como seguimiento propuesto, revisar cualquier cambio futuro que aumente FCP más de 200 ms y 20 %, interacción observada por encima de 200 ms, CLS observado por encima de 0,1 o JS inicial más de 50 KiB y 25 %. Son presupuestos internos **propuestos después de establecer esta línea base**, no umbrales aprobados previamente ni una certificación de estándares. Conservar también los valores crudos y el contexto; una mediana por sí sola no autoriza una regresión material.

Antes de producción falta decisión del propietario sobre la experiencia observada y revisión en el destino real. No introducir telemetría de cuentas o consultas como efecto lateral: medición de tareas/SQL corresponde a ZA-100/101. No se ha medido INP real, caché caliente del navegador, móviles físicos, datasets grandes o latencia real del banco/API.

## Reproducir el laboratorio

1. Exportar cada revisión a directorios aislados con `git archive`; registrar hashes completos y verificar las dependencias runtime. No cambiar `staging` ni copiar archivos `.env` o bases. Reutilizar dependencias instaladas compatibles o preparar una instalación aislada explícita.
2. Compilar ambas con `node node_modules/next/dist/bin/next build --webpack`. Iniciar el antes en `127.0.0.1:3214` y el después en `127.0.0.1:3215`. No reutilizar servidores ajenos.
3. Desde la web actual: `node scripts/performance-review.mjs NUEVO_RESULTADO.json BEFORE_FULL_SHA AFTER_FULL_SHA`. El directorio de salida debe existir; la herramienta rechaza sobrescribir resultados. Los hashes son la identificación declarada de las copias servidas: el operador debe comprobar que los servidores corresponden a esos exports.
4. No ejecutar muestras en paralelo con builds, otras pruebas o la revisión nativa. Conservar el resultado completo y explicar fallos del entorno; no seleccionar solo la muestra más rápida. Cerrar únicamente los servidores/ventanas creados para la revisión.

La primera pasada exploratoria se conservó en `operaciones/ZA-108-109/performance.json`. La comparación publicada es `performance-verified.json`, que exige contenido cargado y añade desglose de recursos; no se mezclan sus muestras. El frontend no incorpora el runner ni sus fixtures en el flujo de usuarios.

## Pantallas y pendientes de entrega

| Pantalla            | Disponible en candidata                                            | Qué confirmar / límite                                                                     |
| ------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Resumen             | Saldo, originales, período, atención, accesos directos             | Estado de saldos distinto del cierre mensual; API con filtro exclusivo de gastos.          |
| Movimientos / ficha | Filtros, densidad, detalle, ingreso/gasto y transferencia guiados  | Fecha local, monedas y confirmación; recibo durable en transferencias.                     |
| Importación         | Revisión por fila/lote, asignación masiva y recuperación           | El registro es de pestaña/sesión, no idempotencia global del servidor.                     |
| Cuentas / Sobres    | Contexto, saldo y mantenimiento integrado                          | Restricciones de saldo/actividad preservadas; ubicación de catálogos por contrastar en U6. |
| Conciliación        | Manual/efectivo, diferencia, detalle e investigación               | Investigar no ajusta; no corregir historia por una prueba visual.                          |
| Presupuestos Marea  | Planificación, revisión y asignación explícita                     | No realiza pagos ni conversiones bancarias automáticas; requiere auxiliares compatibles.   |
| Ajustes / catálogos | Preferencias, Instituciones, Categorías, reglas, efectivo y nómina | Pruebas locales no sustituyen descubrir las tareas sin ayuda.                              |
| Reportes            | Archivo/versiones, lectura HTML, PDF y comparación                 | Snapshot conservado; no inventar corte contable a partir de generación.                    |

Links/rutas, preferencias, foco y recuperación se cubren en ZA-107; la validación humana continúa explícita en ZA-108. No etiquetar el laboratorio, `/design-reference` o fixtures como datos reales del entorno.

La promoción gradual y rollback por pares de imágenes se documentan en API `docs/redesign-release.md`, junto con la entrada `docs/deploy-testing.md`. **No hay tablas o migraciones nuevas por este bloque.** Conservar `transfer_request`, `budget_plan`, sus recibos y snapshots al revertir. Un futuro deploy requiere solicitud, destino vigente, plan nuevo, respaldo y recibo real; publicar imágenes no lo ejecuta.
