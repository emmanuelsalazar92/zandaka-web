# ZA-100 · Medición de uso sin datos bancarios

## Estado comprobado · 26 de noviembre de 2026

El checkout incorpora `@vercel/analytics` **1.3.1**. Antes de este ticket solo existía el componente en `app/layout.tsx`; no había eventos de tareas. El commit local anterior `55ea629` limitó su montaje a Vercel para evitar el script 404 en Docker. Ese commit y ZA-100 todavía necesitan una entrega solicitada por el propietario. No se inspeccionó ni modificó el servidor remoto para este ticket.

Testing usa Docker. Ejecutar el SDK no crea las rutas de ingestión de Vercel. No se accedió al dashboard, configuración, plan ni datos históricos del proveedor: su cobertura real **no está acreditada**. No se abrió la copia SQLite productiva; sus movimientos tampoco acreditan visitas o abandonos.

**Línea base real: no disponible.** No se conocen vistas, tareas, errores, sesiones, usuarios ni páginas más consumidas. Ausencia no significa cero. Ver [informe inicial](usage-baseline-2026-11-26.json). Los recorridos sintéticos validan la implementación, no representan tráfico real.

Se reutiliza el SDK existente; no se incorpora otro proveedor, backend de telemetría, endpoint o tabla.

## Activación y ausencia de proveedor

El servidor solo habilita la medición cuando coinciden **ambas** variables:

```text
VERCEL=1
ZANDAKA_ANALYTICS_ENABLED=true
```

La segunda queda desactivada si falta. Establecerla únicamente tras verificar Web Analytics y soporte de eventos personalizados en el proyecto/plan. No establecer `VERCEL=1` en Docker: no crea endpoints. No se añadieron credenciales, proxy o endpoint alternativo.

Sin plataforma compatible, opt-in o carga del script no se envían ni acumulan eventos de tareas. La UI sigue funcionando. Cargar el script no acredita recepción; red, bloqueadores o un plan incompatible reducen cobertura. No hay reintentos, recuperación histórica ni almacenamiento de analítica. Si el SDK llega después de abrir una tarea, no reconstruye acciones pasadas; el siguiente envío puede iniciar un recorrido observado desde ese punto.

Se excluyen documentos con `document.referrer` no vacío, Do Not Track `1` o Global Privacy Control. El contrato público del SDK fijado no permite redactar el referrer; por eso se excluye esa carga completa. Esto sesga la muestra. La preferencia se comprueba también al enviar. Metadata declara `no-referrer` para suprimir el encabezado de referencia en solicitudes salientes.

## Catálogo cerrado v1

`safeUsageEvent` rechaza propiedades adicionales y valores fuera de catálogo. La API de medición nunca recibe argumentos de formulario. Los nombres enviados llevan prefijo `za_`.

| Evento            | Propiedades      | Significado                                                                                     |
| ----------------- | ---------------- | ----------------------------------------------------------------------------------------------- |
| `za_screen_view`  | `screen`         | Pantalla observada tras cargar el SDK y al cambiar pathname; una por transición                 |
| `za_task_start`   | `task`           | Entrada al recorrido definido abajo; no cada render                                             |
| `za_task_submit`  | `task`           | Intento deliberado; clics duplicados mientras está pendiente no generan otro                    |
| `za_task_finish`  | `task`, `result` | Terminal: `completed`, `partial` o `uncertain`                                                  |
| `za_task_error`   | `task`, `reason` | Intento rechazado con certeza (`rejected`) o bloqueado localmente (`local`); permite corrección |
| `za_task_abandon` | `task`           | Salida de un recorrido abierto sin escritura pendiente                                          |

`screen`: `dashboard`, `transactions`, `import`, `accounts`, `envelopes`, `reconciliation`, `budgets`, `reports`, `settings`, `institutions`, `categories`, `other`. Diseño y rutas desconocidas se agrupan en `other`. Todos los IDs de presupuestos se agrupan en `budgets`. Query/hash no son propiedades.

