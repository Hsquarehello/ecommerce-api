import { AppError } from "../../errors/index.js";
import { usersRepository } from "./users.repository.js";
import type {
  UpdateUserInput,
  UsersListQuery,
} from "./users.schema.js";

const isPrismaError = (error: unknown, code: string) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === code;

const mapUserError = (error: unknown): never => {
  if (isPrismaError(error, "P2002")) {
    throw new AppError("A user with this email already exists", 409);
  }
  if (isPrismaError(error, "P2025")) {
    throw new AppError("User not found", 404);
  }
  throw error;
};

export const usersService = {
  async list(query: UsersListQuery) {
    const [items, total] = await usersRepository.list(query);
    const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalItems: total,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPrevPage: query.page > 1 && totalPages > 0,
      },
    };
  },

  async getById(id: string) {
    const user = await usersRepository.findById(id);
    if (!user) throw new AppError("User not found", 404);
    return user;
  },

  async update(id: string, input: UpdateUserInput) {
    try {
      return await usersRepository.update(id, input);
    } catch (error) {
      return mapUserError(error);
    }
  },
};
