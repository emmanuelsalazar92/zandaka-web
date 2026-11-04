# Navegación por tareas y encabezados — ZA-84

La navegación principal sigue el trabajo habitual: Resumen, Movimientos, Cuentas, Sobres, Conciliación, Presupuestos y Reportes. Ajustes permanece separado al final. Instituciones y Categorías son catálogos de apoyo: se administran desde Ajustes y se encuentran también junto a las tareas que los necesitan.

## Rutas y contexto

`lib/navigation.ts` define destinos, accesos relacionados y resolución de contexto. Las coincidencias respetan límites de segmentos: `/accounts-extra` no activa Cuentas y una ruta desconocida no se presenta como Resumen.

| Ruta existente                              | Destino activo | Acceso contextual                                                |
| ------------------------------------------- | -------------- | ---------------------------------------------------------------- |
| `/`                                         | Resumen        | Nuevo movimiento e importar                                      |
| `/transactions`, `/transactions/import`     | Movimientos    | Importar conserva regreso a Movimientos                          |
| `/accounts`                                 | Cuentas        | Gestionar instituciones                                          |
| `/envelopes`                                | Sobres         | Gestionar categorías, incluso sin cuentas o con error de carga   |
| `/reconciliation`                           | Conciliación   | Selector de cuenta y nueva conciliación                          |
| `/budgets`, `/budgets/:id`                  | Presupuestos   | Gestionar categorías; el detalle conserva regreso a Presupuestos |
| `/reports`                                  | Reportes       | Generar reporte                                                  |
| `/settings`, `/institutions`, `/categories` | Ajustes        | Catálogos conservan sus URLs y regreso directo a Ajustes         |

`aria-current="page"` identifica la URL exacta; `aria-current="location"` comunica el destino que contiene una subpantalla. Los iconos se asignan por ruta, evitando que una inserción en el menú cambie el icono de otros destinos. Los accesos relacionados y las tarjetas de Ajustes consumen las mismas constantes de ruta.

No se agregan redirecciones, parámetros arbitrarios de retorno ni nuevos permisos. No se eliminan funciones, controles de desactivación o enlaces existentes. Los botones y validaciones financieras conservan sus callbacks y restricciones.

## Un encabezado de tarea

`components/page-header.tsx` define el patrón compartido: un `h1`, descripción, metadatos opcionales, navegación relacionada y grupo de acciones. Se utiliza en las pantallas financieras, los catálogos, la importación y el detalle de presupuesto. La galería de diseño conserva su composición propia y su único `h1`.

La barra superior contiene herramientas y, en subpantallas, un enlace al destino padre. Deja de repetir el título actual. En móvil, ese regreso tiene una fila propia para que la ampliación de texto no lo comprima entre los iconos. La cabecera principal crece con el texto y permite envolver acciones; no usa recortes ni alturas rígidas para ocultar desbordamientos.

Los selectores de los encabezados limitan su ancho al área disponible. Los enlaces de gestión tienen foco visible y objetivo cómodo. Los encabezados de Sobres, Conciliación, Ajustes y detalle de presupuesto permanecen durante carga, error y estados vacíos; los controles que requieren datos se muestran cuando corresponde. Una indisponibilidad temporal no elimina el contexto de navegación.

Para una nueva pantalla, usar `PageHeader` y sus slots. No añadir otro título en el shell ni poner el contenido completo de la página en el slot de acciones. `related` corresponde a destinos secundarios; las operaciones principales van en `children`. El componente presenta información y no gestiona peticiones ni modifica datos.

## Teclado y móvil

El menú móvil mantiene los siete destinos y Ajustes, cierre con Escape, foco de regreso al disparador y cierre al navegar. El destino elegido enfoca `main#main-content`; el enlace «Saltar al contenido» evita recorrer el menú en cada página. La preferencia de colapso de escritorio permanece independiente del estado móvil.

Las etiquetas del menú pueden ocupar varias líneas cuando el texto aumenta. El contenido del menú se desplaza dentro de su panel; Ajustes sigue disponible al final. Los nombres accesibles permanecen completos cuando el menú de escritorio muestra solo iconos.

## Validación reproducible

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run test:ci
npm run build
npm run test:e2e
```

- Pruebas unitarias de rutas exactas, subpantallas, catálogos y prefijos similares.
- Matriz de las doce rutas de tarea a 360/390/1440 px, claro/oscuro y texto 100/200 %. Incluye la barra de herramientas, título único y geometría de acciones; a 360 px y texto 200 % agrega Arial y Verdana.
- Recorridos de teclado desde Cuentas, Sobres y Presupuestos hacia sus catálogos, regreso a Ajustes, destino activo y menú ampliado.
- Acceso a categorías con cuentas vacías, error de servidor y petición pendiente.
- Se conservan las regresiones de accesibilidad y Movimientos. Su control negativo sigue recreando un encabezado sin ajuste de línea y debe detectar la acción fuera del ancho útil, también tras introducir el contenedor compartido.

Playwright inicia un servidor Next de producción propio en `127.0.0.1:3212` y bloquea toda API real con datos sintéticos, incluidos el presupuesto y sus estados. No se usa la copia SQLite ni el sitio de testing. Ampliar el tamaño raíz del texto al 200 % no equivale a una prueba de zoom nativo; los checks automáticos no sustituyen una sesión manual con lector de pantalla o dispositivos físicos. La matriz de este ticket verifica encabezados y navegación; los rediseños completos de los flujos continúan en sus tickets.

## Entrega

Cambios en el frontend, branch `staging`. No se necesitan cambios de backend, esquema o aritmética. CI valida antes de publicar imágenes; testing se despliega por bloques conforme a lo acordado. Evidencia y capturas de este ticket en `auditoria-uiux-2026-11-03/ZA-84` del workspace de auditoría.
