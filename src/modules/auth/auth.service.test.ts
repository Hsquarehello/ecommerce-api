import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { authService } from "./auth.service.js";
import { authRepository } from "./auth.repository.js";
import { AppError } from "../../errors/index.js";
import { env } from "../../config/env.js";

const mockUser = {
  id: "user-1",
  email: "test@example.com",
  password: "hashed-password",
  name: "Test User",
  role: "CUSTOMER",
  tokenVersion: 0,
  rememberMe: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const JWT_SECRET = env.JWT_SECRET;

vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn(),
  },
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn(),
  },
}));

vi.mock("./auth.repository.js", () => ({
  authRepository: {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    incrementTokenVersion: vi.fn(),
    createUser: vi.fn(),
  },
}));

const { default: bcryptMock } = await import("bcrypt");
const { default: jwtMock } = await import("jsonwebtoken");
const { authRepository: repoMock } = await import("./auth.repository.js");

describe("authService.login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a 1-hour token when rememberMe is false", async () => {
    (repoMock.findByEmail as any).mockResolvedValue(mockUser);
    (bcryptMock.compare as any).mockResolvedValue(true);
    (jwtMock.sign as any).mockReturnValue("short-token");

    const result = await authService.login({
      email: "test@example.com",
      password: "secret",
      rememberMe: false,
    });

    expect(result).toEqual({
      user: expect.objectContaining({ id: "user-1", email: "test@example.com" }),
      token: "short-token",
    });
    expect(jwtMock.sign).toHaveBeenCalledTimes(1);
    const [payload, secret, options] = (jwtMock.sign as any).mock.calls[0];
    expect(payload).toEqual({ tokenVersion: mockUser.tokenVersion });
    expect(secret).toBe(JWT_SECRET);
    expect(options.expiresIn).toBe("1h");
  });

  it("returns a 30-day token when rememberMe is true", async () => {
    (repoMock.findByEmail as any).mockResolvedValue(mockUser);
    (bcryptMock.compare as any).mockResolvedValue(true);
    (jwtMock.sign as any).mockReturnValue("long-token");

    const result = await authService.login({
      email: "test@example.com",
      password: "secret",
      rememberMe: true,
    });

    expect(result).toEqual({
      user: expect.objectContaining({ id: "user-1", email: "test@example.com" }),
      token: "long-token",
    });
    expect(jwtMock.sign).toHaveBeenCalledTimes(1);
    const [payload, secret, options] = (jwtMock.sign as any).mock.calls[0];
    expect(payload).toEqual({ tokenVersion: mockUser.tokenVersion });
    expect(secret).toBe(JWT_SECRET);
    expect(options.expiresIn).toBe("30d");
  });

  it("returns a 1-hour token when rememberMe is omitted", async () => {
    (repoMock.findByEmail as any).mockResolvedValue(mockUser);
    (bcryptMock.compare as any).mockResolvedValue(true);
    (jwtMock.sign as any).mockReturnValue("default-token");

    const result = await authService.login({
      email: "test@example.com",
      password: "secret",
    });

    expect(result).toEqual({
      user: expect.objectContaining({ id: "user-1", email: "test@example.com" }),
      token: "default-token",
    });
    expect(jwtMock.sign).toHaveBeenCalledTimes(1);
    const [payload, secret, options] = (jwtMock.sign as any).mock.calls[0];
    expect(payload).toEqual({ tokenVersion: mockUser.tokenVersion });
    expect(secret).toBe(JWT_SECRET);
    expect(options.expiresIn).toBe("1h");
  });

  it("throws 401 when the user is not found", async () => {
    (repoMock.findByEmail as any).mockResolvedValue(null);

    await expect(
      authService.login({ email: "nope@example.com", password: "secret" }),
    ).rejects.toThrow(AppError);
    await expect(
      authService.login({ email: "nope@example.com", password: "secret" }),
    ).rejects.toThrow("Invalid email or password");
    expect((repoMock.findByEmail as any).mock.calls.length).toBe(2);
    expect((bcryptMock.compare as any).mock.calls.length).toBe(0);
    expect(jwtMock.sign).not.toHaveBeenCalled();
  });

  it("throws 401 when the password is incorrect", async () => {
    (repoMock.findByEmail as any).mockResolvedValue(mockUser);
    (bcryptMock.compare as any).mockResolvedValue(false);

    await expect(
      authService.login({
        email: "test@example.com",
        password: "wrong",
      }),
    ).rejects.toThrow(AppError);

    await expect(
      authService.login({
        email: "test@example.com",
        password: "wrong",
      }),
    ).rejects.toThrow("Invalid email or password");
    expect((bcryptMock.compare as any).mock.calls.length).toBe(2);
    expect(jwtMock.sign).not.toHaveBeenCalled();
  });

  it("does not call the repository with rememberMe when it is omitted", async () => {
    (repoMock.findByEmail as any).mockResolvedValue(mockUser);
    (bcryptMock.compare as any).mockResolvedValue(true);

    await authService.login({ email: "test@example.com", password: "secret" });

    expect((repoMock.findByEmail as any).mock.calls.length).toBe(1);
    const [input] = (repoMock.findByEmail as any).mock.calls[0];
    expect(input).toBe("test@example.com");
  });
});
