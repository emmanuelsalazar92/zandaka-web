# Atlántico: sistema visual y galería — ZA-83

La galería está en `/design-system`. Es una ruta de revisión, enlazada desde esta documentación y fuera de la navegación financiera. No requiere API, no carga información de usuarios y no escribe datos. Sus importes y formularios son sintéticos; sus controles solo cambian estado local o muestran notificaciones. Tiene `noindex`; eso no sustituye autenticación ni convierte la ruta en privada.

## Dirección visual

La decisión aprobada es **Atlántico**: cobalto dominante, profundidad azul y un acento turquesa. Se inspira en claridad, jerarquía, precisión y cuidado de interacción; mantiene identidad propia de Zandaka. No se distribuyen tipografías ni recursos de Apple.

Un bloque protagonista por composición. Los datos viven en superficies tranquilas, con espacio y alineación; una tarjeta debe agrupar una tarea o información relacionada, no envolver cada cifra. Los reportes conservan la misma jerarquía. La muestra de la galería ilustra presentación, no representa un snapshot ni cambia el PDF del backend.

El color decorativo no significa ingreso, gasto o disponibilidad. Los saldos conservan moneda explícita, signo y números tabulares. Estados financieros usan texto e iconos además de color. No se asigna un color diferente a cada institución, categoría o sobre.

## Fuente de tokens

`app/globals.css` es la definición del sistema web. `:root` define el tema claro y `.dark` sustituye superficies, texto y colores semánticos. `@theme inline` los expone a Tailwind. No crear hexadecimales ni una paleta paralela en cada pantalla.

| Familia      | Contrato                                                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Superficies  | `background`, `card`, `popover`, sus `foreground`, `border`                                                                               |
| Acción       | `primary`, `secondary`, `accent`, `ring` y sus textos asociados                                                                           |
| Significado  | `success`, `warning`, `error`, `destructive`; texto semántico sobre superficie neutra o tinte de hasta 20 %                               |
| Presentación | `brand-deep`, `brand-turquoise`, `hero-*`; el bloque protagonista conserva fondos y textos contrastados en ambos temas                    |
| Tipografía   | Fuentes del sistema; escala rem de Tailwind; `type-display`, `type-amount`, `type-tracking-display` para titulares y cifras protagonistas |
| Espacio      | `space-unit` = 0.25 rem, consumido por la escala de utilidades; espaciado funcional antes que cajas anidadas                              |
| Geometría    | `radius` y derivados sm/md/lg/xl/hero; evitar radios diferentes por pantalla                                                              |
| Controles    | `control-height` 2.75 rem, `control-compact` 2.25 rem, `control-large` 3 rem; alturas mínimas para permitir varias líneas                 |
| Límites      | `control-border` distingue un campo del fondo sin depender solo del placeholder                                                           |
| Elevación    | `elevation-surface`, `elevation-overlay` → `shadow-surface`, `shadow-overlay`; intensidad adaptada al tema                                |
| Movimiento   | `motion-fast` 140 ms, `motion-enter` 220 ms, `motion-ease`; `prefers-reduced-motion` reduce animaciones y transiciones                    |

La variante compacta corresponde a controles de densidad secundaria. Para acciones principales o iconos independientes, usar el tamaño estándar de 44 px a escala normal. Checkbox y switch tienen al menos 24 px de alto, con etiqueta asociada que también activa el control. No reducir áreas interactivas para lograr una composición más limpia.

## Contratos de componentes

