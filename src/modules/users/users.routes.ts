import { Router } from "express";
import { Role } from "../../generated/prisma/enums.js";
import {
  usersLimiter,
  validateBody,
  validateParams,
} from "../../middleware/index.js";
import { authenticate, authorize } from "../auth/auth.middleware.js";
import {
  getUserById,
  listUsers,
  updateUser,
} from "./users.controller.js";
import { updateUserSchema, userIdSchema } from "./users.schema.js";

export const usersRouter = Router();
usersRouter.use(authenticate, authorize(Role.ADMIN), usersLimiter);

usersRouter.get("/", listUsers);
usersRouter.get(
  "/:id",
  validateParams(userIdSchema),
  getUserById,
);
usersRouter.patch(
  "/:id",
  validateParams(userIdSchema),
  validateBody(updateUserSchema),
  updateUser,
);
