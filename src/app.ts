import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/index.js";
import { authRouter } from "./modules/auth/index.js";
import { handleStripeWebhook } from "./modules/payments/payments.controller.js";
import { paymentRouter } from "./modules/payments/index.js";
import { productRouter } from "./modules/products/index.js";

export const app = express();
const corsOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim());

app.disable("x-powered-by");
app.use(cors({ origin: corsOrigins }));
app.use(morgan("dev"));
app.use(helmet());
app.post(
  "/api/v1/payments/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook,
);
app.use(express.json());

app.get("/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/payments", paymentRouter);
app.use("/api/v1/products", productRouter);

app.use(notFoundHandler);
app.use(errorHandler);