| Componente                           | Uso y estados                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                             | Principal, secondary, outline, ghost, link y destructive. Hover y foco reales, disabled nativo. `loading` en botones nativos conserva el nombre, muestra indicador decorativo, establece `aria-busy` y bloquea activación repetida. Mantener el estado durante toda la petición y manejar errores en el llamador. `asChild` conserva semántica de enlace; no usar loading/disabled para simular enlaces deshabilitados.                                                                 |
| `Input`, `Textarea`, `SelectTrigger` | Etiqueta visible; normal, foco, disabled y `aria-invalid`. Fondo y borde compartidos. No sustituir la etiqueta por placeholder.                                                                                                                                                                                                                                                                                                                                                         |
| `SearchableSelect`                   | Selección única controlada sobre Radix Popover y cmdk, sin dependencias nuevas. `value` único y estable por opción; `label` visible puede repetirse. Enter/Espacio/Flecha abajo abren, escribir filtra, flechas/Enter eligen, Escape cancela; devuelve foco al botón. Incluye opciones disabled, lista vacía y loading; `name` agrega un campo oculto opcional. La búsqueda es local sobre opciones ya entregadas; no es búsqueda remota ni carga todo un catálogo desde el componente. |
| `AccessibleField`                    | Un label y un control por contenedor. `Label` y control consumen el ID compartido. `AccessibleFieldError` añade `aria-invalid`, asocia el mensaje y lo retira al corregir. Con IDs explícitos, asociar también `htmlFor` explícito. Usar `aria-describedby` para ayudas persistentes y mensajes adicionales.                                                                                                                                                                            |
| `Checkbox`, `Switch`                 | Conservan semántica y teclado Radix, etiqueta asociada, estado checked/unchecked/disabled y foco visible.                                                                                                                                                                                                                                                                                                                                                                               |
| `Badge`                              | Default, secondary, outline, destructive, success, warning y error. Complementa una palabra de estado; no convertirlo en botón sin semántica interactiva.                                                                                                                                                                                                                                                                                                                               |
| `Table`                              | Encabezados con `scope`, caption contextual, montos alineados a la derecha con `tabular-nums`. El contenedor permite desplazamiento horizontal con teclado. El documento no debe desbordarse. En listas simples usar filas y divisores, sin una tarjeta por celda.                                                                                                                                                                                                                      |
| `Dialog`, `Sheet`, `Drawer`          | Título y descripción obligatorios en consumidores. Modalidad y retorno de foco conservados; Escape cierra. Contenido desplazable en pantallas bajas. El cierre tiene nombre accesible y tamaño cómodo.                                                                                                                                                                                                                                                                                  |
| `Toast` / `useToast`                 | Confirmaciones breves, cierre visible con nombre y colores de tokens. Los errores que requieren acción deben permanecer también junto a la tarea; no depender solo de una notificación temporal. Se mantiene el proveedor Radix existente.                                                                                                                                                                                                                                              |
| `Feedback`                           | info/success/warning/error, icono decorativo y texto explícito. Status para información, alert para error; en listados históricos estáticos puede sobrescribirse `role` para evitar anuncios innecesarios.                                                                                                                                                                                                                                                                              |
| `LoadingState`, `EmptyState`         | Carga con texto accesible; estado vacío con motivo y siguiente acción opcional. Un dato no disponible nunca se presenta como cero.                                                                                                                                                                                                                                                                                                                                                      |
| `Card`, `Popover`                    | Superficies y elevación comunes; padding adaptable y radios del sistema.                                                                                                                                                                                                                                                                                                                                                                                                                |

La galería cubre los componentes financieros compartidos de este alcance, no cada primitiva auxiliar de la plantilla original. Los flujos completos, selección de cuenta en movimientos y navegación contextual se completan en sus tickets; esta entrega deja componentes reutilizables para ellos.

## Revisión reproducible

```powershell
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test:ci
npm run build
npm run test:e2e
```

Playwright usa un servidor de producción propio en `127.0.0.1:3212`, datos sintéticos y aislamiento de red. No reutiliza el testing. La galería se prueba a 360 y 1440 px, claro/oscuro, texto al 100 y 200 %. Esto es ampliación de texto, no una afirmación de pruebas de zoom nativo del navegador.

Las pruebas verifican geometría, axe, búsqueda vacía y opción deshabilitada, selección por teclado, error asociado, recuperación, foco confinado en los tres modales, Escape, retorno de foco y cierre de notificación. La regresión de Movimientos y las auditorías de las otras pantallas siguen dentro de la misma suite. Las pruebas unitarias mantienen el contrato monetario y verifican que una acción en carga no se reactive.

El contraste se comprueba con tokens y con DOM renderizado. Las fuentes del sistema varían entre plataformas. En grids de una columna usar tracks con mínimo cero (`grid-cols-1`), permitir que los elementos se contraigan y que los textos largos se partan; no resolver desbordamientos ocultando el documento. La matriz incluye dos fuentes alternativas (Arial y Verdana) a texto ampliado para cubrir esas diferencias. Los controles disabled se muestran como tales; WCAG no exige contraste de texto inactivo. El tinte semántico no debe superar el rango probado. Revisar visualmente hover, foco y textos largos al extender variantes. Las comprobaciones automáticas no sustituyen una sesión con lector de pantalla ni una revisión humana de los próximos flujos.

## Entrega

ZA-91 adopta los neutros aprobados de Marea mediante `--marea-*` y `.marea-surface`, de forma acotada al formulario de ingresos/gastos. ZA-88 los reutiliza en la [ficha completa de movimientos](transaction-detail.md), con resumen cobalto y líneas abiertas. La referencia comparte esos valores sin cambiar su apariencia. Ver [registro de movimientos](movement-entry.md) para búsquedas, recientes, validación y guardado.

ZA-111 complementa estos componentes con [dos composiciones completas de Sobres](atlantico-composition.md), revisables en `/design-reference`. El propietario eligió Marea el 4 de noviembre de 2026. Sus roles se acotan a la referencia y se adoptarán por módulo siguiendo la guía, sin sustituir globalmente los tokens de esta entrega.

Cambios solo en `zandaka-web`, branch `staging`. No hay cambios de esquema, aritmética, permisos ni endpoints del backend. CI y publicación de imágenes siguen el flujo de staging existente; el deploy de testing se decide por bloque. Evidencia de esta entrega en `auditoria-uiux-2026-11-03/ZA-83` del workspace de auditoría.
