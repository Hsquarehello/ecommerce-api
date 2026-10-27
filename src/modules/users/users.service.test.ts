import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../errors/index.js";

const usersRepositoryMock = vi.hoisted(() => ({
  list: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
}));

vi.mock("./users.repository.js", () => ({
  usersRepository: usersRepositoryMock,
}));

import { usersService } from "./users.service.js";
import {
  updateUserSchema,
  usersListQuerySchema,
} from "./users.schema.js";

describe("usersService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("returns users and pagination metadata for the requested page and search", async () => {
      const query = usersListQuerySchema.parse({
        page: "2",
        limit: "10",
        search: "alice",
        sortBy: "email",
        sortOrder: "asc",
      });
      const users = [{ id: "user-1", name: "Alice", email: "alice@example.com" }];
      usersRepositoryMock.list.mockResolvedValue([users, 21]);

      await expect(usersService.list(query)).resolves.toEqual({
        items: users,
        pagination: {
          page: 2,
          limit: 10,
          totalItems: 21,
          totalPages: 3,
          hasNextPage: true,
          hasPrevPage: true,
        },
      });
      expect(usersRepositoryMock.list).toHaveBeenCalledWith(query);
    });
  });

  describe("getById", () => {
    it("returns the user with the requested ID", async () => {
      const user = { id: "user-1", name: "Alice", email: "alice@example.com" };
      usersRepositoryMock.findById.mockResolvedValue(user);

      await expect(usersService.getById("user-1")).resolves.toBe(user);
      expect(usersRepositoryMock.findById).toHaveBeenCalledWith("user-1");
    });

    it("throws a 404 AppError when the user does not exist", async () => {
      usersRepositoryMock.findById.mockResolvedValue(null);

      await expect(usersService.getById("missing-user")).rejects.toMatchObject({
        name: "AppError",
        statusCode: 404,
      });
    });
  });

  describe("update", () => {
    it("updates permitted name and email fields", async () => {
      const input = updateUserSchema.parse({
        name: "Alice Smith",
        email: "alice.smith@example.com",
      });
      const user = {
        id: "user-1",
        name: "Alice Smith",
        email: "alice.smith@example.com",
      };
      usersRepositoryMock.update.mockResolvedValue(user);

      await expect(usersService.update("user-1", input)).resolves.toBe(user);
      expect(usersRepositoryMock.update).toHaveBeenCalledWith("user-1", input);
    });

    it("maps duplicate-email Prisma errors to a 409 AppError", async () => {
      const input = updateUserSchema.parse({ email: "taken@example.com" });
      usersRepositoryMock.update.mockRejectedValue(
        Object.assign(new Error("Unique constraint failed"), {
          code: "P2002",
        }),
      );

      const error = await usersService
        .update("user-1", input)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({ statusCode: 409 });
    });
  });
});
