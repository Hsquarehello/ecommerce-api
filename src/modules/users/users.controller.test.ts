import type { Request, RequestHandler, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const usersServiceMock = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  update: vi.fn(),
}));

vi.mock("./users.service.js", () => ({
  usersService: usersServiceMock,
}));

import {
  getUserById,
  listUsers,
  updateUser,
} from "./users.controller.js";

const invokeController = async (
  handler: RequestHandler,
  input: {
    query?: Record<string, unknown>;
    params?: Record<string, string>;
    body?: unknown;
  } = {},
) => {
  const request = {
    query: input.query ?? {},
    params: input.params ?? {},
    body: input.body ?? {},
  } as Request;
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn();

  await handler(request, response, next);

  return { response, next };
};

describe("users controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listUsers", () => {
    it("lists users and returns data with pagination metadata", async () => {
      const result = {
        items: [{ id: "user-1", name: "Alice", email: "alice@example.com" }],
        pagination: {
          page: 2,
          limit: 10,
          totalItems: 11,
          totalPages: 2,
          hasNextPage: false,
          hasPrevPage: true,
        },
      };
      usersServiceMock.list.mockResolvedValue(result);

      const { response, next } = await invokeController(listUsers, {
        query: { page: "2", limit: "10", search: "alice" },
      });

      expect(next).not.toHaveBeenCalled();
      expect(usersServiceMock.list).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        search: "alice",
        sortBy: "createdAt",
        sortOrder: "desc",
      });
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith({
        success: true,
        message: "Users fetched successfully",
        data: result.items,
        pagination: result.pagination,
      });
    });
  });

  describe("getUserById", () => {
    it("gets a user by ID and returns the standard success envelope", async () => {
      const user = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Alice",
        email: "alice@example.com",
      };
      usersServiceMock.getById.mockResolvedValue(user);

      const { response, next } = await invokeController(getUserById, {
        params: { id: user.id },
      });

      expect(next).not.toHaveBeenCalled();
      expect(usersServiceMock.getById).toHaveBeenCalledWith(user.id);
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith({
        success: true,
        message: "User fetched successfully",
        data: user,
      });
    });
  });

  describe("updateUser", () => {
    it("updates the user with the request body and returns the result", async () => {
      const id = "550e8400-e29b-41d4-a716-446655440000";
      const input = { name: "Alice Smith" };
      const user = {
        id,
        name: "Alice Smith",
        email: "alice@example.com",
      };
      usersServiceMock.update.mockResolvedValue(user);

      const { response, next } = await invokeController(updateUser, {
        params: { id },
        body: input,
      });

      expect(next).not.toHaveBeenCalled();
      expect(usersServiceMock.update).toHaveBeenCalledWith(id, input);
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith({
        success: true,
        message: "User updated successfully",
        data: user,
      });
    });
  });

  it("forwards service errors to the next error handler", async () => {
    const serviceError = new Error("User not found");
    usersServiceMock.getById.mockRejectedValue(serviceError);

    const { response, next } = await invokeController(getUserById, {
      params: { id: "550e8400-e29b-41d4-a716-446655440000" },
    });

    expect(next).toHaveBeenCalledWith(serviceError);
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });
});