`task`: `movement`, `import`, `reconciliation`, `budget_save`.

| Tarea            | Inicio                                         | Confirmación y límites                                                                                                                                                                                                            |
| ---------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `movement`       | Abrir ingreso/gasto                            | Recibo validado; no incluye transferencias                                                                                                                                                                                        |
| `import`         | Procesar texto para revisión                   | Un intento por lote confirmado, no por fila. Todos confirmados: `completed`; confirmados más pendientes conocidos: `partial`; cualquier resultado incierto: `uncertain`. Sin confirmados, un lote bloqueado/rechazado emite error |
| `reconciliation` | Abrir Nueva conciliación                       | Recibo de creación validado; no incluye consultar, ignorar o cerrar registros                                                                                                                                                     |
| `budget_save`    | Primer cambio que deja sucio el borrador Marea | Guardado confirmado. No significa finalizar, convertir, pagar o asignar a sobres                                                                                                                                                  |

Una corrección tras rechazo conserva el inicio y añade otro envío. Después de un terminal, otro envío inicia un recorrido nuevo. Recargar o recuperar un recibo no reconstruye eventos. No se clasifica como abandono la inactividad, ocultar la pestaña o cambiar de sección dentro del formulario. Salir con escritura pendiente produce `uncertain`, no rechazo. `pagehide`/cierre no garantiza entrega; un navegador terminado abruptamente puede no emitir. Los resultados posteriores a la salida no reescriben analítica previa.

La validación que deshabilita un botón o la carga fallida de un catálogo no genera `task_error`: se miden intentos de tarea, no cada aviso, tecla o fallo de lectura. No presentar este conteo como la tasa total de errores de la aplicación.

## Privacidad y rendimiento

- No se envían importes, monedas, saldos, salarios, fechas contables, IDs de usuario/cuenta/sobre/plan/transacción, nombres de bancos/cuentas, categorías, descripciones, notas, texto pegado, mensajes de excepción, respuestas HTTP o fingerprints de importación.
- No se añaden IDs de sesión/tarea, cookies, localStorage, sessionStorage, hashes o correlación entre pestañas. La deduplicación es efímera en memoria. No se reutilizan ni modifican los mecanismos financieros existentes de recuperación.
- Las vistas automáticas están deshabilitadas y `beforeSend` además las rechaza. Cada vista es un evento personalizado de catálogo. El URL del evento se reduce a `origin + /usage`, sin path, ID, query o fragmento. `/usage` es una etiqueta, no una página nueva.
- El proveedor puede procesar metadata técnica propia (IP, dispositivo, agente, timestamp, etc.): esto no equivale a ausencia absoluta de datos personales. Las pruebas verifican nuestros argumentos y redacción, no el wire format, retención o recepción del script remoto. Verificar antes de activar.
- La medición no bloquea ni reintenta escrituras financieras, no consulta SQL, no captura DOM ni pulsaciones y no emite por fila del lote. Fallar el sink no falla la operación.

## Reportes, período y denominadores

Mantener tres apartados con **el mismo intervalo explícito**:

1. **Vistas**: contar `za_screen_view` por `screen`. No usar Page Views automáticas (desactivadas), ni sumar eventos de tareas como visitas.
2. **Tareas**: por `task`, separar inicios, envíos, `completed`, `partial`, `uncertain` y abandonos. No sumar parciales a completados sin indicarlo.
3. **Errores**: contar `za_task_error` por tarea y razón. Lo incierto permanece en tareas, no es un fallo confirmado.

Usar `[desde, hasta)` UTC y mostrar su equivalencia en `America/Costa_Rica`. Para el día local 26 de noviembre: `2026-11-26T06:00:00.000Z` a `2026-11-27T06:00:00.000Z`. Ventana del informe y retención del plan son cosas distintas.

| Indicador                          | Numerador                 | Denominador                        |
| ---------------------------------- | ------------------------- | ---------------------------------- |
| Completados por inicio del período | `completed` del intervalo | Inicios del intervalo, misma tarea |
| Abandonos por inicio del período   | Abandonos del intervalo   | Inicios del intervalo, misma tarea |
| Errores por intento del período    | Errores del intervalo     | Envíos del intervalo, misma tarea  |

