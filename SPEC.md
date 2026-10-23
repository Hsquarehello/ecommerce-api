# Ecommerce API Specification

## 1. Overview

This project is a backend API for an ecommerce platform built with Node.js, TypeScript, Express, Prisma, PostgreSQL, and Redis. It supports authentication, catalog browsing, cart management, order lifecycle operations, and Stripe-based payment checkout.

The API is designed around role-based access control and domain-driven modules:

- Auth
- Products
- Cart
- Orders
- Payments

The application exposes REST endpoints under the `/api/v1` prefix and uses JSON responses with standardized error handling.

---

## 2. Goals

- Support public product browsing for customers.
- Allow admins to manage catalog products and order lifecycle states.
- Enable authenticated customers to maintain a shopping cart.
- Allow conversion of a cart into an order with server-side pricing capture.
- Enforce stock validation and prevent overselling.
- Integrate with Stripe for checkout session creation and webhook-based payment confirmation.
- Provide secure, validated, and role-aware endpoints.

## 3. Non-Goals

- Frontend UI implementation.
- Multiple storefronts or marketplace multi-tenant support.
- Inventory forecasting or warehouse logistics.
- Refund processing beyond the payment status states defined in the schema.
- Cron jobs or scheduled fulfillment workflows.

---

## 4. System Architecture

### 4.1 Runtime

- Node.js 20+
- Express 5
- TypeScript
- Prisma 7 with PostgreSQL
- Redis for shared rate limiter counters (express-rate-limit + rate-limit-redis + node-redis)
- Zod for request validation
- Stripe SDK for payment integration

### 4.2 Project Structure

- `src/app.ts` — application bootstrap and middleware registration
- `src/server.ts` — server startup
- `src/config/` — environment, Redis, and Prisma configuration
- `src/modules/auth/` — authentication and authorization logic
- `src/modules/products/` — catalog CRUD and listing logic
- `src/modules/carts/` — cart and checkout logic
- `src/modules/orders/` — order lifecycle logic
- `src/modules/payments/` — Stripe checkout and webhook support
- `src/middleware/` — validation, rate limiting, and error handling
- `prisma/schema.prisma` — database schema and enums

---

## 5. Actors

### Customer

- Registers and signs in.
- Browses active products.
- Manages their own cart.
- Creates orders from cart or direct order payload.
- Views their own order history.
- Cancels a pending order.
- Starts Stripe checkout for their pending order.

### Admin

- CRUD access to products across statuses.
- Lists products and orders across users.
- Views any order record.
- Updates order status transitions.
- Manages inventory-relevant lifecycle events.

---

## 6. Authentication and Authorization

### Authentication

- JWT bearer token authentication is required for protected endpoints.
- Token payload contains user identity and role information.

### Authorization

- Customers can only access their own orders and cart data.
- Admin-only routes are protected using role authorization.
- Product mutation routes require admin privileges.

### Security Expectations

- Passwords are hashed before persistence.
- Request bodies are validated using Zod schemas.
- Sensitive payment webhook endpoints verify Stripe signatures.
- CORS is configured via environment settings.
- Per-IP rate limiting protects all `/api/v1` endpoints, with stricter limits on credential endpoints.

---

## 7. Data Model Summary

### User

- id
- email
- password
- name
- role: CUSTOMER | ADMIN
- createdAt, updatedAt

### Category

- id
- name

### Product

- id
- name
- sku
- description
- price
- costPrice
- stock
- lowStockThreshold
- status: ACTIVE | DRAFT | ARCHIVED
- images
- vendor
- weight
- categoryId
- timestamps

### Cart

- id
- userId
- createdAt, updatedAt

### CartItem

- id
- cartId
- productId
- quantity

### Order

- id
- userId
- totalAmount
- status: PENDING | PAID | SHIPPED | DELIVERED | CANCELLED
- shippingAddress
- createdAt, updatedAt

### OrderItem

