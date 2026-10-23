import { app } from "./app.js";
import { env } from "./config/env.js";
import { connectRedis } from "./config/redis.js";

try {
  await connectRedis();
  if (env.RATE_LIMIT_STORE === "redis") {
    console.log(`Redis connected at ${env.REDIS_URL}`);
  }
} catch (error) {
  console.warn(
    `Could not connect to Redis at ${env.REDIS_URL}. Rate limiting fails open until Redis is reachable; restart the API once Redis is back.`,
    error instanceof Error ? error.message : error,
  );
}

app.listen(env.PORT, () => {
  console.log(`API listening on port ${env.PORT}`);
});
