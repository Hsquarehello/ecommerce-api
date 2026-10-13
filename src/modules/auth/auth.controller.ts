import type { RequestHandler } from "express";
import { asyncHandler } from "../../middleware/index.js";
import { authService } from "./auth.service.js";

export const register: RequestHandler = asyncHandler(
  async (request, response) => {
    const result = await authService.register(request.body);
    response.status(201).json({
      success: true,
      message: "User registered successfully",
      data: result,
    });
  },
);

export const login: RequestHandler = asyncHandler(async (request, response) => {
  const result = await authService.login(request.body);
  response.status(200).json({
    success: true,
    message: "Login successful",
    data: result,
  });
});

export const getCurrentUser: RequestHandler = asyncHandler(
  async (request, response) => {
    const user = await authService.getProfile(request.get("authorization"));
    response.status(200).json({
      success: true,
      message: user ? "Profile fetched successfully" : "Not authenticated",
      data: user,
    });
  },
);

export const logout: RequestHandler = asyncHandler(
  async (request, response) => {
    await authService.logout(request.get("authorization"));
    response.status(200).json({
      success: true,
      message: "Logout successful",
    });
  },
);
