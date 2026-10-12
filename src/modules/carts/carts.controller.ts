import type { RequestHandler } from "express";
import { asyncHandler } from "../../middleware/index.js";
import { cartsService } from "./carts.service.js";

export const getCart: RequestHandler = asyncHandler(
  async (request, response) => {
    const cart = await cartsService.get(request.authUser!.id);
    response.status(200).json({
      success: true,
      message: "Cart fetched successfully",
      data: cart,
    });
  },
);

export const addItemToCart: RequestHandler = asyncHandler(
  async (request, response) => {
    const cart = await cartsService.addItem(request.authUser!.id, request.body);
    response.status(200).json({
      success: true,
      message: "Cart item added successfully",
      data: cart,
    });
  },
);

export const updateCartItem: RequestHandler = asyncHandler(
  async (request, response) => {
    const cart = await cartsService.updateItem(
      request.authUser!.id,
      request.params.productId as string,
      request.body,
    );
    response.status(200).json({
      success: true,
      message: "Cart item updated successfully",
      data: cart,
    });
  },
);

export const removeCartItem: RequestHandler = asyncHandler(
  async (request, response) => {
    const cart = await cartsService.removeItem(
      request.authUser!.id,
      request.params.productId as string,
    );
    response.status(200).json({
      success: true,
      message: "Cart item removed successfully",
      data: cart,
    });
  },
);

export const clearCart: RequestHandler = asyncHandler(
  async (request, response) => {
    const cart = await cartsService.clear(request.authUser!.id);
    response.status(200).json({
      success: true,
      message: "Cart cleared successfully",
      data: cart,
    });
  },
);

export const checkoutCart: RequestHandler = asyncHandler(
  async (request, response) => {
    const order = await cartsService.checkout(
      request.authUser!.id,
      request.body,
    );
    response.status(201).json({
      success: true,
      message: "Cart checked out successfully",
      data: order,
    });
  },
);
