# Atlántico: fundamentos de experiencia

Dirección elegida por el propietario: Atlántico. Referencias de trabajo: ZA-77, ZA-83 y ZA-84. Este documento describe la primera entrega implementada; no declara terminado el backlog completo.

## Identidad y jerarquía

El saldo y su significado tienen prioridad. Cobalto #245BDB, profundidad #102B57 y turquesa #16B8AE constituyen la familia de marca. El turquesa aporta energía a superficies y énfasis; no se utiliza indiscriminadamente como texto. Los tokens viven en app/globals.css y tienen variantes claras y oscuras. Las cifras alineadas usan números tabulares. La tipografía usa fuentes del sistema, sin descargas externas ni distribución de fuentes de Apple.

Los tokens semánticos son independientes: positivo, advertencia y error deben conservar contraste y acompañarse de texto o signo. Los gráficos emplean una familia cromática contenida. El bloque protagonista usa un degradado de profundidad y cobalto, con una zona turquesa controlada. Las superficies de datos mantienen lectura estable.

El componente de tema utiliza next-themes. Sus iconos se seleccionan mediante CSS para que servidor y cliente produzcan la misma estructura; usar resolvedTheme en el marcado inicial provoca errores de hidratación. El tema del sistema se respeta como valor inicial y el usuario puede elegir otra apariencia.

## Navegación

El primer nivel presenta Resumen, Movimientos, Cuentas, Sobres, Conciliación, Presupuestos y Reportes. Ajustes se mantiene separado al final. Instituciones y Categorías conservan sus rutas y se encuentran desde Ajustes. Cuentas enlaza al mantenimiento de instituciones.

En móvil, elegir un destino cierra el panel. aria-expanded utiliza openMobile y no el estado del sidebar de escritorio. Se conserva la preferencia del sidebar de escritorio. El enlace Saltar al contenido y el punto de foco main-content permiten evitar recorridos repetidos.

## Fechas y dinero

getAccountingDate centraliza el día contable en America/Costa_Rica y construye YYYY-MM-DD con formatToParts, sin pasar por toISOString. Se utiliza en movimientos, conciliación, nómina y períodos iniciales de presupuestos/reportes. Las fechas contables se muestran como fechas; los timestamps de captura/generación se interpretan por separado.

La consolidación del Resumen utiliza la aritmética monetaria existente. Si falta un saldo o una conversión necesaria, muestra Por confirmar, no un subtotal presentado como completo. Los errores de las fuentes no se interpretan como saldo cero ni ausencia confirmada de incidencias. La cotización se identifica por su fecha efectiva y se llama Última cotización disponible.

Los estados de sobres son saldo positivo, sin saldo y saldo negativo. La participación porcentual describe distribución; no certifica suficiencia ni cumplimiento de una meta.

## Resumen y rendimiento

El Resumen ofrece acceso directo al registro y la importación, distingue saldos originales y consolidado y permite cambiar el mes de gastos. Cambiar el período consulta únicamente gastos mensuales; no recarga las ocho fuentes del panorama completo. Las solicitudes obsoletas se ignoran al cambiar de mes o desmontar la vista. No se inventan tendencias o cifras para completar gráficos.

El acceso Nuevo movimiento espera a que se cargue el contexto de cuentas antes de abrir el formulario. Los filtros y la paginación tienen nombres accesibles, y el encabezado y el pie del historial se reacomodan en móvil.

## Reportes

La previsualización usa el endpoint HTML del backend. El navegador no necesita un visor PDF y consultar una versión no inicia Chromium. La exportación PDF sigue disponible. El iframe se encuentra aislado con sandbox; abrir el informe en otra pestaña usa noopener/noreferrer. En móvil, un selector de versión sustituye el panel alto de historial. El backend debe desplegarse junto con esta versión web, pues el endpoint HTML es nuevo.

## Validación y límites de esta entrega

- Pruebas de precisión de importes y transferencias existentes se conservan; los selectores de tests se actualizan cuando cambia una etiqueta.
- Hay pruebas para los límites de medianoche de Costa Rica y para la consolidación con fuentes incompletas y ambas monedas.
- Revisar 360/390/768/1440 px, tema claro/oscuro, teclado, zoom y nombres largos.
- Los recorridos de desarrollo usan una API enlazada a localhost y una base totalmente sintética. Nunca conectar esa previsualización a la copia de producción.
- La localización completa, el nuevo compositor de transferencias, la ficha de movimientos, la importación por lotes y el rediseño completo de presupuestos siguen siendo trabajo posterior. Esta entrega no los da por finalizados.

## Referencias

- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/): referencia de jerarquía, legibilidad y cuidado, con identidad propia de Zandaka.
- [W3C, contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): verificar colores de texto sobre el fondo efectivo, incluidos degradados.
