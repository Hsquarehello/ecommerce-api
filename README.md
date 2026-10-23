# Ecommerce API

A production-style Node.js, TypeScript, Express, Prisma, and PostgreSQL backend for an ecommerce platform. The API supports authentication, catalog browsing, cart management, order flows, and Stripe-based checkout.

## Features

- JWT authentication with customer and admin roles
- Public product catalog and admin product management
- Cart creation, updates, and checkout flow
- Order creation, listing, cancellation, and admin lifecycle updates
- Stripe checkout session creation and webhook verification
- Redis-backed rate limiting for all API routes, with stricter limits on auth endpoints
- Request validation with Zod and centralized error handling
- Prisma models for users, products, carts, orders, and payments

## Tech Stack

- Node.js 20+
- TypeScript
- Express 5
- Prisma 7
- PostgreSQL
- Redis with express-rate-limit and rate-limit-redis
- Stripe SDK
- Zod validation

## Requirements

- Node.js 20.19 or newer
- npm
- PostgreSQL database
- Redis server (or set `RATE_LIMIT_STORE=memory` to run without Redis)
- Stripe account for payment testing (optional for local setup)

## Quick Start

1. Clone the project and install dependencies:

   ```bash
   npm install
   ```

2. Create your environment file from the example:

   ```bash
   copy .env.example .env
   ```

   Then update the values in `.env`, especially:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`

3. Start a Redis server for rate limiting (skip this if you set `RATE_LIMIT_STORE=memory` in `.env`):

   ```bash
   docker run --name ecommerce-redis -p 6379:6379 -d redis:7-alpine
   ```

4. Generate the Prisma client:

   ```bash
   npm run db:generate
   ```

5. Apply the schema to PostgreSQL:

   ```bash
   npm run db:migrate
   ```

6. Start the API in development mode:

   ```bash
   npm run dev
   ```

7. The server runs on port `3000` by default. Health check:

   ```bash
   GET /health
   ```

## Environment Variables

The app expects these variables in `.env`:

- `PORT` — API port, defaults to `3000`
- `CORS_ORIGIN` — comma-separated frontend origins, default `http://localhost:5173`
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — secret for signing JWTs; minimum 32 characters
- `STRIPE_SECRET_KEY` — Stripe secret key for checkout sessions
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
- `STRIPE_CURRENCY` — default `usd`
- `FRONTEND_URL` — redirect destination for Stripe checkout, default `http://localhost:5173`
- `REDIS_URL` — Redis connection string for the rate limiter store, default `redis://localhost:6379`
- `RATE_LIMIT_STORE` — `redis` (default) or `memory` for the per-process in-memory store
- `RATE_LIMIT_WINDOW_MS` — rate limit window in milliseconds, default `60000`
- `RATE_LIMIT_MAX` — requests allowed per IP per window on all `/api/v1` routes, default `100`
- `RATE_LIMIT_AUTH_MAX` — requests allowed per IP per window on `/api/v1/auth/register` and `/api/v1/auth/login`, default `10`
- `TRUST_PROXY` — optional reverse proxy setting for Express `trust proxy` (e.g. `1`, `loopback`, or an IP list); required behind a proxy so rate limiting sees real client IPs

## API Overview

All endpoints are mounted under `/api/v1`.

### Auth

- `POST /api/v1/auth/register` — register a new customer account
- `POST /api/v1/auth/login` — sign in and receive a JWT
- `POST /api/v1/auth/logout` — log out (always succeeds; revokes the token if valid)
- `GET /api/v1/auth/me` — get the current user (`data` is `null` when not authenticated)

