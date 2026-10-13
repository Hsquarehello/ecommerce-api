import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AppError } from "../../errors/index.js";
import { env } from "../../config/env.js";
import { authRepository } from "./auth.repository.js";
import type { LoginInput, RegisterInput } from "./auth.schema.js";

const toPublicUser = <T extends { password: string; tokenVersion: number }>(
  user: T,
) => {
  const {
    password: _password,
    tokenVersion: _tokenVersion,
    ...publicUser
  } = user;
  return publicUser;
};

const createToken = (user: { id: string; tokenVersion: number }) =>
  jwt.sign({ tokenVersion: user.tokenVersion }, env.JWT_SECRET, {
    subject: user.id,
    issuer: "ecommerce-api",
    expiresIn: "1h",
  });

const isUniqueConstraintError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";

/**
 * Best-effort token check: extracts and verifies the bearer token from an
 * Authorization header. Returns the decoded payload, or null when the
 * header or token is missing, malformed, expired or invalid.
 */
const verifyBearerToken = (authorization?: string): jwt.JwtPayload | null => {
  const match = /^Bearer\s+(\S+)$/i.exec(authorization ?? "");
  const token = match?.[1];
  if (!token) return null;

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: "ecommerce-api",
    });
    return typeof payload === "string" ? null : payload;
  } catch {
    return null;
  }
};

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

  /**
   * Simple, frontend-friendly profile lookup: always resolves.
   * Returns the public user when a valid token identifies one,
   * otherwise null. Never throws a 401.
   */
  async getProfile(authorization?: string) {
    const payload = verifyBearerToken(authorization);
    if (!payload?.sub) return null;

    const user = await authRepository.findById(payload.sub);
    if (!user) return null;
    if (
      typeof payload.tokenVersion === "number" &&
      payload.tokenVersion !== user.tokenVersion
    ) {
      return null;
    }

    return toPublicUser(user);
  },

  /**
   * Best-effort logout: always succeeds so the frontend can simply
   * call POST /auth/logout and clear its token. If a valid bearer
   * token is provided, it is revoked server-side.
   */
  async logout(authorization?: string) {
    const payload = verifyBearerToken(authorization);
    if (!payload?.sub) return;

    try {
      await authRepository.incrementTokenVersion(payload.sub);
    } catch {
      // User no longer exists: nothing to revoke.
    }
  },
};