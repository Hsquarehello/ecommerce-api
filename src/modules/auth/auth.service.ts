import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AppError } from "../../errors/index.js";
import { env } from "../../config/env.js";
import { authRepository } from "./auth.repository.js";
import type { LoginInput, RegisterInput } from "./auth.schema.js";

const toPublicUser = <T extends { password: string }>(user: T) => {
  const { password: _password, ...publicUser } = user;
  return publicUser;
};

const createToken = (user: { id: string }) =>
  jwt.sign({}, env.JWT_SECRET, {
    subject: user.id,
    issuer: "ecommerce-api",
    expiresIn: "1h",
  });

const isUniqueConstraintError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";

export const authService = {
  async register(input: RegisterInput) {
    if (await authRepository.findByEmail(input.email)) {
      throw new AppError("An account with this email already exists", 409);
    }

    const password = await bcrypt.hash(input.password, 12);
    let user;

    try {
      user = await authRepository.createUser({ ...input, password });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppError("An account with this email already exists", 409);
      }
      throw error;
    }

    return { user: toPublicUser(user), token: createToken(user) };
  },

  async login(input: LoginInput) {
    const user = await authRepository.findByEmail(input.email);
    if (!user || !(await bcrypt.compare(input.password, user.password))) {
      throw new AppError("Invalid email or password", 401);
    }

    return { user: toPublicUser(user), token: createToken(user) };
  },

  async getProfile(id: string) {
    const user = await authRepository.findById(id);
    if (!user) throw new AppError("User not found", 404);
    return toPublicUser(user);
  },
};
