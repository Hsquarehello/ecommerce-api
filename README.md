# Ecommerce API

A production-style Node.js, TypeScript, Express, Prisma, and PostgreSQL backend for an ecommerce platform. The API supports authentication, catalog browsing, cart management, order flows, and Stripe-based checkout.

## Features

- JWT authentication with customer and admin roles
- Public product catalog and admin product management
- Cart creation, updates, and checkout flow
- Order creation, listing, cancellation, and admin lifecycle updates
- Stripe checkout session creation and webhook verification
- Request validation with Zod and centralized error handling
- Prisma models for users, products, carts, orders, and payments

## Tech Stack

- Node.js 20+
- TypeScript
- Express 5
- Prisma 7
- PostgreSQL
- Stripe SDK
- Zod validation

## Requirements

- Node.js 20.19 or newer
- npm
- PostgreSQL database
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

3. Generate the Prisma client:

   ```bash
   npm run db:generate
   ```

4. Apply the schema to PostgreSQL:

   ```bash
   npm run db:migrate
   ```

5. Start the API in development mode:

   ```bash
   npm run dev
   ```

6. The server runs on port `3000` by default. Health check:

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

## Security Notes

- Passwords are hashed before storage.
- Protected routes require a valid JWT bearer token.
- Role-based authorization restricts admin-only actions.
- Stripe webhook requests are verified using the signing secret.
- CORS is controlled via `CORS_ORIGIN`.

## Project Structure

```text
src/
  app.ts
  server.ts
  config/
  errors/
  middleware/
  modules/
prisma/
  schema.prisma
.env.example
package.json
SPEC.md
```

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
