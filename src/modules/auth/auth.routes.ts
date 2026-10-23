import { Router } from "express";
import { getCurrentUser, login, logout, register } from "./auth.controller.js";
import { loginSchema, registerSchema } from "./auth.schema.js";
import { authLimiter, validateBody } from "../../middleware/index.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  authLimiter,
  validateBody(registerSchema),
  register,
);
authRouter.post("/login", authLimiter, validateBody(loginSchema), login);
authRouter.post("/logout", logout);
authRouter.get("/me", getCurrentUser);
