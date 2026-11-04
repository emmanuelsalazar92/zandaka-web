# Staging y entregas por bloques

ZA-94 rediseña [Conciliación](reconciliation-review.md) solo en web y añade el enlace a Movimientos filtrado por cuenta/corte. Reutiliza los contratos existentes de creación, lectura, estado activo, previsualización, denominaciones e ignorar. Sin nuevos endpoints ni cambios de DB; conserva los cierres automáticos y las restricciones del backend. La preparación de ZA-90 sigue siendo independiente.

ZA-106 rediseña el [historial de Movimientos](transaction-history.md) solo en web. Reutiliza la API existente y la ficha de ZA-88; no añade endpoints ni requisitos de DB. Se conserva la compatibilidad web/API del bloque y la preparación independiente de ZA-90 cuando corresponda.

ZA-88 incorpora la [ficha completa de movimientos](transaction-detail.md) y requiere una API del mismo bloque con `GET /api/transactions/:id?userId=...`. Promover el par web/API compatible. No añade cambios de esquema ni recálculos; la preparación de DB de ZA-90 sigue siendo independiente. Con una API anterior, la ficha indica que no está disponible y conserva el historial.

**Entrada operativa: [Desplegar un bloque en testing](https://github.com/emmanuelsalazar92/zandaka-api/blob/staging/docs/deploy-testing.md), en `zandaka-api/docs/deploy-testing.md` del workspace. Incluye la preparación de DB de ZA-90 que debe acompañar a las imágenes web/API.**

Hay dos repositorios y dos imágenes: zandaka-web y zandaka-api. Ambos trabajan en la rama staging. Esta rama parte de las correcciones de precisión monetaria ya presentes; no deben perderse al integrar el rediseño.

## Integración continua

CI se ejecuta para pull requests, pushes a main/staging, etiquetas de versión y ejecución manual. Primero pasan formato, lint, tipos, tests y build. La publicación de la imagen es un trabajo dependiente de quality y reutiliza docker-image.yml. El workflow reutilizable no se ejecuta por separado en cada push.

Las imágenes se publican en GHCR para linux/amd64 y linux/arm64. Un push válido a staging produce la etiqueta staging y una etiqueta sha-. latest queda reservada a main. Publicar una imagen no despliega la aplicación.

- Web: ghcr.io/emmanuelsalazar92/zandaka-web:staging
- API: ghcr.io/emmanuelsalazar92/zandaka-api:staging

Para una entrega reproducible a testing, registrar las etiquetas SHA y preferiblemente los digests exactos de ambas imágenes. No usar latest para probar staging ni confundir la etiqueta móvil staging con un identificador inmutable.

## Cadencia de testing

El propietario decide X tickets por entrega. No se despliega por ticket. Cada bloque debe documentar:

1. Tickets incluidos y alcance pendiente.
2. Commit web y commit API; compatibilidad del contrato.
3. Resultado de checks y revisión de escritorio/móvil.
4. Referencias de imágenes publicadas por GitHub y digests.
5. Variables de entorno necesarias, verificación de salud y recorrido funcional.
6. Par anterior de imágenes para revertir la entrega.

La primera entrega introduce GET /api/reports/:id/html, por lo que web y API se promueven como un par compatible. API_INTERNAL_URL apunta a la API en la red interna del despliegue, no a la IP del navegador. No incorporar credenciales, bases reales ni textos bancarios al contexto de construcción o a documentación.

## Comprobaciones locales

Ejecutar npm run format:check, npm run lint, npm run typecheck, npm run test:ci y npm run build. Después del build, ejecutar npm run test:e2e con el navegador de Playwright instalado; esta suite arranca su propio servidor aislado y se explica en [ZA-78](za-78-layout.md). La prueba visual local adicional puede apuntar a scripts/start-atlantico-preview.cjs de la API, que crea datos sintéticos y escucha solo en 127.0.0.1:3210. Arrancar Next con API_INTERNAL_URL=http://127.0.0.1:3210 y puerto 3211.

El cambio de UI no requiere migración de dinero ni modificación de snapshots. No ejecutar scripts de saneamiento histórico o migraciones como parte implícita de un despliegue visual.

## Transferencias guiadas — ZA-90

El compositor requiere una imagen API con POST /api/transfers y su tabla auxiliar transfer_request preparada explícitamente en la base de testing. Consultar docs/transfers.md en ambos repositorios para el comando y el procedimiento del bloque. No existe fallback al guardado anterior sin idempotencia. El endpoint rechaza antes de escribir si falta la preparación. Conservar la pareja de imágenes y las confirmaciones al revertir.

## Ingresos y gastos — ZA-91

El nuevo formulario usa el contrato existente POST /api/transactions. No requiere preparación de DB ni una API adicional. El despliegue sigue siendo por bloques; la preparación de ZA-90 continúa vigente cuando esté incluido. Ver [comportamiento y límites de confirmación](movement-entry.md).
