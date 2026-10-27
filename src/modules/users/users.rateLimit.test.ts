import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
  process.env.JWT_SECRET ??= "test-secret-that-is-at-least-thirty-two-characters";
  process.env.RATE_LIMIT_STORE = "memory";

  return {
    authFindById: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
  };
});

vi.mock("../auth/auth.repository.js", () => ({
  authRepository: {
    findById: mocks.authFindById,
  },
}));

vi.mock("./users.service.js", () => ({
  usersService: {
    list: mocks.list,
    getById: mocks.getById,
    update: mocks.update,
  },
}));

import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { Role } from "../../generated/prisma/enums.js";
import { errorHandler } from "../../middleware/errorHandler.js";
import { usersRouter } from "./users.routes.js";

let server: Server;
let baseUrl: string;

const userId = "550e8400-e29b-41d4-a716-446655440000";
const token = jwt.sign({}, env.JWT_SECRET, {
  issuer: "ecommerce-api",
  subject: "admin-user",
});

const send = (path: string, method: "GET" | "PATCH" = "GET") =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(method === "PATCH" ? { "content-type": "application/json" } : {}),
    },
    ...(method === "PATCH" ? { body: JSON.stringify({ name: "Alice" }) } : {}),
  });

describe("User Management rate limiting", () => {
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use("/users", usersRouter);
    app.use(errorHandler);

    server = await new Promise((resolve) => {
      const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authFindById.mockResolvedValue({
      id: "admin-user",
      role: Role.ADMIN,
      tokenVersion: 0,
    });
    mocks.list.mockResolvedValue({
      items: [],
      pagination: {
        page: 1,
        limit: 20,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });
    mocks.getById.mockResolvedValue({ id: userId, name: "Alice" });
    mocks.update.mockResolvedValue({ id: userId, name: "Alice" });
  });

  it("shares a 10-per-minute quota across all User Management routes", async () => {
    const requests: Promise<Response>[] = [
      ...Array.from({ length: 4 }, () => send("/users")),
      ...Array.from({ length: 3 }, () => send(`/users/${userId}`)),
      ...Array.from({ length: 3 }, () => send(`/users/${userId}`, "PATCH")),
    ];
    const allowed = await Promise.all(requests);

    expect(allowed.map((response) => response.status)).toEqual(
      Array(10).fill(200),
    );

    const blocked = await send("/users");
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("ratelimit")).toContain("limit=10");
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    expect(await blocked.json()).toEqual({
      success: false,
      message: "Too many requests, please try again later.",
      data: null,
    });
  });
});
