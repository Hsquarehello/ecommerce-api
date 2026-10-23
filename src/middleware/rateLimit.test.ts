import { describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// Use the in-memory store so tests do not need a running Redis server.
vi.hoisted(() => {
  process.env.RATE_LIMIT_STORE = "memory";
});

const { createRateLimiter } = await import("./rateLimit.js");

const startTestServer = async (
  registerRoutes: (app: express.Express) => void,
): Promise<{ baseUrl: string; close: () => Promise<void> }> => {
  const app = express();
  registerRoutes(app);

  const server: Server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => {
      resolve(instance);
    });
  });

  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
};

describe("createRateLimiter", () => {
  it("allows requests under the limit and exposes RateLimit headers", async () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      limit: 3,
      prefix: "test:rl:headers:",
    });
    const { baseUrl, close } = await startTestServer((app) => {
      app.use(limiter);
      app.get("/ping", (_request, response) => {
        response.status(200).json({ success: true });
      });
    });

    try {
      const response = await fetch(`${baseUrl}/ping`);

      expect(response.status).toBe(200);
      expect(response.headers.get("ratelimit")).toContain("limit=3");
      expect(response.headers.get("ratelimit")).toContain("remaining=2");
      expect(response.headers.get("ratelimit-policy")).toContain("3;w=60");
      expect(response.headers.get("x-ratelimit-limit")).toBeNull();
    } finally {
      await close();
    }
  });

  it("returns the unified 429 response once the limit is exceeded", async () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      limit: 2,
      prefix: "test:rl:block:",
    });
    const { baseUrl, close } = await startTestServer((app) => {
      app.use(limiter);
      app.get("/ping", (_request, response) => {
        response.status(200).json({ success: true });
      });
    });

    try {
      const first = await fetch(`${baseUrl}/ping`);
      const second = await fetch(`${baseUrl}/ping`);
      const blocked = await fetch(`${baseUrl}/ping`);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(blocked.status).toBe(429);
      expect(blocked.headers.get("retry-after")).toBeTruthy();
      expect(await blocked.json()).toEqual({
        success: false,
        message: "Too many requests, please try again later.",
        data: null,
      });
    } finally {
      await close();
    }
  });

  it("keeps counters independent between limiter prefixes", async () => {
    const strictLimiter = createRateLimiter({
      windowMs: 60_000,
      limit: 1,
      prefix: "test:rl:strict:",
    });
    const lenientLimiter = createRateLimiter({
      windowMs: 60_000,
      limit: 5,
      prefix: "test:rl:lenient:",
    });
    const { baseUrl, close } = await startTestServer((app) => {
      app.use("/strict", strictLimiter);
      app.get("/strict", (_request, response) => {
        response.status(200).json({ success: true });
      });
      app.use("/lenient", lenientLimiter);
      app.get("/lenient", (_request, response) => {
        response.status(200).json({ success: true });
      });
    });

    try {
      const firstStrict = await fetch(`${baseUrl}/strict`);
      const secondStrict = await fetch(`${baseUrl}/strict`);
      const lenient = await fetch(`${baseUrl}/lenient`);

      expect(firstStrict.status).toBe(200);
      expect(secondStrict.status).toBe(429);
      expect(lenient.status).toBe(200);
    } finally {
      await close();
    }
  });
});