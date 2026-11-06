# Atlántico: composiciones completas de Sobres — ZA-111

## Estado y revisión

La referencia interactiva está en `/design-reference`, fuera de la navegación financiera. Permite comparar **A · Marea** y **B · Faro**, cambiar de cuenta y revisar datos completos, saldo pendiente, vacío, carga y error. El tema se cambia con el control de apariencia existente. Toda la información es ficticia; los controles abren muestras locales y no consultan la API, guardan movimientos o alteran cuentas.

**Referencia elegida por el propietario: A · Marea**, el 4 de noviembre de 2026. Después de revisar las propuestas, respondió «Marea: saldo protagonista y filas abiertas (recomendada)». No indicó ajustes adicionales en esa respuesta. Faro se conserva para comparación; no se atribuye al propietario una preferencia por sus grupos, superficies u otros elementos. La implementación integral por módulo sigue en sus tickets.

Accesos directos: `/design-reference?variant=marea` y `/design-reference?variant=faro`.

La ruta tiene `noindex`, que no constituye autenticación ni la hace privada. No se cargan datos de usuarios, claves o bases. No incorpora dependencias, imágenes, fuentes externas, efectos de desenfoque o animaciones decorativas. Las muestras no sustituyen los flujos reales de ZA-90/91/102.

## Dos composiciones con una misma información

| Composición | Distribución de atención                                                                               | Aplicación del color                                                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marea       | Saldo protagonista y distribución junto a él en escritorio; lista abierta y panel lateral de revisión. | Cobalto profundo en el saldo, turquesa en contexto explicativo y superficies neutras en los datos. Las ondas son trazos SVG tenues, decorativos y estáticos.     |
| Faro        | Saldo en una columna lateral; sobres agrupados por propósito en una columna editorial más amplia.      | Saldo sobre un plano turquesa, distribución sobre un plano cobalto tenue y filas de lectura abiertas. No es un cambio del color del botón sobre el mismo cuerpo. |

Ambas muestran cuenta e institución, moneda explícita, saldo completo, siete sobres, distribución, negativos y acciones. Las columnas dependen del espacio disponible mediante una consulta de contenedor; en móvil y con texto ampliado pasan a un recorrido vertical. La página de revisión mantiene el shell de ZA-84; el cambio de neutros propuesto se acota al contenido de referencia.

La comparación previa se captura sobre la ruta **actual `/envelopes`**, con la misma fixture que alimenta las propuestas; no se reconstruye ni se presenta una imagen vieja con otros importes como evidencia. `e2e/design-reference.spec.ts` genera el antes y las dos propuestas en 360/390/1440 px y ambos temas. Evidencia del workspace en `auditoria-uiux-2026-11-04/ZA-111`.

## Roles de superficies y acentos

Los neutros aprobados se centralizan en `app/globals.css` como `--marea-*`; la referencia usa alias en `components/design-reference/study.module.css`, conservando los mismos valores y apariencia. `.marea-surface` permite su adopción acotada por módulo; ZA-91 la aplica al diálogo de ingresos/gastos, ZA-88 a la ficha de cada movimiento y ZA-106 al historial con filas abiertas y densidad adaptable. ZA-94 reutiliza estos neutros en la [conciliación guiada](reconciliation-review.md), sin modificar la paleta global. Los demás roles de la referencia continúan acotados a ella. Complementan [ZA-83](design-system.md): no son una autorización para introducir paletas por módulo ni sustituir globalmente las pantallas anteriores.

| Rol                    | Uso                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `ground`               | Lienzo neutro gris claro; carbón `#121417` en oscuro. Da aire entre áreas sin encerrarlas en tarjetas equivalentes.              |
| `surface`              | Información que merece un plano propio: distribución o revisión. Blanco en claro y carbón elevado `#1d2025` en oscuro.           |
| `raised`               | Tercer plano, detalle y carga. `#292d33` en oscuro, sin teñir todas las capas de azul.                                           |
| `ink` / `muted`        | Jerarquía tipográfica legible; el texto secundario no depende de opacidad arbitraria.                                            |
| `brand` / `brand-soft` | Cobalto para acción y distribución, o como plano protagonista. No significa ingreso, suficiencia ni categoría.                   |
| `teal` / `teal-ink`    | Turquesa contenido para saldo o explicación según la composición. El texto usa un tono oscuro en claro y uno luminoso en oscuro. |
| `negative`             | Error financiero real, con signo y texto «saldo negativo». No se usa para decoración ni se sustituye por turquesa.               |
| `control` / `focus`    | Bordes de controles y foco visible. Sobre el protagonista cobalto el foco es blanco para conservar contraste.                    |

