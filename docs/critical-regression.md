# Regresión transversal del rediseño — ZA-107

## Alcance y aislamiento

Revisión del 22 de noviembre de 2026, sobre `staging`. La referencia visual sigue siendo Atlántico / Marea. El trabajo valida comportamiento financiero y accesibilidad del rediseño; no cambia reglas monetarias, contratos, tablas ni snapshots y no despliega testing.

La web se compila y sirve exclusivamente en `127.0.0.1:3212`, sin reutilizar servidores. Playwright intercepta las peticiones de API con fixtures sintéticas, bloquea destinos externos y conserva trazas de fallos. Las escrituras de los recorridos se resuelven en esas fixtures. La API se prueba por HTTP loopback con SQLite temporal creado por cada suite; no se usa la copia productiva de auditoría ni la base del Mac.

Una discrepancia de datos entre testing y producción no es evidencia de regresión. Esta ejecución acredita la revisión local, no una verificación del contenedor remoto ni una aceptación humana de usabilidad.

## Matriz de evidencia

| Riesgo original                              | Escenarios y evidencia reproducible                                                                                                                                                           |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UX-01: acciones móviles recortadas           | `transactions-layout`, `navigation`, `critical-regression`: 360/390/768/1440 px, claro/oscuro y texto 100/200 %, controles dentro del ancho útil.                                             |
| UX-02: fecha contable                        | Unitarias `date-only`; recorridos de composición, ficha y conciliación conservan `YYYY-MM-DD`, distinguen fecha contable de timestamp y muestran horario de Costa Rica.                       |
| UX-03: contraste                             | Unitarias `contrast` verifican tokens/tintes; axe AA sobre DOM renderizado en claro/oscuro, incluidos tablet y texto ampliado.                                                                |
| UX-04: nombres y teclado                     | `accessibility`, selectores buscables, modales, Escape, retorno de foco, errores asociados y salto al contenido.                                                                              |
| UX-05/06: historial y significado financiero | Ficha con todas las líneas, extremos inactivos, filtros y foco conservados; sobres no presentan suficiencia inferida de participación.                                                        |
| UX-07/08: transferencias y monedas           | CRC/USD, centavos, conservación de totales, reintento con recibo durable, rechazo atómico y confirmación explícita. API `transfers`/`monetary-balance`; web `transfers`/`movements-composer`. |
| UX-09/10: contexto temporal y navegación     | Cotización anterior/ausente explícita, períodos coherentes, menú móvil cerrado al navegar y destino accesible.                                                                                |
| UX-11: conciliación                          | Conteo manual/denominaciones, centavo real, diferencia histórica, rechazo y resultado incierto; API `reconciliation`, web `reconciliation-review`.                                            |
| UX-12: importación                           | Motivos visibles por fila, asignación masiva, filas idénticas ambiguas, confirmados/rechazados/inciertos, reintento selectivo y protección después de recargar en la misma pestaña.           |
| UX-13: presupuesto                           | Origen USD/CRC, porcentajes, IVA, compra/venta, redondeos por línea, cierre, revisión y asignación atómica con replay; APIs y fixtures de `budget-plan`.                                      |
| UX-14/15: lectura y tareas                   | Monedas explícitas, nombres largos, actividad/período, acciones contextuales, archivo y comparación de reportes.                                                                              |
| Historia y precisión                         | API `monetary-balance`, `report-snapshot`, `report-pdf`, `transaction-detail`: centavos, residuos heredados, filas históricas preservadas, snapshots congelados y HTML escapado.              |
| Movimiento y recuperación                    | `operation-feedback`: preferencia normal/reducida, anuncios de carga, exclusión de guardados y confirmaciones inciertas sin reenvío automático.                                               |

`e2e/critical-regression.spec.ts` complementa las fixtures pobladas de cada módulo con 11 rutas × cuatro anchos × dos temas × dos tamaños de texto (176 combinaciones). Revisa cuerpo y controles, no solo encabezados; admite desplazamiento interno de tablas detalladas. Añade axe en tablet con texto al 200 % y comprueba el salto al contenido en cada ruta.

`e2e/import-batch.spec.ts` incluye un lote mixto con centavos, fecha, confirmación, rechazo y respuesta incierta. Comprueba el orden y número de POST, autoriza solo el rechazo revisado y vuelve a procesar el lote después de recargar, sin repetir los confirmados o inciertos.

## Hallazgos corregidos

