# Ajustes y catálogos Marea — ZA-103

Implementación local del 6 de noviembre de 2026 en `staging`, sin publicar ni desplegar. Continúa ZA-83/84 y la composición Marea de ZA-111: cobalto protagonista, filas abiertas, contexto turquesa y superficies carbón en oscuro.

## Recorrido

Ajustes tiene seis secciones: Perfil y preferencias, Instituciones, Categorías, Efectivo, Nómina y Automatización. Los catálogos permanecen bajo Ajustes, sin duplicar destinos en el sidebar.

- `/settings` abre el perfil; `?section=cash`, `payroll` o `rules` enlaza directamente a otra sección. Admite teclado y abrir en otra pestaña. Las secciones ya visitadas conservan sus borradores en memoria al navegar dentro de Ajustes; Efectivo y Nómina se montan solo cuando se visitan.
- `/institutions` conserva su URL. Busca por nombre, tipo o estado y muestra un detalle con cuentas activas confirmadas y restricciones. Las entidades inactivas no ofrecen una activación ficticia: ese contrato no existe en la API actual.
- `/categories` conserva su URL. Muestra categorías activas y grupos contraíbles. Buscar ignora acentos y consulta toda la ruta, aunque un ancestro esté contraído. Los resultados conservan la ascendencia. Relaciones históricas huérfanas/cíclicas permanecen visibles como «Relación por revisar», sin corregir datos.
- Cuentas enlaza a Instituciones con regreso a Cuentas; Sobres enlaza a Categorías con regreso a Sobres; Presupuestos regresa a su lista. `returnTo` admite solo `/settings`, `/accounts`, `/envelopes` y `/budgets`; cualquier otro valor usa Ajustes. No acepta URL externas ni parámetros arbitrarios. El regreso conserva el destino, no formularios entre páginas distintas. Para conservar un borrador de cuenta/sobre sigue disponible la creación integrada de ZA-102.

## Restricciones y confirmaciones

Editar/desactivar tienen nombres accesibles. Cerrar un diálogo devuelve el foco al control de origen, o al contenido principal si desapareció.

Instituciones consulta catálogo y cuentas por separado. Si no se verifican las dependencias, muestra «por confirmar», nunca cero; permite consultar/editar pero bloquea desactivar. La API vuelve a comprobar las cuentas activas.

Categorías excluye la propia categoría y sus descendientes del selector de padre. Un padre con hijos activos conserva su nivel y no puede desactivarse. El diálogo explica también el bloqueo por sobres activos, que comprueba la API. Los errores de negocio permanecen visibles. Los controles de UI no sustituyen validaciones/autorización del servidor ni saneamientos históricos.

Los guardados de catálogo bloquean envíos simultáneos y cambios/cierre durante la petición. Solo desactivaciones documentadas aceptan `204`; crear/editar requiere un registro válido con ID seguro. Una confirmación perdida o incompleta conserva el formulario y bloquea repetir. El usuario debe cerrar y actualizar para revisar el estado antes de operar de nuevo. No añade idempotencia al servidor ni garantiza que una petición incierta no se aplicara. Nunca se inventa un ID. Los mensajes pasan por el traductor público, sin exponer excepciones internas.

## Automatización y carga

Cada regla muestra patrón, coincidencia en español, cuenta/sobre de destino, prioridad y estado. El número menor tiene precedencia; la API desempata por actualización más reciente e identificador ascendente. La web presenta la regla elegida por el servidor. Las prioridades fraccionarias no se truncan con `parseInt`.

El probador envía exclusivamente `POST /auto-assignment-rules/test` con descripción y usuario del contrato vigente. Ese endpoint consulta y simula: no crea movimientos ni modifica asignaciones. El resultado identifica descripción probada, regla, destino y prioridad. Cambiar la descripción, guardar/cambiar una regla o recargar reglas invalida el resultado. Se descartan respuestas tardías de una descripción anterior; un fallo no conserva una coincidencia anterior como actual.

Perfil, cuentas y reglas cargan en paralelo con errores por sección. Un fallo de automatización deja accesible el perfil. Actualizar no sobrescribe un borrador de perfil editado. Las peticiones están acotadas a 15 segundos, sin reintentos automáticos de escritura. Catálogos usan lecturas abortables, contratos validados y rechazo de duplicados. Una respuesta corrupta/fallida no representa vacío; el `404 NOT_FOUND` de los listados antiguos sí lo representa.

Se reutilizan las validaciones existentes de denominaciones (valor positivo, precisión y orden entero) y nómina versionada (tasas, vigencias y tramos). Los cambios en esos módulos son de composición y adaptación a texto ampliado; no alteran cálculos ni reglas fiscales. Las tasas almacenadas no se presentan como verificación normativa actual.

## Verificación y entrega

`tests/settings-catalog.test.ts` cubre contratos, regreso seguro, búsqueda, ciclos/huérfanas, padres válidos, dependencias desconocidas, confirmaciones y prioridades. `e2e/settings-catalogs.spec.ts` usa transporte sintético con una lista explícita de operaciones de metadatos; cualquier escritura financiera inesperada falla. Comprueba recorridos, conflictos, guardados inciertos, foco, borradores, validaciones y probador sin escrituras adicionales.

La matriz visual/axe cubre 390/1440 px, claro/oscuro y texto al 100/200 %. Añade editores al 200 % y perfil/efectivo/nómina en móvil oscuro con fuente alternativa. La evidencia queda en `operaciones/ZA-103/` del workspace, fuera de los repositorios. Ejecutar formato, lint, tipos, unitarias, build y regresiones de navegación/diálogos y Cuentas/Sobres. Axe y ampliación de texto no equivalen a una sesión manual con lector de pantalla ni a zoom nativo.

Solo cambia la web: sin endpoints, tablas, migraciones, recálculos ni variables nuevas. No modifica la API ni usa bases reales en las pruebas. La próxima entrega sigue la [guía de staging](staging.md) y la guía operativa de la API. ZA-103 no acredita un despliegue nuevo ni exige preparar DB; siguen vigentes los requisitos acumulados de otros tickets, incluido ZA-99. Publicación y deploy quedan para una solicitud separada del propietario.