Receta: un protagonista financiero; una distribución con denominador explícito; datos en filas con divisores; atención justificada por los datos; un contexto secundario con color. Conservar áreas de interacción de 44 px, cifras tabulares, moneda y foco. No colorear cada sobre o institución con un tono distinto ni repetir tarjetas para cada cifra.

## Significado financiero

La fixture compartida vive en `lib/design-reference.ts`, utilizada también por el transporte sintético del antes. Cuenta CRC: saldo de sobres **897 500,00**, incluyendo **−9 000,00** de Suscripciones y un sobre sin saldo. Los sobres positivos suman **906 500,00**. Las barras y porcentajes describen exclusivamente esa distribución positiva, no metas o salud financiera. El aviso negativo aparece junto al saldo y enlaza a su revisión.

La cuenta USD tiene **5 151,00** y dos sobres propios; cambiar de cuenta cambia el contexto completo. No se consolidan monedas ni se inventan tasas. Un saldo pendiente convierte el total y la distribución en «Por confirmar»; los negativos conocidos siguen visibles. Error y carga no equivalen a cero; un vacío confirmado sí puede mostrar cero con el siguiente paso para vincular una categoría.

La aritmética usa los helpers existentes de dinero. No hay cambios de contrato, esquema, SQLite, historia o política financiera. El escenario visual de datos pendientes propone su presentación; el tratamiento integral de la pantalla real corresponde a ZA-102.

## Verificación y adopción

Las pruebas de la referencia revisan geometría y controles con texto 100/200 %, Arial/Verdana adicionales en móvil, axe AA, foco de los diálogos, Escape/retorno de foco, reducción de movimiento y ausencia de peticiones a `/api`. Las comprobaciones automáticas complementan la crítica visual; no equivalen a una sesión manual con lector de pantalla o a pruebas de zoom nativo.

Ejecutar formato, lint, tipos, unitarias, build y `npm run test:e2e`. La matriz y resultados finales se registran en la evidencia del ticket. La validación del texto sobre el degradado debe incluir los fondos y trazos decorativos que puedan quedar detrás, no solo el color sólido inicial.

Adopción de Marea: conservar el saldo como protagonista cobalto, filas abiertas con divisores, turquesa como contexto secundario y una revisión explícita de negativos. Integrar sus roles en el sistema común al adoptar por pantalla en ZA-99, ZA-102, ZA-103 y ZA-104. ZA-108 conserva la validación transversal. Mantener móvil, semántica y tareas al adaptar cada módulo; no copiar ciegamente proporciones o textos del ejemplo. Las agrupaciones de Faro son una alternativa comparativa, no una decisión aprobada para incorporar automáticamente.

## Registro del propietario

ZA-102 adopta Marea en las rutas reales [Cuentas y Sobres](accounts-envelopes.md), con datos de la API existente, saldo protagonista, filas abiertas y contexto turquesa. Sus roles turquesa aprobados se centralizan como `--marea-teal` / `--marea-teal-ink` en globals.css; la referencia los consume mediante alias, conservando exactamente sus colores claros/oscuros. `/design-reference` permanece ficticia. La evidencia original de ZA-111 del 4 de noviembre se conserva como historia; la regresión de la ruta actual usa la misma fixture y etiqueta sus capturas como actuales, sin presentarlas como la UI anterior a la adopción.

| Fecha      | Comentario                                                                                         | Decisión                                                    |
| ---------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 2026-11-03 | La interfaz se siente más elegante, pero demasiado blanca en claro y uniformemente azul en oscuro. | Elaborar dos composiciones completas dentro de Atlántico.   |
| 2026-11-04 | «Marea: saldo protagonista y filas abiertas (recomendada)». No añadió otros ajustes.               | Marea elegida como referencia; Faro queda para comparación. |

Cambios de esta entrega solo en web, rama `staging`. Backend y bases intactos; no se despliega testing por este ticket.
