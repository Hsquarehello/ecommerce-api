import { Router } from "express";
import { validateBody } from "../../middleware/index.js";
import { authenticate } from "../auth/auth.middleware.js";
import { createCheckoutSession } from "./payments.controller.js";
import { createCheckoutSchema } from "./payments.schema.js";

export const paymentRouter = Router();

paymentRouter.post(
  "/checkout-session",
  authenticate,
  validateBody(createCheckoutSchema),
  createCheckoutSession,
);
