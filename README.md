# Ecommerce API

Starter project for an Express and TypeScript API using Prisma 7 and PostgreSQL.
The controller, service, and repository directories are reserved for future
feature implementation; no ecommerce endpoints are implemented yet.

## Requirements

- Node.js 20.19 or newer
- npm
- PostgreSQL

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` to your PostgreSQL URL.
2. Install dependencies with `npm install`.
3. Generate the Prisma client with `npm run db:generate`.
4. Create and apply the initial database migration with `npm run db:migrate`.
5. Start the development server with `npm run dev`.

The Prisma 7 client uses the PostgreSQL driver adapter and is initialized in
`src/config/prisma.ts` for future repository modules.

The server listens on port 3000 by default. Set `PORT` to change it. Set
`CORS_ORIGIN` to a comma-separated list of allowed frontend origins. Morgan logs
HTTP requests in development format. Unknown routes and forwarded errors return
a JSON error response.

## Products API

Public catalog endpoints return active products only:

- `GET /api/v1/products` supports `page`, `limit`, `search`, `categoryId`, `sortBy`, and `sortOrder` query parameters.
- `GET /api/v1/products/:id` returns an active product.

Product creation and changes require a bearer token for an admin user:

- `GET /api/v1/products/admin` lists products across statuses; an optional `status` query parameter filters the list.
- `GET /api/v1/products/admin/:id` returns a product regardless of status.
- `POST /api/v1/products` creates a product.
- `PATCH /api/v1/products/:id` updates supplied fields.
- `DELETE /api/v1/products/:id` archives the product, preserving order history.

Product writes require an existing `categoryId`. List responses include `items`
and `pagination` metadata.

## Stripe Payments

Configure `STRIPE_SECRET_KEY` with a Stripe test or live secret key and
`STRIPE_WEBHOOK_SECRET` with the signing secret for the webhook endpoint.
`STRIPE_CURRENCY` defaults to `usd`; `FRONTEND_URL` defaults to
`http://localhost:5173` and is used for Checkout success and cancellation URLs.

An authenticated customer starts Checkout for their own pending order with
`POST /api/v1/payments/checkout-session` and JSON `{ "orderId": "<order-id>" }`.
The response contains `checkoutUrl`; redirect the customer to that Stripe URL.
The order must already exist and have a positive total. Payment and order status
are updated only after Stripe sends a verified webhook event.

For local development, install and authenticate the Stripe CLI, then run:

```sh
stripe listen --forward-to localhost:3000/api/v1/payments/webhook
```

Copy the CLI's `whsec_...` signing secret into `STRIPE_WEBHOOK_SECRET`. The
webhook handles `checkout.session.completed`,
`checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, and `checkout.session.expired`.

## Commands

- `npm run dev` starts the TypeScript development server.
- `npm run build` compiles the server into `dist/`.
- `npm start` runs the compiled server.
- `npm run typecheck` checks TypeScript without emitting files.
- `npm run db:generate` generates Prisma Client.
- `npm run db:migrate` creates/applies a development migration.
- `npm run db:deploy` applies existing migrations.
- `npm run db:studio` opens Prisma Studio.
