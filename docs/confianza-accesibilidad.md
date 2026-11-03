# Confianza financiera y accesibilidad — ZA-79

Esta entrega completa los pendientes de contraste (ZA-86), controles y errores accesibles (ZA-87), cotización (ZA-92), navegación móvil (ZA-93) e idioma (ZA-98). Fechas locales, encabezado móvil y estados de sobres ya estaban resueltos en ZA-85, ZA-78 y ZA-89. El trabajo se integra en staging de web y API; las imágenes se promueven a testing por bloques.

## Lenguaje del producto

La experiencia se presenta en español con convenciones es-CR. Los textos son estáticos en los componentes; no se añade un servicio de traducción ni se modifica el contenido que introduce el usuario. Los códigos de API, enumeraciones, rutas e identificadores de prueba conservan su identidad. Los estados internos Active/Inactive se traducen al mostrarse, no al transportarse.

| Término           | Uso                                                                                |
| ----------------- | ---------------------------------------------------------------------------------- |
| Cuenta            | Lugar donde se registra dinero, asociado a una moneda y una institución            |
| Institución       | Banco u otra entidad que agrupa cuentas; se administra desde Ajustes               |
| Categoría         | Clasificación principal o subcategoría del dinero                                  |
| Sobre             | Distribución del saldo de una cuenta vinculada a una categoría                     |
| Movimiento        | Ingreso, gasto, transferencia o ajuste con su fecha contable                       |
| Transferencia     | Movimiento entre origen y destino; conserva las validaciones monetarias existentes |
| Conciliación      | Comparación entre saldo contado y esperado de una cuenta                           |
| Mes de referencia | Período que identifica un reporte; no certifica un cierre contable                 |

El sobre positivo no se califica como suficiente por su participación porcentual. Positivo, sin saldo y negativo expresan hechos. El color acompaña texto y signo.

## Fechas e importes

- YYYY-MM-DD es una fecha contable. formatIsoDateOnly la presenta DD/MM/YYYY sin convertir zona horaria.
- El día de referencia es America/Costa_Rica. Las etiquetas Hoy/Ayer no dependen del día UTC del navegador.
- Los timestamps de SQLite se interpretan como UTC y se presentan con fecha/hora de Costa Rica mediante formatAccountingTimestamp. No se añade hora a una fecha contable.
- CRC y USD se muestran con su código explícito y las mismas convenciones decimales es-CR. El reporte PDF conserva símbolos dentro de bloques identificados por moneda y la misma convención decimal.
- Para introducir dinero, usar valores sin separadores de miles, por ejemplo 1234.56. La presentación se localiza; el contrato numérico y la precisión de la moneda se conservan. No se aceptan exponentes ni fracciones de centavo para CRC/USD. Las tasas y cantidades no se redondean desde el texto formateado.
- Los errores públicos se producen a partir de códigos y un mensaje de contexto en español. No se muestran cuerpos HTML, trazas ni respuestas crudas del servidor. Los códigos internos se conservan para el manejo del error.

El cálculo monetario, los payloads, las versiones de reglas y los snapshots no se traducen ni migran. La prueba de BHD continúa comprobando tres decimales; su expectativa de presentación usa coma decimal.

## Cotización y consolidado

La fuente configurada en ExchangeRateService es tipodecambio.paginasweb.cr. No se atribuye la respuesta directamente a un banco. Cambiar ese proveedor requiere actualizar la identificación pública y sus pruebas.

La vista muestra fecha efectiva de la respuesta, antigüedad en días y criterio de compra para CRC o venta para USD. Una cotización anterior puede usarse con su antigüedad visible. Una respuesta ausente, inválida, con tasa no positiva o con fecha futura no se usa para completar una conversión. Se conservan los saldos originales y el consolidado queda Por confirmar cuando falta información necesaria. Si no hay saldo en otra moneda, no se exige una tasa para sumar la moneda de presentación.

## Contrato de campos accesibles

AccessibleField agrupa una etiqueta visible y un control. Sus IDs de React son estables entre renderizado inicial y cliente y únicos en filas repetidas. Label, Input, Textarea y SelectTrigger comparten ese contexto; se conservan IDs y descripciones explícitos del consumidor. No se usan placeholders como sustitutos de etiquetas.

AccessibleFieldError tiene un identificador propio y role=alert. Al mostrarse, se registra como descripción del control y activa aria-invalid cuando no existe un valor explícito del consumidor. Al desaparecer, retira esa relación. Las descripciones de ayuda previas se conservan y no se duplican IDs. Para varios controles en una fila, utilizar un AccessibleField por control o proporcionar nombres específicos; un encabezado de tabla no sustituye la etiqueta de un selector.

Las acciones de cuentas, instituciones, categorías y filas indican su propósito y registro. Los selectores de importación indican número de movimiento. Los filtros, paginadores, controles de presupuesto y estados de reglas tienen nombres accesibles. Existe un único landmark main y un acceso para saltar al contenido.

## Navegación y foco

El disparador anuncia el estado móvil real. Escape cierra el panel y devuelve el foco al disparador. Elegir un destino cierra el panel y lleva el foco al contenido principal; este caso evita que la restauración de foco de Radix lo devuelva al botón anterior. La preferencia de expansión de escritorio sigue en su cookie y se conserva al recargar. El panel móvil limita su ancho al espacio disponible.

## Contraste y comprobación

Se separan colores decorativos y colores de texto. Los tonos claros de éxito/error se ajustaron porque una combinación con fondo al 20% no alcanzaba 4.5:1. Las variantes destructivas usan su foreground semántico en ambos temas, incluyendo hover. La regresión calcula luminancia sRGB y composición de fondo, sin medir píxeles antialiasados; cubre fondos card/background/popover, tintes de 0/10/20%, controles sólidos/hover y los extremos del degradado.

La suite de navegador utiliza axe en las once rutas principales, claro/oscuro, formularios de movimientos/cuentas/instituciones/categorías/conciliación/reportes y editores de Ajustes. Prueba además cotizaciones actuales/anteriores/ausentes, Escape, navegación/foco, persistencia de escritorio y error/corrección de importe mediante teclado. Se conserva el árbol accesible del formulario para comprobar nombre, valor y descripción de error. Estas comprobaciones no representan una certificación integral de accesibilidad ni reemplazan la revisión con personas que usan tecnologías de asistencia del programa de QA.

## Reproducción

```sh
npm ci
npx playwright install --with-deps --only-shell chromium
npm run format:check
npm run lint
npm run typecheck
npm run test:ci
npm run build
npm run test:e2e
```

Las pruebas arrancan su servidor exclusivo en 127.0.0.1:3212 y sustituyen toda API por datos sintéticos. No necesitan backend ni SQLite para la revisión visual. Los recursos externos y la analítica se bloquean. Los artefactos quedan fuera de Git, ESLint, Prettier y Docker. GitHub conserva el reporte durante siete días y exige quality antes de publicar la imagen.

Referencias: [contraste mínimo de W3C](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [notificación de errores de W3C](https://www.w3.org/WAI/tutorials/forms/notifications/).