- id
- orderId
- productId
- quantity
- price

### Payment

- id
- orderId
- amount
- provider: STRIPE | KBZ_PAY | WAVE_PAY | CASH_ON_DELIVERY
- status: PENDING | SUCCESS | FAILED | REFUNDED
- transactionId
- paymentRawData
- timestamps

---

## 8. Functional Requirements

### 8.1 Auth

#### Register

- Endpoint: `POST /api/v1/auth/register`
- Requires: email, password, name
- Creates a new user with default CUSTOMER role.
- Rejects duplicate email addresses.

#### Login

- Endpoint: `POST /api/v1/auth/login`
- Requires: email, password
- Returns a JWT token for authenticated requests.

#### Current User

- Endpoint: `GET /api/v1/auth/me`
- Does not require authentication; always returns HTTP 200.
- Returns the current user when a valid bearer token is supplied, otherwise `data` is `null`.

#### Logout

- Endpoint: `POST /api/v1/auth/logout`
- Does not require authentication; always returns success so the frontend can clear its token even if the token is missing or expired.
- If a valid bearer token is provided, revokes all previously issued tokens for that user.

---

### 8.2 Products

#### Public Catalog

- `GET /api/v1/products`
- Lists active products only.
- Supports query parameters:
  - `page`
  - `limit`
  - `search`
  - `categoryId`
  - `sortBy`
  - `sortOrder`
- Returns items plus pagination metadata.

#### Product Detail

- `GET /api/v1/products/:id`
- Returns a product only if it is active.

#### Admin Catalog Access

- `GET /api/v1/products/admin`
- Lists products regardless of status, optionally filtered by status.

- `GET /api/v1/products/admin/:id`
- Returns a product record regardless of status.

#### Admin Product Actions

- `POST /api/v1/products`
- `PATCH /api/v1/products/:id`
- `DELETE /api/v1/products/:id`

Business rules:

- Product writes require a valid `categoryId`.
- Deleting a product should archive it and preserve order history.
- Product updates may change only supplied fields.

---

### 8.3 Cart

#### Cart Access

- `GET /api/v1/cart`
- Requires authentication.
- Returns the current user's cart, including line items and totals.

#### Add Item

- `POST /api/v1/cart/items`
- Payload:
  `{ "productId": "...", "quantity": 2 }`
- If the item already exists, the quantity is incremented.
- Validates product existence and product availability.
- Returns `400` for invalid/unavailable products.
- Returns `409` if requested quantity exceeds stock.

#### Update Quantity

- `PATCH /api/v1/cart/items/:productId`
- Payload:
  `{ "quantity": 4 }`
- Sets the exact quantity.
- Returns `404` if the product is not in the cart.

#### Remove Item

- `DELETE /api/v1/cart/items/:productId`
- Removes one product from the cart.

#### Clear Cart

- `DELETE /api/v1/cart`
- Empties the cart.

#### Cart Checkout

- `POST /api/v1/cart/checkout`
- Payload:
  `{ "shippingAddress": "..." }`
- Converts the cart into a pending order using the same pricing and stock validation as order creation.
- The operation is transactional: order creation, stock updates, and cart clearing commit together.
- If stock is insufficient or a product is unavailable, the cart remains unchanged.

---

### 8.4 Orders

#### Customer Order Creation

- `POST /api/v1/orders`
- Requires authentication.
- Payload:
  ```json
  {
    "shippingAddress": "...",
    "items": [{ "productId": "...", "quantity": 1 }]
  }
  ```
- Captures prices from the product record at order creation time.
- Decrements stock atomically.
- Merges duplicate product lines before finalizing the order.
- Returns `409` if stock is insufficient.

#### Customer My Orders

- `GET /api/v1/orders`
- Lists the authenticated user's orders.
- Supports:
  - `page`
  - `limit`
  - `status`
  - `sortBy` (`createdAt` or `totalAmount`)
  - `sortOrder`

