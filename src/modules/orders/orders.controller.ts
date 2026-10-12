import type { RequestHandler } from "express";
import { asyncHandler } from "../../middleware/index.js";
import {
  adminOrderListQuerySchema,
  orderListQuerySchema,
} from "./orders.schema.js";
import { ordersService } from "./orders.service.js";

export const createOrder: RequestHandler = asyncHandler(
  async (request, response) => {
    const order = await ordersService.create(
      request.authUser!.id,
      request.body,
    );
    response.status(201).json({
      success: true,
      message: "Order created successfully",
      data: order,
    });
  },
);

export const listMyOrders: RequestHandler = asyncHandler(
  async (request, response) => {
    const query = orderListQuerySchema.parse(request.query);
    const result = await ordersService.listMine(request.authUser!.id, query);
    response.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      data: result.items,
      pagination: result.pagination,
    });
  },
);

export const getMyOrder: RequestHandler = asyncHandler(
  async (request, response) => {
    const order = await ordersService.getMine(
      request.authUser!.id,
      request.params.id as string,
    );
    response.status(200).json({
      success: true,
      message: "Order fetched successfully",
      data: order,
    });
  },
);

export const cancelMyOrder: RequestHandler = asyncHandler(
  async (request, response) => {
    const order = await ordersService.cancelMine(
      request.authUser!.id,
      request.params.id as string,
    );
    response.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: order,
    });
  },
);

export const listAdminOrders: RequestHandler = asyncHandler(
  async (request, response) => {
    const query = adminOrderListQuerySchema.parse(request.query);
    const result = await ordersService.listAll(query);
    response.status(200).json({
      success: true,
      message: "Admin orders fetched successfully",
      data: result.items,
      pagination: result.pagination,
    });
  },
);

export const getAdminOrder: RequestHandler = asyncHandler(
  async (request, response) => {
    const order = await ordersService.getAny(request.params.id as string);
    response.status(200).json({
      success: true,
      message: "Admin order fetched successfully",
      data: order,
    });
  },
);

export const updateOrderStatus: RequestHandler = asyncHandler(
  async (request, response) => {
    const order = await ordersService.updateStatus(
      request.params.id as string,
      request.body,
    );
    response.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: order,
    });
  },
);
