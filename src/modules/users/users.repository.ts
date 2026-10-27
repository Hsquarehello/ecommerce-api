import { prisma } from "../../config/prisma.js";
import type { UpdateUserInput, UsersListQuery } from "./users.schema.js";

const userResponseSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const usersRepository = {
  list(query: UsersListQuery) {
    const where = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" as const } },
            { email: { contains: query.search, mode: "insensitive" as const } },
          ],
        }
      : {};

    return Promise.all([
      prisma.user.findMany({
        where,
        select: userResponseSelect,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.user.count({ where }),
    ]);
  },

  findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: userResponseSelect,
    });
  },

  update(id: string, input: UpdateUserInput) {
    const data = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
    };

    return prisma.user.update({
      where: { id },
      data,
      select: userResponseSelect,
    });
  },
};
