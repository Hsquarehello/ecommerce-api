# User Management API Specification

## Status

Planning specification for the backend API. The profile fields admins may update and list query details remain open decisions; do not assume them during implementation.

## Goals

- Allow administrators to list registered users with search and pagination.
- Allow administrators to view a user by ID.
- Allow administrators to update only explicitly approved profile fields.
- Keep the feature backend-only; frontend integration is out of scope.

## Non-goals

- Creating users through the User Management API. Users continue to register through the existing public registration flow.
- Changing user roles.
- Deleting or deactivating accounts.
- Modifying the Prisma schema, database relationships, or migrations.
- Changing order history or user-order relationships.

## Verified existing data and behavior

The Prisma `User` model in `prisma/schema.prisma` contains:

- `id`, `email`, `password`, `name`, `role`, `tokenVersion`, `rememberMe`, `createdAt`, and `updatedAt`.
- `role` is `CUSTOMER` or `ADMIN`, with `CUSTOMER` as the default.
- A user has many orders and an optional cart.
- There is no user status/deactivation field.

Public registration uses a strict Zod schema with `name`, `email`, and `password`; it does not accept a `role`. Passwords are hashed in the auth service. Existing admin routes use `authenticate` and `authorize(Role.ADMIN)`. The authorization middleware takes the current role from the database-backed user record.

## Proposed API

All routes are mounted under `/api/v1` and require authentication and `ADMIN` authorization.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/users` | List registered users with validated search and pagination |
| `GET` | `/api/v1/users/:id` | Get one user by ID |
| `PATCH` | `/api/v1/users/:id` | Update approved profile fields only |

There is no create, role-change, delete, or deactivate endpoint in this scope.

## Validation and query behavior

- Validate `:id` using the existing UUID validation convention.
- Use strict Zod schemas for query parameters and update bodies; reject unknown fields.
- Use the existing pagination convention as the starting point: `page` defaults to `1`, `limit` defaults to `20`, and the maximum limit is `100`.
- Only expose agreed search fields and sort fields in the query schema.
- An update must contain at least one permitted field.
- Do not accept `password`, `tokenVersion`, `role`, or any unapproved field in an update request.

### Decisions required before implementation

1. Which profile fields may an admin update? `name` and `email` exist in the model, but neither is approved by this specification yet.
2. May an admin update their own profile?
3. Should list search match `name`, `email`, or both?
4. Which sort fields are supported? Choose an explicit allowlist before implementation.

## Response and error behavior

- Follow existing success envelopes: `{ success: true, message, data }`.
- List responses include top-level `pagination` metadata using the existing shape: `page`, `limit`, `totalItems`, `totalPages`, `hasNextPage`, and `hasPrevPage`.
- Select only fields needed in the API response. Never return `password` or `tokenVersion`.
- `role` may be returned read-only if useful to the admin UI; it must not be writable in this scope.
- Invalid input follows the centralized Zod error response (HTTP 400).
- Missing users return HTTP 404 via `AppError`.
- Authentication failures return HTTP 401; authenticated non-admin requests return HTTP 403.
- If email updates are approved, map a duplicate-email Prisma unique-constraint error to HTTP 409 using the existing service-layer error-mapping pattern.
- Unexpected failures continue through the centralized error handler; do not return raw database errors.

## Security and data integrity

- Enforce `authenticate` and `authorize(Role.ADMIN)` on every route; frontend access control is not sufficient.
- Preserve the existing registration behavior so clients cannot assign themselves `ADMIN`.
- Explicitly select or serialize safe response fields; never expose password hashes or `tokenVersion`.
- Do not allow role changes, deletion, or deactivation in this initial feature.
- Do not modify order history or schema relationships.
- Since role changes and account removal are out of scope, this feature does not reduce the number of administrators; no last-admin safeguard is needed for the specified operations.
- Self-profile editing remains subject to the decision above. No self-deactivation behavior exists or is permitted in this scope.

## Acceptance criteria

1. All three routes require a valid authenticated administrator; unauthenticated requests receive 401 and non-admin requests receive 403.
2. Listing validates pagination, agreed search fields, and agreed sort fields, and returns the standard list envelope and pagination metadata.
3. Detail and update reject invalid IDs; missing valid IDs return 404.
4. Update accepts only the confirmed profile fields, rejects unknown fields, and rejects an empty update.
5. Public registration continues to reject a supplied `role`.
6. List, detail, and update responses never include `password` or `tokenVersion`.
7. Duplicate email updates return 409 if email editing is approved.
8. No user role, account existence, deactivation status, schema, or order history is changed by the feature.
9. Focused Vitest tests cover success cases, validation failures, authorization, missing users, sensitive-field exclusion, pagination/search, and approved update behavior.
10. Focused tests and `npm run typecheck` pass before the feature is considered complete; report only checks that were actually run.

## Proposed implementation sequence

1. Resolve the four open decisions above.
2. Create `src/modules/users/users.schema.ts` for ID, list query, and approved update validation.
3. Create `src/modules/users/users.repository.ts` for selected-field listing, count, detail, and update operations.
4. Create `src/modules/users/users.service.ts` for pagination metadata, not-found behavior, and any approved Prisma error mapping.
5. Create `src/modules/users/users.controller.ts` for the existing response envelopes.
6. Create `src/modules/users/users.routes.ts` with admin authorization and validation middleware; create `src/modules/users/index.ts` to export the router.
7. Modify `src/app.ts` to mount the users router under `/api/v1/users`.
8. Add focused tests under `src/modules/users/`, following the current Vitest setup and module testing patterns.
9. Update `README.md` to document the implemented endpoints if the API overview is maintained there.

## Existing project references

- Data model: `prisma/schema.prisma`
- Authentication and role authorization: `src/modules/auth/auth.schema.ts`, `src/modules/auth/auth.service.ts`, `src/modules/auth/auth.middleware.ts`
- Admin routes and CRUD patterns: `src/modules/products/` and `src/modules/orders/`
- Router mounting: `src/app.ts`
- Validation and error handling: `src/middleware/` and `src/errors/`
- Test configuration and scripts: `vitest.config.ts` and `package.json`