Denominador cero: **no calculable**, no 0 %. Son relaciones de conteos del período, **no conversiones de cohortes o usuarios**: un recorrido puede cruzar límites y una relación superar 100 %. Cierres, exclusiones y pérdidas de red dejan recorridos incompletos. No deducir abandono como `inicios - completados`. No hay usuarios únicos, sesiones, funnels individuales, duración o p95.

`lib/usage-report.ts` genera el desglose desde exportaciones **previamente minimizadas** con filas `{ at: ISO_UTC, event: { name: SIN_PREFIJO_ZA, data: CATALOGO } }`. Rechaza campos extra y valida también filas fuera del intervalo. No introducir exportaciones crudas con IDs o metadata personal. `source=unavailable` produce apartados `null`; `synthetic` se distingue de `verified_export`. El helper no obtiene datos del proveedor, no verifica autenticidad ni deduplica exportaciones repetidas.

Para reportar desde Vercel: seleccionar ventana en Events, filtrar los eventos `za_*`, agrupar por las propiedades anteriores y registrar proyecto, entorno, disponibilidad y cobertura. Conservar solo agregados, nunca IDs de visitantes o metadata individual en el repositorio. Sin datos, conservar el informe de ausencia; no publicar tests como uso real.

## Verificación y futura activación

```sh
npm run test:ci
npm run lint
npm run typecheck
npm run build
npx playwright test --config playwright.usage.config.ts
```

La configuración adicional arranca **solo 127.0.0.1:3213**, opt-in únicamente en su proceso y script SDK simulado. Bloquea tráfico externo; escrituras financieras van a fixtures. Consume las llamadas del SDK fijado, comprueba catálogo, redacción, ausencia de `Referer` y cardinalidad en los cuatro formularios. No acredita ingestión remota. La suite habitual mantiene la medición desactivada fuera de Vercel.

Antes de activar: comprobar proyecto/plan/entorno, endpoints y recepción; recorrer con **datos sintéticos** inspeccionando la solicitud final del script remoto (URL, encabezados, referrer, propiedades, metadata), confirmar cardinalidad y los tres apartados en la ventana elegida, y registrar evidencia. Si falta verificación, mantener opt-in apagado. No activar servicios de pago ni sustituir proveedor implícitamente.

No requiere cambios de API o DB. No se publica ni despliega al implementar. Reversión: retirar opt-in, sin tablas o dinero que revertir. No se modificaron el worker ni restricciones SSH.

## Fuentes técnicas

- [SDK y beforeSend](https://vercel.com/docs/analytics/package).
- [Redacción](https://vercel.com/docs/analytics/redacting-sensitive-data).
- [Eventos personalizados y planes](https://vercel.com/docs/analytics/custom-events).
- [Metadata y privacidad](https://vercel.com/docs/analytics/privacy-policy).
- [Activación](https://vercel.com/docs/analytics/quickstart).

También se revisaron código y tipos locales **1.3.1**; no se usaron opciones exclusivas de versiones posteriores.

## Resultado local de aceptación

El 26 de noviembre pasaron 246 pruebas unitarias (31 del catálogo, ciclo de vida, privacidad y reportes), 10 recorridos específicos de medición y 9 regresiones financieras relevantes con medición desactivada, sin reintentos de test. Pasaron lint, TypeScript, compilación y formato de los archivos de implementación. Los recorridos específicos adjuntan `synthetic-application-events.json` al reporte de Playwright: permite inspeccionar cada payload minimizado. Evidencia de trabajo local en `operaciones/ZA-100` del workspace; no se publica tráfico ni datos financieros.

Los resultados acreditan comportamiento local con fixtures, no recepción de Vercel ni uso real. La API solo incorpora notas operativas; su runtime y todas las bases permanecen sin cambios. Implementación guardada mediante commits locales en `staging`, sin push ni deploy.