1. **Importación, 360/768 px / texto 200 %:** el grupo de acciones y los campos de ancho fijo podían superar el ancho disponible. Se permiten contracción, ancho máximo, selector de banco multilínea y partición de texto; no se oculta el desbordamiento del documento. El botón muestra «Procesar», conserva el nombre accesible «Procesar movimientos» y permite separar icono/texto en poco espacio.
2. **Resumen, 768 px / texto 200 %:** el ancho intrínseco del selector nativo de mes superaba su contenedor junto al sidebar. Se limita al ancho disponible manteniendo el campo editable.
3. **Categorías, escritorio / texto 200 %:** las columnas respondían al viewport y dejaban demasiado poco espacio a las filas cuando el sidebar y el texto crecían. La distribución de Ajustes/catálogos responde ahora a su propio contenedor, con umbrales relativos al tamaño de texto.
4. **Reportes vacíos, móvil / texto 200 %:** dos contenedores con padding acumulado reducían el botón a un ancho ilegible. Se conserva una sola superficie y el icono puede pasar a otra línea sin recortar la acción.
5. **Idioma en Importación:** las instrucciones de ejemplo del campo de pegado seguían en inglés. Se traducen a español conservando intacto el formato de los datos bancarios.

No se modifican importes, fechas, asignaciones o contratos para corregir geometría. La composición Marea y la jerarquía de acciones se conservan.

## Ejecución

Desde `zandaka-api`: `npm test`, `npm run lint`, `npm run type-check`, `npm run build`.

Desde `zandaka-web`: `npm run test:ci`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e`. El formato se verifica con Prettier sobre los archivos del ticket. La nueva cobertura queda incluida automáticamente en la suite estándar de CI; no requiere servicios o variables de bases reales.

Si el entorno impide conexiones loopback y devuelve `connect EACCES 127.0.0.1`, registrar la ejecución como impedida por el entorno y repetir con acceso local permitido. No atribuir esos fallos a la lógica financiera ni debilitar los tests. Si una compilación interrumpida conserva un lock, identificar su proceso antes de detenerlo; no terminar procesos ajenos.

## Límites de la aceptación

Ampliar el texto al 200 % y revisar reflow en anchos pequeños no equivale a probar el zoom nativo del navegador. Axe, nombres/roles/estados y recorridos de teclado tampoco equivalen a escuchar anuncios con Narrador, NVDA o VoiceOver. La sesión humana con lector de pantalla, zoom nativo, crítica de diseño y tareas reales permanece en **ZA-108**, a cargo del propietario con apoyo del agente. No se declara conformidad integral WCAG ni aceptación humana completada.

La prevención de duplicados de importación sigue limitada a la pestaña/sesión: no es idempotencia global de servidor. Transferencias y aplicación de presupuestos tienen sus propios recibos durables. Medición de rendimiento en el despliegue corresponde a ZA-109; telemetría y SQL a ZA-100/101.

Los logs, resultados y trazas de esta ejecución se conservan en `operaciones/ZA-107` del workspace. El informe final de resultados diferencia la primera ejecución, las correcciones y la repetición sobre el build final; no transforma fallos iniciales en aprobaciones retrospectivas.

## Resultados registrados

| Ejecución                                    | Resultado                                                                                                                  | Evidencia local                   |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| API, con loopback permitido                  | 98 financieras + 4 decimales + 22 cliente operativo aprobadas                                                              | `api-tests-loopback.log`          |
| Unitarias web                                | 208 aprobadas en 37 archivos                                                                                               | `web-unit.log`                    |
| Primera suite completa de navegador          | 527 aprobadas y 6 fallidas: tres defectos de geometría en ambos temas                                                      | `browser-results.json`            |
| Repetición de módulos afectados              | 164 aprobadas y 5 fallidas: importación/tablet, reporte vacío y timeout de la nueva prueba por notificación con reloj fijo | `final-browser-results.json`      |
| Matriz, importación y Reportes corregidos    | 23 aprobadas, sin fallos, omisiones o casos intermitentes                                                                  | `acceptance-browser-results.json` |
| Último ajuste de botón/textos de importación | 12 aprobadas sobre el último build, sin fallos, omisiones o casos intermitentes                                        | `release-browser-results.json`    |

Los 534 casos distintos de navegador quedan cubiertos por estas corridas sucesivas y la repetición de los afectados; no se presenta como una única suite completa aprobada sobre el último build. Ningún fallo inicial se eliminó, omitió o cambió a una expectativa de éxito. El test mixto cierra la notificación con su botón visible; no fuerza el clic a través de ella ni espera un temporizador congelado por la fixture.

Lint, tipos y builds de ambos repositorios aprobados; formato verificado sobre los archivos del ticket. Capturas finales de importación móvil y categorías con texto ampliado revisadas. No hay cambios nuevos de API o DB. La revisión humana nativa indicada arriba sigue pendiente y debe quedar visible en el seguimiento, aunque las comprobaciones automáticas estén aprobadas.
