import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaUserMocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    user: prismaUserMocks,
  },
}));

import { usersRepository } from "./users.repository.js";
import {
  updateUserSchema,
  usersListQuerySchema,
} from "./users.schema.js";

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
};

describe("usersRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("returns the page of users and total count using the requested pagination and sort", async () => {
      const query = usersListQuerySchema.parse({
        page: "2",
        limit: "10",
        sortBy: "name",
        sortOrder: "asc",
      });
      const users = [{ id: "user-1", name: "Alice" }];
      prismaUserMocks.findMany.mockResolvedValue(users);
      prismaUserMocks.count.mockResolvedValue(21);

      await expect(usersRepository.list(query)).resolves.toEqual([users, 21]);
      expect(prismaUserMocks.findMany).toHaveBeenCalledWith({
        where: {},
        select: safeUserSelect,
        orderBy: { name: "asc" },
        skip: 10,
        take: 10,
      });
      expect(prismaUserMocks.count).toHaveBeenCalledWith({ where: {} });
    });

    it("filters case-insensitively across name and email when search is provided", async () => {
      const query = usersListQuerySchema.parse({ search: "alice" });
      prismaUserMocks.findMany.mockResolvedValue([]);
      prismaUserMocks.count.mockResolvedValue(0);

      await usersRepository.list(query);

      const expectedWhere = {
        OR: [
          { name: { contains: "alice", mode: "insensitive" } },
          { email: { contains: "alice", mode: "insensitive" } },
        ],
      };
      expect(prismaUserMocks.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(prismaUserMocks.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });
    });

    it("does not select password hashes or token versions", async () => {
      const query = usersListQuerySchema.parse({});
      prismaUserMocks.findMany.mockResolvedValue([]);
      prismaUserMocks.count.mockResolvedValue(0);

      await usersRepository.list(query);

      const findManyArgs = prismaUserMocks.findMany.mock.calls[0]?.[0];
      expect(findManyArgs?.select).toEqual(safeUserSelect);
      expect(findManyArgs?.select).not.toHaveProperty("password");
      expect(findManyArgs?.select).not.toHaveProperty("tokenVersion");
    });
  });

  describe("findById", () => {
    it("looks up a user by ID and selects only response-safe fields", async () => {
      const user = {
        id: "user-1",
        name: "Alice",
        email: "alice@example.com",
        role: "CUSTOMER",
      };
      prismaUserMocks.findUnique.mockResolvedValue(user);

      await expect(usersRepository.findById("user-1")).resolves.toBe(user);
      expect(prismaUserMocks.findUnique).toHaveBeenCalledWith({
        where: { id: "user-1" },
        select: safeUserSelect,
      });
    });
  });

  describe("update", () => {
    it("updates only the permitted fields and selects response-safe fields", async () => {
      const input = updateUserSchema.parse({
        name: "Alice Smith",
        email: "alice@example.com",
      });
      const user = {
        id: "user-1",
        name: "Alice Smith",
        email: "alice@example.com",
      };
      prismaUserMocks.update.mockResolvedValue(user);

      await expect(
        usersRepository.update("user-1", input),
      ).resolves.toBe(user);
      expect(prismaUserMocks.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { name: "Alice Smith", email: "alice@example.com" },
        select: safeUserSelect,
      });
    });

    it("omits unprovided permitted fields from the Prisma update data", async () => {
      const input = updateUserSchema.parse({ name: "Alice Smith" });
      prismaUserMocks.update.mockResolvedValue({});

      await usersRepository.update("user-1", input);

      expect(prismaUserMocks.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { name: "Alice Smith" } }),
      );
    });
  });
});
