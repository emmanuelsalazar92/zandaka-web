# Revisión de usabilidad y acabado — ZA-108

Fecha: 22 de noviembre de 2026. Candidata funcional: web `5818dad` (Marea y correcciones ZA-107), API compatible `af90bae` o posterior. Sin nuevo deploy. La revisión diferencia información del propietario, evaluación experta y observación de participantes; no convierte pruebas automáticas en métricas humanas.

## Qué sabemos y qué falta observar

El propietario eligió Atlántico y la composición Marea, pidió energía con color contenido y explicó su presupuesto con ingreso USD diferido varios meses, conversión parcial a CRC, libre retenido en USD y asignaciones a sobres. También cuestionó el peso de Instituciones en el sidebar. Es información real de requisitos y preferencias; no son resultados de una prueba de usabilidad.

Al preparar esta revisión no hay sesiones moderadas registradas ni participantes confirmados para esta ejecución. **Participantes observados: 0.** Éxito de tarea, duración humana, errores, ayuda requerida y satisfacción: **no medidos**, no cero ni 100 %. El propietario preguntó por qué existía este ticket; se aclaró su propósito sin interpretar esa pregunta como consentimiento para iniciar una sesión. Se puede continuar la evaluación técnica sin exigirle que participe ahora.

La evidencia automática de ZA-107 cubre recorridos y errores sintéticos. La evaluación experta siguiente sirve para encontrar riesgos y preparar decisiones; no valida que otra persona descubra los mismos caminos sin ayuda.

## Sesión preparada: 25–35 minutos

Usar una candidata local o un testing autorizado con API sintética interceptada, cuenta ficticia y cero escrituras al libro del propietario. Registrar revisión exacta, navegador/OS, tamaño de ventana, tema, zoom, experiencia previa y modalidad de entrada. No pedir extractos, salario real, credenciales o grabación de audio/pantalla. Si se desea grabar, acordarlo antes; una sesión sin grabación es suficiente.

El facilitador presenta la situación, no el botón ni la ruta esperada. Inicia el cronómetro cuando la persona termina de leer; detiene al resultado confirmado, abandono o ayuda. Registrar ayuda y error recuperado aunque la tarea termine. Después pedir que explique qué pasó con el dinero y dónde volvería a consultar el resultado. No corregir durante la tarea salvo para evitar una acción real fuera de la fixture.

Los tiempos siguientes son **objetivos propuestos para orientar la revisión**, no resultados ni garantías de rendimiento. Con una sola persona se documentan hallazgos cualitativos; no extrapolar porcentajes a una población.

| ID  | Consigna neutral, con datos ficticios                                                                                                      | Resultado verificable                                                                                                                     | Objetivo orientativo                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| U1  | Desde tu panorama, registra una compra de CRC 2 500 en Alimentación.                                                                       | Encuentra el gasto desde Resumen, conserva fecha/moneda y reconoce la confirmación.                                                       | ≤90 s, sin ayuda crítica              |
| U2  | Aparta CRC 10 000 de Diario hacia Reserva, sin registrar un gasto.                                                                         | Identifica origen/destino e importe; explica que no es consumo y no necesita crear líneas contables.                                      | ≤120 s                                |
| U3  | Pega un lote con una fila incompleta y otra que quedó sin confirmación. Decide qué puedes enviar.                                          | Reconoce requisitos visibles; no reenvía la incierta sin revisar; distingue confirmadas y rechazadas.                                     | ≤180 s; ningún duplicado silencioso   |
| U4  | La conciliación muestra CRC 100 de diferencia. Averigua qué revisar antes de corregir.                                                     | Llega al historial de la cuenta/corte, entiende diferencia y no confunde investigar con ajustar.                                          | ≤120 s                                |
| U5  | Prepara mayo con ingreso ficticio de diciembre: neto USD 3 000. Cambia solo lo necesario para tus compromisos CRC y conserva libre en USD. | Identifica mes de ingreso/presupuesto, tasa del banco, dos monedas y revisión previa a sobres; no presume conversión bancaria automática. | ≤5 min en primer uso                  |
| U6  | Crea una cuenta de una institución todavía no listada. Luego prepara una categoría para un nuevo sobre.                                    | Descubre mantenimiento contextual desde Cuentas/Sobres; puede volver al borrador sin perderlo.                                            | ≤150 s; registrar si busca en sidebar |

Para U5 usar líneas/tasas ficticias proporcionadas por el facilitador, no copiar datos personales del chat a la sesión. El presupuesto no equivale a ejecutar cambios de moneda o pagos bancarios. Si el participante requiere explicar impuestos, pausar y simplificar la fixture; no transformar la prueba de UI en asesoría fiscal.

## Registro que debe completar el facilitador

Una fila por participante/tarea: código anónimo, revisión, inicio/fin o duración, completada/ayuda/abandono, errores, ayuda exacta, explicación del resultado, observación literal y severidad. Añadir responsable, decisión y evidencia del cambio. No inferir intención de un clic ni inventar tiempos de las trazas del agente.

Hasta observar una sesión, las seis tareas tienen estado **pendiente de observación humana**. Una limitación de disponibilidad debe seguir visible. Las métricas de carga de ZA-109 son de laboratorio y no reemplazan estos tiempos de tarea.

