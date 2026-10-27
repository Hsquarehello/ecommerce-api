import type { RequestHandler } from "express";
import { asyncHandler } from "../../middleware/index.js";
import { usersListQuerySchema } from "./users.schema.js";
import { usersService } from "./users.service.js";

export const listUsers: RequestHandler = asyncHandler(
  async (request, response) => {
    const query = usersListQuerySchema.parse(request.query);
    const result = await usersService.list(query);
    response.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: result.items,
      pagination: result.pagination,
    });
  },
);

export const getUserById: RequestHandler = asyncHandler(
  async (request, response) => {
    const user = await usersService.getById(request.params.id as string);
    response.status(200).json({
      success: true,
      message: "User fetched successfully",
      data: user,
    });
  },
);

export const updateUser: RequestHandler = asyncHandler(
  async (request, response) => {
    const user = await usersService.update(
      request.params.id as string,
      request.body,
    );
    response.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  },
);
