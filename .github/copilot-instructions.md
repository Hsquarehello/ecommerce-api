# Project Instructions — E-commerce Backend API

## 1. Project Context

You are assisting with an existing E-commerce Backend API project.

The verified stack includes:
- Node.js and TypeScript
- Express 5
- Prisma 7
- PostgreSQL
- Zod for request validation
- Vitest for testing

This is an existing codebase. Your job is to extend it safely and consistently, not redesign it or replace its architecture.

## 2. Core Development Rules

- Always inspect the relevant existing files before proposing or implementing changes.
- Follow existing project conventions, naming, folder structure, error handling, and response formats.
- Reuse existing middleware, utilities, types, and patterns whenever appropriate.
- Do not introduce unnecessary abstractions, dependencies, or architectural changes.
- Do not install packages, modify environment configuration, change the database schema, or create migrations unless explicitly required and approved.
- Never assume that a function, field, endpoint, or behavior exists without verifying it.
- Clearly distinguish verified facts from assumptions and unresolved questions.
- Prefer the smallest correct implementation that solves the requested problem.

## 3. Agentic Software Development Workflow

Follow this workflow for each feature:

### Phase A — Understand
1. Inspect the relevant code and existing tests.
2. Identify the current behavior and architecture.
3. List requirements, constraints, dependencies, and edge cases.
4. Identify uncertainties that could affect implementation.

### Phase B — Plan
1. Propose a minimal implementation plan.
2. Identify the files that need to be created or modified.
3. Explain the purpose of each change.
4. Define acceptance criteria and testing requirements.
5. Ask for clarification before making decisions that affect security, data integrity, or product behavior.

### Phase C — Implement
1. Implement one logical step at a time.
2. Follow the approved plan and existing project patterns.
3. Keep changes focused and avoid unrelated refactoring.
4. Explain important decisions briefly.
5. Do not silently expand the feature scope.

### Phase D — Test and Review
1. Add or update focused Vitest tests.
2. Test success, validation failure, unauthorized access, missing records, and relevant edge cases.
3. Review the implementation for security, data integrity, and unintended behavior.
4. Run relevant tests and type-checking when authorized and possible.
5. Report actual results accurately. Never claim that tests passed if they were not run.

### Phase E — Quality Gate
Before considering the feature complete, verify:
- Requirements and acceptance criteria are satisfied.
- Authorization is enforced on the server.
- Input validation is in place.
- Sensitive data is not exposed.
- Expected errors are handled consistently.
- Relevant tests and type-checking pass.
- No unrelated changes were introduced.

If a quality gate fails, explain the failure and fix it before proceeding.

## 4. Existing Architecture

Follow the existing feature-module structure, which uses the following layers where appropriate:

- `*.routes.ts` — endpoint definitions and middleware
- `*.controller.ts` — HTTP request/response handling
- `*.service.ts` — business logic and application errors
- `*.repository.ts` — Prisma database operations
- `*.schema.ts` — Zod validation schemas
- `index.ts` — module exports

Use existing modules such as Products, Orders, and Auth as references.

Follow the existing `/api/v1` route mounting convention, response envelopes, pagination metadata, validation middleware, and centralized error handler.

Do not duplicate existing functionality or create a new architectural pattern without a clear reason.

## 5. API and Validation Rules

- Validate request bodies, query parameters, and route parameters with the project's existing Zod conventions.
- Use strict validation where appropriate to reject unexpected fields.
- Validate IDs using the format already established by the project.
- Apply existing pagination defaults, maximum limits, search conventions, and sort-field allowlists where relevant.
- Follow the existing success and error response formats.
- Map expected Prisma errors to appropriate application errors using existing service-layer conventions.
- Do not expose raw database errors or internal implementation details to API clients.
- Avoid returning complete Prisma records when only selected fields are needed.

## 6. Authentication and Authorization

- Enforce authentication and authorization on the backend; never rely on frontend route protection alone.
- Reuse the existing authentication middleware and role authorization mechanisms.
- Treat the database-backed authenticated user's role as authoritative according to the existing middleware.
- Public registration must not allow users to assign themselves privileged roles.
- Do not weaken authentication, authorization, token handling, or password security to make a feature easier to implement.
- Validate permissions for sensitive operations before performing database changes.

## 7. Security and Data Integrity

- Never return password hashes, token versions, secrets, or other internal security fields in API responses.
- Never log passwords, authentication tokens, or sensitive credentials.
- Preserve existing password hashing and verification behavior.
- Prevent unauthorized privilege escalation.
- Consider related records and foreign-key constraints before modifying or removing data.
- Do not delete users or change order history without explicit requirements and an approved data-integrity plan.
- Do not invent deactivation or soft-delete behavior when the schema does not support it.
- Handle duplicate values, missing records, and invalid input predictably.
- Do not modify the database schema or generate migrations without approval.

## 8. Testing Rules

Use the existing Vitest setup and follow the conventions of existing tests.

Tests should cover relevant behavior, including:
- Successful operations
- Invalid request data
- Unauthorized and forbidden requests
- Missing records
- Duplicate values and expected Prisma errors
- Sensitive-field exclusion
- Pagination and search behavior
- Important edge cases and regression scenarios

Prefer focused, deterministic tests. Mock external dependencies only where appropriate and consistent with the existing test architecture.

Do not add another testing framework unless explicitly approved.

## 9. Scope Control

- Work only on the feature requested in the current task.
- Do not implement additional features merely because they might be useful later.
- Do not add role management, account deletion, deactivation, audit logging, caching, or other unrelated capabilities unless explicitly approved.
- Do not start frontend integration while the current task is limited to backend implementation.
- Keep the implementation aligned with the user's Agentic Software Development learning roadmap and current learning phase.
- Prefer understandable code over clever or unnecessarily complex solutions.

## 10. Communication Style

When explaining work:
- Use clear, concise language.
- Explain technical decisions and trade-offs briefly.
- Identify which files are affected and why.
- Separate verified facts, assumptions, and open questions.
- Explain errors and test failures honestly.
- When a requirement is ambiguous, ask a focused clarification question rather than inventing a requirement.

## 11. Default Behavior

Unless the user explicitly requests implementation, begin with analysis and planning.

Before editing files, summarize the proposed changes and identify any decisions requiring approval.

After implementation, report:
1. What changed
2. Which files changed
3. Tests and checks actually executed
4. Their actual results
5. Remaining limitations or follow-up work

The priority is a secure, maintainable implementation that follows the existing project architecture and helps the user learn through a controlled, step-by-step workflow.