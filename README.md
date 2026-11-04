# Zandaka

## Atlántico y staging

La dirección visual elegida es Atlántico. Consultar [fundamentos de experiencia](docs/atlantico.md) y [rama staging y entregas por bloques](docs/staging.md). Web y API se publican como imágenes independientes en GitHub Container Registry; testing se actualiza por bloques de tickets.

Zandaka is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open `http://localhost:3001` with your browser to see the result. API requests should use relative `/api/...` paths; `next.config.ts` proxies them to `API_INTERNAL_URL` or `http://localhost:3000` by default.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Transactions Screen API

The Transactions UI calls `GET /api/transactions` and expects `{ data, meta }` with server-side filters, pagination, and sorting.

Required query params:

- `userId` (int)

Optional query params:

- `from` / `to` (YYYY-MM-DD)
- `type` (INCOME | EXPENSE | TRANSFER | ADJUSTMENT | ALL)
- `accountId` (int)
- `categoryId` (int) - "Envelope" in the UI
- `q` (string) - description search, case-insensitive
- `amountMin` (number, default 0)
- `amountMax` (number)
- `page` (int, default 1, min 1)
- `pageSize` (10 | 25 | 50 | 100)
- `sortBy` (date | amount | createdAt, default date)
- `sortDir` (asc | desc, default desc)

Example request:

```text
/api/transactions?userId=7&from=2026-01-01&to=2026-01-31&type=EXPENSE&accountId=3&categoryId=12&q=spotify&amountMin=0&amountMax=50000&page=2&pageSize=25&sortBy=date&sortDir=desc
```

## Learn More

Las convenciones financieras, el glosario español y la accesibilidad se documentan en [Confianza financiera y accesibilidad — ZA-79](docs/confianza-accesibilidad.md).

La regresión de layout móvil y ampliación de texto de Movimientos se documenta en [ZA-78](docs/za-78-layout.md). Ejecutar `npm run build` y `npm run test:e2e` para comprobarla con datos sintéticos.

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

El sistema visual compartido y su galería se documentan en [Atlántico — ZA-83](docs/design-system.md).

La navegación por tareas, los accesos a catálogos y el encabezado compartido se documentan en [ZA-84](docs/navigation.md).

El registro guiado de transferencias y su recuperación segura se documentan en [ZA-90](docs/transfers.md).
