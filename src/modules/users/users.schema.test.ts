import { describe, expect, it } from "vitest";
import {
  updateUserSchema,
  userIdSchema,
  usersListQuerySchema,
} from "./users.schema.js";

describe("usersListQuerySchema", () => {
  it("accepts valid pagination parameters", () => {
    expect(
      usersListQuerySchema.parse({
        page: "3",
        limit: "50",
      }),
    ).toMatchObject({ page: 3, limit: 50 });
  });

  it("applies the pagination defaults when omitted", () => {
    expect(usersListQuerySchema.parse({})).toMatchObject({
      page: 1,
      limit: 20,
    });
  });

  it.each(["0", "-1", "1.5", "invalid"])(
    "rejects invalid page value %s",
    (page) => {
      expect(usersListQuerySchema.safeParse({ page }).success).toBe(false);
    },
  );

  it.each(["0", "-1", "1.5", "101", "invalid"])(
    "rejects invalid limit value %s",
    (limit) => {
      expect(usersListQuerySchema.safeParse({ limit }).success).toBe(false);
    },
  );

  it.each(["createdAt", "name", "email"])(
    "accepts sort field %s",
    (sortBy) => {
      expect(
        usersListQuerySchema.safeParse({ sortBy }).success,
      ).toBe(true);
    },
  );

  it("rejects unsupported sort fields", () => {
    expect(
      usersListQuerySchema.safeParse({ sortBy: "role" }).success,
    ).toBe(false);
  });

  it.each(["asc", "desc"])("accepts sort order %s", (sortOrder) => {
    expect(
      usersListQuerySchema.safeParse({ sortOrder }).success,
    ).toBe(true);
  });

  it("rejects unsupported sort orders", () => {
    expect(
      usersListQuerySchema.safeParse({ sortOrder: "up" }).success,
    ).toBe(false);
  });

  it("accepts a non-empty search query and trims surrounding whitespace", () => {
    expect(usersListQuerySchema.parse({ search: "  alice  " }).search).toBe(
      "alice",
    );
  });

  it("rejects an empty or whitespace-only search query", () => {
    expect(usersListQuerySchema.safeParse({ search: "" }).success).toBe(false);
    expect(
      usersListQuerySchema.safeParse({ search: "   " }).success,
    ).toBe(false);
  });

  it("rejects a search query longer than 100 characters", () => {
    expect(
      usersListQuerySchema.safeParse({ search: "a".repeat(101) }).success,
    ).toBe(false);
  });
});

describe("userIdSchema", () => {
  it("accepts a valid UUID ID parameter", () => {
    expect(
      userIdSchema.safeParse({ id: "550e8400-e29b-41d4-a716-446655440000" })
        .success,
    ).toBe(true);
  });

  it("rejects an invalid ID parameter", () => {
    expect(userIdSchema.safeParse({ id: "not-a-uuid" }).success).toBe(false);
  });
});

describe("updateUserSchema", () => {
  it("accepts a valid name update", () => {
    expect(updateUserSchema.parse({ name: "  Alice Smith  " })).toEqual({
      name: "Alice Smith",
    });
  });

  it("accepts a valid email update and normalizes it", () => {
    expect(updateUserSchema.parse({ email: "  ALICE@example.com  " })).toEqual(
      { email: "alice@example.com" },
    );
  });

  it("accepts an update containing both permitted fields", () => {
    expect(
      updateUserSchema.parse({
        name: "Alice Smith",
        email: "alice@example.com",
      }),
    ).toEqual({ name: "Alice Smith", email: "alice@example.com" });
  });

  it("rejects an empty update", () => {
    expect(updateUserSchema.safeParse({}).success).toBe(false);
  });

  it.each(["role", "password", "tokenVersion"])(
    "rejects the protected field %s",
    (field) => {
      expect(
        updateUserSchema.safeParse({ [field]: "not-allowed" }).success,
      ).toBe(false);
    },
  );

  it("rejects other unknown update fields", () => {
    expect(
      updateUserSchema.safeParse({ displayName: "Alice" }).success,
    ).toBe(false);
  });

  it("rejects invalid email formats", () => {
    expect(
      updateUserSchema.safeParse({ email: "not-an-email" }).success,
    ).toBe(false);
  });

  it.each(["", "   "])("rejects an empty name value %j", (name) => {
    expect(updateUserSchema.safeParse({ name }).success).toBe(false);
  });

  it("rejects a name longer than the existing 100-character registration limit", () => {
    expect(
      updateUserSchema.safeParse({ name: "a".repeat(101) }).success,
    ).toBe(false);
  });
});
