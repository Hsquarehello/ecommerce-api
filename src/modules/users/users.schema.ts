import { z } from "zod";

export const userIdSchema = z.object({ id: z.uuid() }).strict();

export const usersListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(100).optional(),
    sortBy: z.enum(["createdAt", "name", "email"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    email: z.string().trim().email().toLowerCase(),
  })
  .partial()
  .strict()
  .refine((user) => Object.keys(user).length > 0, {
    message: "At least one user field must be provided",
  });

export type UserIdParams = z.infer<typeof userIdSchema>;
export type UsersListQuery = z.infer<typeof usersListQuerySchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