## Evaluación experta y decisiones contrastables

| Hallazgo/evidencia                                                                                                    | Severidad                                                       | Decisión actual y responsable                                                                                                                                     | Validación humana pendiente                                                                          |
| --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Instituciones/Categorías son mantenimiento; las pruebas de Cuentas/Sobres conservan borrador al crearlas en contexto. | P2 de descubrimiento, no un defecto demostrado en participantes | Mantener acceso contextual y en Ajustes; no devolverlas al sidebar por preferencia estética. Responsable: diseño/agente.                                          | U6: observar dónde busca la persona y si necesita ayuda. La ubicación no está validada con usuarios. |
| Transferencia tiene origen/destino/importe y resumen; pruebas comprueban líneas opuestas y recibos.                   | P1 si se confundiera con gasto                                  | Mantener el compositor guiado, sin exponer líneas contables al usuario. Responsable: web/API.                                                                     | U2: explicación correcta del resultado sin ayuda contable.                                           |
| Importación distingue confirmado, rechazo y resultado incierto; un registro de sesión no es idempotencia global.      | P1 si se repite una fila incierta                               | Conservar revisión explícita, no reintentar automáticamente ni descartar coincidencias legítimas. Responsable: web.                                               | U3: comprobar que el texto induce la decisión segura y resulta comprensible.                         |
| ZA-107 encontró recortes en móvil/texto ampliado y en columnas de tablet.                                             | P2 de legibilidad                                               | Corregidos selector/acciones de importación, mes del Resumen, distribución de catálogos y reporte vacío. Responsable: web; evidencia en `critical-regression.md`. | Revisar densidad y lectura en U1/U3/U6. No confundir ausencia de overflow con comodidad.             |
| Texto al 200 % en una ventana estrecha produce recorridos largos y títulos partidos.                                  | P3 de acabado; priorizar según tarea                            | Mantener contenido completo y controles utilizables; contrastar también con zoom nativo, que reduce el viewport efectivo. Responsable: diseño/agente.             | Revisar lectura y esfuerzo de desplazamiento; no reducir tamaño de fuente para ocultar el problema.  |
| Sin participantes observados.                                                                                         | Limitación de evidencia                                         | No declarar tasa de éxito, satisfacción o premio de diseño. Responsable: propietario y facilitador.                                                               | Sesión opcional preparada; resultados pendientes.                                                    |

No se encontraron razones para introducir otra paleta, blur decorativo o animaciones continuas. La crítica conserva un saldo protagonista, filas abiertas, separación de monedas, estado explicado con texto y jerarquía Atlántico. No se consideran aprobadas decisiones nuevas por ausencia de respuesta del propietario.

## Accesibilidad nativa y cierre

ZA-107 mantiene separadas las pruebas de texto ampliado/axe/teclado de una sesión con lector de pantalla. En esta revisión se registra aparte la comprobación de zoom nativo en ventana aislada cuando haya evidencia; no se sustituye por `deviceScaleFactor` o CSS `zoom`.

Para Narrador/NVDA/VoiceOver comprobar: lectura del saldo con moneda/signo; anuncio de campo/error; búsqueda/selección; confirmación y resultado incierto; foco al abrir/cerrar modal; retorno al historial; carga parcial sin anunciar cero. Registrar lector/versión y anuncios realmente escuchados. Una captura del árbol accesible no prueba la salida de voz. Si no se completa, dejar el alcance pendiente sin simularlo.

### Comprobación nativa realizada

Se abrió una ventana **aislada** de Chromium 156 con API sintética en loopback y se aplicaron los atajos de zoom del navegador mediante el control de Windows. La barra de Chromium confirmó 200 % y 400 %; no se alteraron CSS `zoom`, tamaño de fuente o `deviceScaleFactor` para simularlo. Ancho de contenido inicial 1427 CSS px y DPR 1,25; al 200 %, 713 px / DPR 2,5; al 400 %, 356 px / DPR 5. La ventana aislada se cerró al terminar; no se cambiaron preferencias de las ventanas del propietario.

Se midieron **11 rutas × dos temas × dos niveles = 44 combinaciones**: documento y controles de tarea dentro del ancho útil, sin overflow horizontal detectado. Datos y dimensiones en [resultado nativo](reviews/native-zoom-2026-11-22.json). Las capturas de ventana del sistema al 200/400 % se revisaron; las capturas `page.screenshot` a zoom nativo resultaron recortadas por el mecanismo de captura y se excluyen como prueba visual. Los 44 resultados acreditan geometría medida, no 44 sesiones humanas ni legibilidad subjetiva validada.

El pendiente de zoom nativo de ZA-107 queda cubierto con esta evidencia. **La escucha con lector de pantalla y las seis tareas humanas permanecen pendientes.** El árbol UI Automation mostró nombres, roles y regiones de la página, pero no se presenta como un ensayo de Narrador/NVDA/VoiceOver.

El ticket puede registrar protocolo y evaluación experta aunque falten participantes, como contempla su primer criterio. La afirmación «validado con el propietario» y el cierre del alcance humano de ZA-107 solo proceden después de la sesión real. La preparación de entrega y mediciones de laboratorio están en `release-readiness.md`.
