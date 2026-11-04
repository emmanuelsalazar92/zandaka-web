# Identidad de Zandaka — Atlántico

Actualización solicitada por el propietario el 4 de noviembre de 2026. Evoluciona el cubo anterior a una caja abierta de tres planos sólidos. Conserva la idea de guardar y organizar, elimina el acento dorado y las líneas pequeñas, y adopta la paleta aprobada de Atlántico. No cambia el nombre ni «Tu dinero, con claridad.».

## Forma y color

El icono usa un lienzo cuadrado de 64 unidades con radio 16 y tres planos separados por espacio negativo. No lleva trazos finos, sombras, degradados, filtros, texto incrustado o recursos externos. La geometría es vectorial y permanece reconocible en una sola tinta.

| Elemento               | Color                                    | Referencia                    |
| ---------------------- | ---------------------------------------- | ----------------------------- |
| Fondo del icono        | Cobalto `#245bdb`                        | `--primary`, tema claro       |
| Tapa y plano izquierdo | Blanco `#ffffff`                         | `--primary-foreground`        |
| Plano derecho          | Turquesa `#9bc9ce`                       | `--chart-5`, paleta Atlántico |
| Firma de texto         | Color de primer plano de cada superficie | Tokens existentes del tema    |

Estos colores son fijos dentro del asset exportable; no representan un estado financiero. El mismo icono se usa en ambos temas. La firma del sidebar conserva la fuente del sistema, peso 600 y espaciado -0.035em, sin descargar fuentes. El nombre queda como texto real y la imagen aporta un único nombre accesible, sin repetirlo en lectores de pantalla. No se incorporan recursos de Apple.

## Archivos y reproducción

- **Fuente canónica:** `public/brand/zandaka-mark.svg`, icono en color con fondo.
- **Una tinta:** `public/brand/zandaka-symbol.svg`, los mismos tres planos con `currentColor`, sin fondo. Al insertarlo como imagen externa toma su color por defecto; para heredar el color del contenedor debe usarse inline. Conservar legibilidad entre la tinta y el fondo.
- **Navegador:** `app/icon.svg` y `app/favicon.ico` con imágenes PNG de 16, 32, 48 y 64 px. Se usa la convención de archivos de metadatos de Next; el layout no mantiene otra lista de iconos manual.
- **Pantalla de inicio:** `app/apple-icon.png`, 180 × 180, fondo opaco y sin esquinas prerredondeadas; el sistema aplica su máscara.
- **PDF/HTML del reporte:** copia idéntica del icono en color en `zandaka-api/src/assets/logo/zandaka-logo.svg`. No cambia la plantilla, el tamaño del logo, el nombre, los saldos o los snapshots.

Después de editar el SVG, desde `zandaka-web`:

```powershell
npx playwright install --only-shell chromium
node scripts/generate-brand-assets.mjs
Copy-Item -LiteralPath public/brand/zandaka-mark.svg -Destination ../zandaka-api/src/assets/logo/zandaka-logo.svg
```

El script es una operación explícita de desarrollo, no se ejecuta al iniciar la aplicación o construir la imagen. Usa Playwright ya presente en el proyecto, bloquea la red y genera los assets desde geometría local sin añadir dependencias. Deriva también la versión monocroma desde los mismos planos para evitar divergencias. Cierra el navegador incluso si falla. Confirmar el diff de ambos repositorios. No editar las imágenes o el símbolo generados a mano.

## Uso y verificación

El icono en color tiene fondo propio para funcionar sobre claro y oscuro. El sidebar lo presenta a 32 px; el SVG evita usar un favicon rasterizado como imagen de interfaz. Conservar proporciones y espacio alrededor, sin estirar, cambiar cada plano por un color distinto o incorporar sombras. La versión de una tinta sirve para impresión y contextos con una sola tinta.

Revisar 16/24/32/48/64 px, ambos temas, sidebar expandido/colapsado y navegación móvil, además del encabezado del reporte sintético. Comprobar que las rutas de iconos cargan y que el PNG de inicio es opaco. Las capturas del workspace están en `auditoria-uiux-2026-11-04/brand-atlantico`; no son datos de una cuenta real.

## Entrega

Cambios de presentación en los dos repositorios, integrados en `staging`. El backend solo recibe el asset y documentación: no hay cambios de endpoints, DB, cálculos o seguridad de la plantilla. No se ejecutan migraciones ni se despliega testing. Promover las imágenes web/API por bloques cuando el propietario lo solicite.

La API conserva `ZANDAKA_LOGO_PATH` y la prioridad de archivos documentada en su carpeta de assets. Si un entorno tiene una imagen personalizada, esa configuración puede prevalecer sobre el SVG nuevo. Verificarlo al desplegar, sin borrar archivos personalizados como efecto implícito de actualizar la marca. Los accesos directos ya guardados en dispositivos pueden conservar su icono hasta que el sistema los actualice o se vuelvan a añadir.
