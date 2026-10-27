import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
  process.env.JWT_SECRET ??= "test-secret-that-is-at-least-thirty-two-characters";
  process.env.RATE_LIMIT_STORE = "memory";

  return {
    authFindById: vi.fn(),
    userFindMany: vi.fn(),
    userCount: vi.fn(),
    userFindUnique: vi.fn(),
    userUpdate: vi.fn(),
  };
});

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    user: {
      findMany: mocks.userFindMany,
      count: mocks.userCount,
      findUnique: mocks.userFindUnique,
      update: mocks.userUpdate,
    },
  },
}));

vi.mock("../auth/auth.repository.js", () => ({
  authRepository: {
    findById: mocks.authFindById,
  },
}));

import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { Role } from "../../generated/prisma/enums.js";
import { app } from "../../app.js";

let server: Server;
let baseUrl: string;

const safeUser = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Alice",
  email: "alice@example.com",
  role: Role.CUSTOMER,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
};

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
};

const createToken = (subject: string) =>
  jwt.sign({}, env.JWT_SECRET, {
    issuer: "ecommerce-api",
    subject,
  });

const request = (
  path: string,
  options: {
    method?: "GET" | "PATCH";
    token?: string;
    body?: unknown;
  } = {},
) =>
  fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.token
        ? { authorization: `Bearer ${options.token}` }
        : {}),
      ...(options.body !== undefined
        ? { "content-type": "application/json" }
        : {}),
    },
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  });

describe("User Management API integration", () => {
  beforeAll(async () => {
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
    mocks.authFindById.mockImplementation(async (id: string) => ({
      id,
      role: id === "customer-user" ? Role.CUSTOMER : Role.ADMIN,
      tokenVersion: 0,
    }));
    mocks.userFindMany.mockResolvedValue([safeUser]);
    mocks.userCount.mockResolvedValue(1);
    mocks.userFindUnique.mockResolvedValue(safeUser);
    mocks.userUpdate.mockResolvedValue({ ...safeUser, name: "Alice Smith" });
  });

  it("allows an admin to list users through the mounted API", async () => {
    const response = await request("/api/v1/users?search=alice", {
      token: createToken("admin-user"),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      message: "Users fetched successfully",
      data: [safeUser],
      pagination: {
        page: 1,
        limit: 20,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });
    expect(body.data[0]).not.toHaveProperty("password");
    expect(body.data[0]).not.toHaveProperty("tokenVersion");
    expect(mocks.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ select: safeUserSelect }),
    );
  });

  it("allows an admin to view a user by ID without sensitive fields", async () => {
    const response = await request(`/api/v1/users/${safeUser.id}`, {
      token: createToken("admin-user"),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      message: "User fetched successfully",
      data: safeUser,
    });
    expect(body.data).not.toHaveProperty("password");
    expect(body.data).not.toHaveProperty("tokenVersion");
    expect(mocks.userFindUnique).toHaveBeenCalledWith({
      where: { id: safeUser.id },
      select: safeUserSelect,
    });
  });

  it("allows an admin to update permitted profile fields without exposing sensitive fields", async () => {
    const response = await request(`/api/v1/users/${safeUser.id}`, {
      method: "PATCH",
      token: createToken("admin-user"),
      body: { name: "Alice Smith" },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      message: "User updated successfully",
      data: { ...safeUser, name: "Alice Smith" },
    });
    expect(body.data).not.toHaveProperty("password");
    expect(body.data).not.toHaveProperty("tokenVersion");
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: safeUser.id },
      data: { name: "Alice Smith" },
      select: safeUserSelect,
    });
  });

  it("returns 404 when the requested user does not exist", async () => {
    mocks.userFindUnique.mockResolvedValue(null);

    const response = await request(
      "/api/v1/users/550e8400-e29b-41d4-a716-446655440099",
      { token: createToken("admin-user") },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      message: "User not found",
      data: null,
    });
  });

  it("returns 404 when an update targets a missing user", async () => {
    mocks.userUpdate.mockRejectedValue(
      Object.assign(new Error("Record not found"), { code: "P2025" }),
    );

    const response = await request(
      "/api/v1/users/550e8400-e29b-41d4-a716-446655440099",
      {
        method: "PATCH",
        token: createToken("admin-user"),
        body: { name: "Alice" },
      },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      message: "User not found",
      data: null,
    });
  });

  it("returns 401 for unauthenticated requests to every route", async () => {
    const responses = await Promise.all([
      request("/api/v1/users"),
      request(`/api/v1/users/${safeUser.id}`),
      request(`/api/v1/users/${safeUser.id}`, {
        method: "PATCH",
        body: { name: "Alice" },
      }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      401, 401, 401,
    ]);
    expect(mocks.userFindMany).not.toHaveBeenCalled();
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("returns 403 for non-admin requests to every route", async () => {
    const token = createToken("customer-user");
    const responses = await Promise.all([
      request("/api/v1/users", { token }),
      request(`/api/v1/users/${safeUser.id}`, { token }),
      request(`/api/v1/users/${safeUser.id}`, {
        method: "PATCH",
        token,
        body: { name: "Alice" },
      }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      403, 403, 403,
    ]);
    expect(mocks.userFindMany).not.toHaveBeenCalled();
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid list queries, IDs, and update bodies", async () => {
    const token = createToken("admin-user");
    const responses = await Promise.all([
      request("/api/v1/users?page=0", { token }),
      request("/api/v1/users/not-a-uuid", { token }),
      request(`/api/v1/users/${safeUser.id}`, {
        method: "PATCH",
        token,
        body: { role: "ADMIN" },
      }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      400, 400, 400,
    ]);
    for (const response of responses) {
      expect(await response.json()).toMatchObject({
        success: false,
        message: "Validation failed",
        data: null,
      });
    }
    expect(mocks.userFindMany).not.toHaveBeenCalled();
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("keeps the existing health endpoint available", async () => {
    const response = await request("/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
