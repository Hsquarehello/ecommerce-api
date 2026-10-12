import { Router } from "express";
import { validateBody, validateParams } from "../../middleware/index.js";
import { authenticate } from "../auth/auth.middleware.js";
import {
  addItemToCart,
  checkoutCart,
  clearCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from "./carts.controller.js";
import {
  addCartItemSchema,
  cartProductIdSchema,
  checkoutCartSchema,
  updateCartItemSchema,
} from "./carts.schema.js";

export const cartRouter = Router();

cartRouter.get("/", authenticate, getCart);
cartRouter.post(
  "/items",
  authenticate,
  validateBody(addCartItemSchema),
  addItemToCart,
);
cartRouter.patch(
  "/items/:productId",
  authenticate,
  validateParams(cartProductIdSchema),
  validateBody(updateCartItemSchema),
  updateCartItem,
);
cartRouter.delete(
  "/items/:productId",
  authenticate,
  validateParams(cartProductIdSchema),
  removeCartItem,
);
cartRouter.delete("/", authenticate, clearCart);
cartRouter.post(
  "/checkout",
  authenticate,
  validateBody(checkoutCartSchema),
  checkoutCart,
);