#### Customer Order Detail

- `GET /api/v1/orders/:id`
- Returns one of the user's own orders with items and payment details.

#### Cancel My Order

- `PATCH /api/v1/orders/:id/cancel`
- Allowed only for a user's own pending orders.
- Cancels the order and restores reserved stock.

#### Admin Order Management

- `GET /api/v1/orders/admin`
- Lists all orders with filters by status and userId.
- Supports pagination parameters.

- `GET /api/v1/orders/admin/:id`
- Returns any order regardless of owner.

- `PATCH /api/v1/orders/admin/:id/status`
- Payload:
  `{ "status": "PAID" }`
- Validates lifecycle transitions.
- Allowed flow: `PENDING -> PAID -> SHIPPED -> DELIVERED`
- `CANCELLED` is allowed from `PENDING` or `PAID` and triggers stock restoration.
- Invalid transitions return `409`.

#### Order Lifecycle Rules

- `PENDING` is initial state for newly created orders.
- `PAID` indicates successful payment confirmation.
- `SHIPPED` is a fulfillment state.
- `DELIVERED` is terminal.
- `CANCELLED` is terminal.
- `DELIVERED` and `CANCELLED` cannot transition further.

---

### 8.5 Payments and Stripe

#### Checkout Session

- `POST /api/v1/payments/checkout-session`
- Requires authentication.
- Payload:
  `{ "orderId": "..." }`
- Validates that the order exists and has a positive total.
- Creates a Stripe Checkout session.
- Returns a `checkoutUrl` to redirect the customer.

#### Webhook

- `POST /api/v1/payments/webhook`
- Receives Stripe events as raw JSON payloads.
- Validates the Stripe signature using `STRIPE_WEBHOOK_SECRET`.
- Handles:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
  - `checkout.session.expired`
- Updates payment and order status after verified webhook confirmation.

#### Environment Configuration

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CURRENCY` (defaults to `usd`)
- `FRONTEND_URL` (defaults to `http://localhost:5173`)

---

### 8.6 Rate Limiting

#### Behavior

- All routes under `/api/v1` are rate limited per client IP using `express-rate-limit`.
- Hit counters are stored in Redis via `rate-limit-redis` and a shared node-redis client so limits are consistent across multiple application instances.
- Clients are identified by IP address. IPv6 addresses are grouped by subnet (default `/56`) so a single client cannot rotate through a large IPv6 block.
- Behind a reverse proxy, `TRUST_PROXY` must be configured so the real client IP is read from `X-Forwarded-For`.

#### Limits

| Limiter | Scope | Default |
| --- | --- | --- |
| Global | every `/api/v1` route | `RATE_LIMIT_MAX` requests per `RATE_LIMIT_WINDOW_MS` (100 per 60 seconds) per IP |
| Auth | `POST /api/v1/auth/register`, `POST /api/v1/auth/login` | `RATE_LIMIT_AUTH_MAX` requests per `RATE_LIMIT_WINDOW_MS` (10 per 60 seconds) per IP |

- Requests to auth credential endpoints count against both the auth limiter and the global limiter.
- Redis key prefixes: `rl:api:` (global) and `rl:auth:` (auth).

#### Exemptions

- `GET /health` is not rate limited so uptime probes remain reliable.
- `POST /api/v1/payments/webhook` is not rate limited: payloads are verified via Stripe signature verification, and Stripe retries webhooks independently.

#### Responses

- Responses passing through a limiter include IETF draft-7 `RateLimit` and `RateLimit-Policy` headers.
- Blocked requests return `429` with a `Retry-After` header (seconds until the window resets) and the unified error format:

  ```json
  {
    "success": false,
    "message": "Too many requests, please try again later.",
    "data": null
  }
  ```

#### Degradation and Configuration

