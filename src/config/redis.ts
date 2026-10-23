import { createClient } from "redis";
import { env } from "./env.js";

export const redisClient = createClient({
  url: env.REDIS_URL,
  // RESP2 keeps compatibility with Redis 5.x servers (for example the
  // Windows port); node-redis v6 would otherwise negotiate RESP3 via `HELLO`.
  RESP: 2,
  socket: {
    // Stop reconnecting after a few attempts so the API can start even when
    // Redis is down (rate limiting then fails open).
    reconnectStrategy: (retries) => {
      if (retries > 3) {
        return new Error(
          `Could not connect to Redis after ${retries} attempts`,
        );
      }
      return Math.min(100 * 2 ** retries, 1_000);
    },
  },
});

redisClient.on("error", (error) => {
  console.error(`Redis client error: ${error.message || error.name}`);
});

let connectionPromise: Promise<void> | null = null;

function ensureConnected(): Promise<void> {
  if (!connectionPromise) {
    const promise = redisClient.connect().then(() => undefined);
    // Avoid an unhandled rejection when the initial connection fails before
    // connectRedis() attaches its handler; awaiters still see the rejection.
    promise.catch(() => undefined);
    connectionPromise = promise;
  }

  return connectionPromise;
}

// Start connecting at module load: rate limiter stores initialize (SCRIPT
// LOAD) while the app module graph is still being imported, and node-redis
// queues commands issued while a connect() call is in flight.
if (env.RATE_LIMIT_STORE === "redis") {
  ensureConnected();
}

/**
 * Resolves once the shared Redis client used by the rate limiter store is
 * connected. Resolves immediately when the rate limiter is configured to use
 * the in-memory store instead of Redis.
 */
export function connectRedis(): Promise<void> {
  if (env.RATE_LIMIT_STORE !== "redis") {
    return Promise.resolve();
  }

  return ensureConnected();
}