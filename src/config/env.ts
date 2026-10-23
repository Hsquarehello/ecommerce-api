import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  JWT_SECRET: z.string().min(32),
  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  STRIPE_CURRENCY: z
    .string()
    .regex(/^[a-z]{3}$/i)
    .transform((currency) => currency.toLowerCase())
    .default("usd"),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  RATE_LIMIT_STORE: z.enum(["redis", "memory"]).default("redis"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  TRUST_PROXY: z.string().default(""),
});

export const env = envSchema.parse(process.env);