- `RATE_LIMIT_STORE=redis` (default) uses Redis; `RATE_LIMIT_STORE=memory` falls back to the built-in per-process store for environments without Redis (limits are then per instance and not shared).
- If Redis becomes unreachable at runtime, the API fails open: requests are allowed without counting and the store error is logged. Availability is prioritized over strict enforcement.
- If Redis is unreachable at startup, the API still starts and logs a warning; rate limiting resumes automatically once the API is restarted with Redis reachable.

#### Environment Configuration

- `REDIS_URL` (defaults to `redis://localhost:6379`)
- `RATE_LIMIT_STORE` (defaults to `redis`)
- `RATE_LIMIT_WINDOW_MS` (defaults to `60000`)
- `RATE_LIMIT_MAX` (defaults to `100`)
- `RATE_LIMIT_AUTH_MAX` (defaults to `10`)
- `TRUST_PROXY` (optional)

---

## 9. Validation and Error Handling

### Request Validation

All incoming request bodies and route params use Zod validation. Invalid requests return a structured 400-style error response.

### Error Categories

- 400: bad request / invalid input
- 401: unauthenticated
- 403: unauthorized
- 404: resource not found
- 409: conflict / invalid state or stock issue
- 429: rate limit exceeded
- 500: server-side failure

### Unified Error Format

Error responses follow a JSON format with details suitable for API clients, including status code and message content.

---

## 10. Business Rules and Constraints

1. Product stock cannot go negative.
2. Concurrent order creation must avoid overselling.
3. Customer orders are isolated to their own user account.
4. Admins may manage all orders and all products.
5. Order prices are captured at creation time and remain immutable as historical order data.
6. Payment confirmation happens via Stripe webhook rather than relying entirely on client-side redirects.
7. Canceling a pending or paid order should restore stock for the items in that order.
8. Terminal states are not reversible through normal status updates.

---

## 11. Acceptance Criteria

### Functional acceptance

- A registered customer can create an account and receive an auth token.
- A customer can browse active products and view product details.
- An admin can create and update product records.
- A customer can add, update, and remove items from a cart.
- A customer can create an order with item quantities that respect stock availability.
- A pending order can be canceled and stock restored.
- An admin can update order status through the valid lifecycle.
- Stripe checkout can initialize a checkout session for a valid order.
- Webhook verification updates payment and order states.
- A client that exceeds the global or auth request quota receives a `429` response with `Retry-After` and the unified error body.

### Non-functional acceptance

- All protected routes require valid JWT authentication.
- Validation occurs before business logic execution.
- Database writes respect transactional consistency where required.
- Unknown routes return a not-found error response.
- The application starts with environment variables configured correctly.
- Rate limit counters are shared across application instances through Redis.
- The API remains available (fails open) when Redis is unreachable instead of rejecting requests with server errors.

---

## 12. Operational Notes

### Local Development

- Configure PostgreSQL and set `DATABASE_URL`.
- Start a Redis server on `REDIS_URL` (or set `RATE_LIMIT_STORE=memory`).
- Run Prisma generation and migrations.
- Start the development server with `npm run dev`.
- Use the Stripe CLI to forward webhook events locally:

```bash
stripe listen --forward-to localhost:3000/api/v1/payments/webhook
```

### Production Readiness Notes

- Store secrets in environment configuration.
- Ensure Stripe webhook signing secret is managed securely.
- Validate CORS origins explicitly.
- Use a managed PostgreSQL instance for production workloads.
- Use a managed Redis instance for rate limiter counters and set `REDIS_URL` accordingly.
- Set `TRUST_PROXY` when running behind a reverse proxy or load balancer so rate limiting applies per client IP.

---

## 13. Versioning

The API is versioned under `/api/v1` and should remain backward-compatible for each major version layer.

---

## 14. Summary

This project provides a full backend foundation for an ecommerce platform with customer and admin workflows, stock-safe order processing, and Stripe-based payment processing. The design is intended to be clear, modular, and ready for extension with additional features like shipping, refunds, analytics, and review systems.
