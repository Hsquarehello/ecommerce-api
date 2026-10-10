import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { Role } from "../../generated/prisma/enums.js";
import { env } from "../../config/env.js";
import { AppError } from "../../errors/index.js";
import { asyncHandler } from "../../middleware/index.js";
import { authRepository } from "./auth.repository.js";

export const authenticate: RequestHandler = asyncHandler(
  async (request, _response, next) => {
    const match = /^Bearer\s+(\S+)$/i.exec(request.get("authorization") ?? "");
    if (!match?.[1]) throw new AppError("Authentication required", 401);

    let payload: string | jwt.JwtPayload;
    try {
      payload = jwt.verify(match[1], env.JWT_SECRET, {
        issuer: "ecommerce-api",
      });
    } catch {
      throw new AppError("Invalid or expired token", 401);
    }

    if (typeof payload === "string" || !payload.sub) {
      throw new AppError("Invalid or expired token", 401);
    }

    const user = await authRepository.findById(payload.sub);
    if (!user) throw new AppError("Invalid or expired token", 401);

    request.authUser = { id: user.id, role: user.role };
    next();
  },
);

export const authorize =
  (...roles: Role[]): RequestHandler =>
  (request, _response, next) => {
    if (!request.authUser) {
      next(new AppError("Authentication required", 401));
      return;
    }

    if (!roles.includes(request.authUser.role)) {
      next(
        new AppError("You do not have permission to perform this action", 403),
      );
      return;
    }

    next();
  };
