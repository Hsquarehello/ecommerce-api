import {
  rateLimit,
  type RateLimitExceededEventHandler,
} from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import { env } from "../config/env.js";
import { redisClient } from "../config/redis.js";

const TOO_MANY_REQUESTS_MESSAGE = "Too many requests, please try again later.";

/**
 * Responds with the project's unified error format once a client exceeds
 * its quota. `Retry-After` and the `RateLimit-*` headers are set by
 * express-rate-limit before this handler runs.
 */
const handler: RateLimitExceededEventHandler = (_request, response) => {
  response.status(429).json({
    success: false,
    message: TOO_MANY_REQUESTS_MESSAGE,
    data: null,
  });
};

export interface CreateRateLimiterOptions {
  windowMs: number;
  limit: number;
  prefix: string;
}

/**
 * Creates an IP-based rate limiter. Counters are stored in Redis so that
 * limits are shared across application instances; when
 * `RATE_LIMIT_STORE=memory` the built-in per-process store is used instead
 * (useful for tests and local development without Redis).
 */
export const createRateLimiter = ({
  windowMs,
  limit,
  prefix,
}: CreateRateLimiterOptions): ReturnType<typeof rateLimit> => {
  const useRedisStore = env.RATE_LIMIT_STORE === "redis";

  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler,
    ...(useRedisStore
      ? {
          // Fail open during a Redis outage instead of erroring every
          // request; express-rate-limit logs the store error for us.
          passOnStoreError: true,
          store: new RedisStore({
            prefix,
            sendCommand: (...args: string[]) =>
              redisClient.sendCommand(args) as Promise<RedisReply>,
          }),
        }
      : {}),
  });
};

/**
 * Global limiter applied to every `/api/v1` route (auth routes count
 * against it in addition to the stricter auth limiter).
 */
export const apiLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  prefix: "rl:api:",
});

/**
 * Stricter limiter for the credential endpoints (`/auth/register` and
 * `/auth/login`) to slow down brute-force attacks.
 */
export const authLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_AUTH_MAX,
  prefix: "rl:auth:",
});