Example register payload:

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "StrongPassword123!"
}
```

Example login payload:

```json
{
  "email": "jane@example.com",
  "password": "StrongPassword123!"
}
```

### Products

Public catalog:

- `GET /api/v1/products` — list active products with pagination and filtering
- `GET /api/v1/products/:id` — fetch a single active product

Admin catalog routes:

- `GET /api/v1/products/admin` — list all products, including non-active ones
- `GET /api/v1/products/admin/:id` — fetch any product by ID
- `POST /api/v1/products` — create a product
- `PATCH /api/v1/products/:id` — update selected product fields
- `DELETE /api/v1/products/:id` — archive a product without deleting history

### Cart

Protected routes requiring a bearer token:

- `GET /api/v1/cart` — fetch the current user's cart
- `POST /api/v1/cart/items` — add an item to the cart
- `PATCH /api/v1/cart/items/:productId` — update item quantity
- `DELETE /api/v1/cart/items/:productId` — remove an item from the cart
- `DELETE /api/v1/cart` — clear the cart
- `POST /api/v1/cart/checkout` — convert the cart into a pending order

Example add-item payload:

```json
{
  "productId": "<product-id>",
  "quantity": 2
}
```

### Orders

Protected routes:

- `POST /api/v1/orders` — create an order from a payload or cart
- `GET /api/v1/orders` — list the authenticated user's orders
- `GET /api/v1/orders/:id` — get one of the user's orders
- `PATCH /api/v1/orders/:id/cancel` — cancel a pending order

Admin-only routes:

- `GET /api/v1/orders/admin` — list all orders with filters
- `GET /api/v1/orders/admin/:id` — get any order
- `PATCH /api/v1/orders/admin/:id/status` — update order lifecycle status

Supported order statuses:

- `PENDING`
- `PAID`
- `SHIPPED`
- `DELIVERED`
- `CANCELLED`

### Payments

- `POST /api/v1/payments/checkout-session` — create a Stripe checkout link for a pending order
- `POST /api/v1/payments/webhook` — Stripe webhook endpoint for payment updates

Example checkout payload:

```json
{
  "orderId": "<order-id>"
}
```

For local webhook testing, run:

```bash
stripe listen --forward-to localhost:3000/api/v1/payments/webhook
```

Copy the returned webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

## Rate Limiting

All `/api/v1` routes are rate limited per client IP with `express-rate-limit`. Hit counters are stored in Redis (`rate-limit-redis` + node-redis) so limits are shared across multiple application instances.

| Limiter | Routes | Default limit | Redis key prefix |
| --- | --- | --- | --- |
| Global (`apiLimiter`) | every `/api/v1` route | `RATE_LIMIT_MAX` per `RATE_LIMIT_WINDOW_MS` (100 per minute) | `rl:api:` |
| Auth (`authLimiter`) | `/api/v1/auth/register`, `/api/v1/auth/login` | `RATE_LIMIT_AUTH_MAX` per `RATE_LIMIT_WINDOW_MS` (10 per minute) | `rl:auth:` |

Details:

- Keys are generated from the client IP address; IPv6 clients are grouped by subnet (`/56` by default).
- Compatible with Redis 5.x and newer (and Redis-compatible servers such as Valkey); the node-redis client pins RESP2 for broad compatibility.
- Every response through a limiter includes IETF draft-7 `RateLimit` and `RateLimit-Policy` headers; blocked responses also include `Retry-After` (seconds until the window resets). Legacy `X-RateLimit-*` headers are disabled.
- Blocked requests return HTTP `429` in the unified error format:

  ```json
  {
    "success": false,
    "message": "Too many requests, please try again later.",
    "data": null
  }
  ```

- The Stripe webhook endpoint (`POST /api/v1/payments/webhook`) and `GET /health` are exempt: the webhook is protected by Stripe signature verification and receives retries from Stripe itself, and `/health` is used by uptime probes.
- If Redis becomes unreachable, the API fails open (requests are allowed without counting) and logs the store error, prioritizing availability over strict enforcement. Restart the API once Redis is reachable again.
- Set `RATE_LIMIT_STORE=memory` to use the built-in per-process store instead of Redis (convenient for tests and local development without Redis; limits are not shared across instances).
- When running behind a reverse proxy or load balancer, set `TRUST_PROXY` (for example `1`) so Express resolves the real client IP from `X-Forwarded-For`; otherwise all clients share the proxy's IP quota.

## Security Notes

- Passwords are hashed before storage.
- Protected routes require a valid JWT bearer token.
- Role-based authorization restricts admin-only actions.
- Stripe webhook requests are verified using the signing secret.
- CORS is controlled via `CORS_ORIGIN`.
- Per-IP rate limiting (Redis-backed) protects all API routes, with stricter limits on registration and login.

## Project Structure

```text
src/
  app.ts
  server.ts
  config/
    env.ts
    prisma.ts
    redis.ts
  errors/
  middleware/
    rateLimit.ts
    rateLimit.test.ts
  modules/
prisma/
  schema.prisma
.env.example
.gitignore
package.json
SPEC.md
```

Log files (`*.log`) are git-ignored; request logging goes to stdout via `morgan("dev")`.

## Available Scripts

```bash
npm run dev
npm run build
npm start
npm run typecheck
npm run db:generate
npm run db:migrate
npm run db:deploy
npm run db:studio
```

## Notes

This repository contains the implementation of the ecommerce backend described in `SPEC.md`. It is intended to be used as a backend API service and is not a frontend application.
