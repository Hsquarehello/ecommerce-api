import { Router } from "express";
import { getCurrentUser, login, logout, register } from "./auth.controller.js";
import { loginSchema, registerSchema } from "./auth.schema.js";
import { validateBody } from "../../middleware/index.js";

export const authRouter = Router();

authRouter.post("/register", validateBody(registerSchema), register);
authRouter.post("/login", validateBody(loginSchema), login);
authRouter.post("/logout", logout);
authRouter.get("/me", getCurrentUser);
