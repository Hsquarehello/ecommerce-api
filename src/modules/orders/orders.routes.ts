import { Router } from "express";
import { Role } from "../../generated/prisma/enums.js";
import { validateBody, validateParams } from "../../middleware/index.js";
import { authenticate, authorize } from "../auth/auth.middleware.js";
import {
  cancelMyOrder,
  createOrder,
  getAdminOrder,
  getMyOrder,
  listAdminOrders,
  listMyOrders,
  updateOrderStatus,
} from "./orders.controller.js";
import {
  adminOrderListQuerySchema,
  createOrderSchema,
  orderIdSchema,
  orderListQuerySchema,
  updateOrderStatusSchema,
} from "./orders.schema.js";

export const orderRouter = Router();
const adminOnly = [authenticate, authorize(Role.ADMIN)];

orderRouter.post("/", authenticate, validateBody(createOrderSchema), createOrder);
orderRouter.get("/", authenticate, listMyOrders);
orderRouter.get("/admin", ...adminOnly, listAdminOrders);
orderRouter.get(
  "/admin/:id",
  ...adminOnly,
  validateParams(orderIdSchema),
  getAdminOrder,
);
orderRouter.patch(
  "/admin/:id/status",
  ...adminOnly,
  validateParams(orderIdSchema),
  validateBody(updateOrderStatusSchema),
  updateOrderStatus,
);
orderRouter.get("/:id", authenticate, validateParams(orderIdSchema), getMyOrder);
orderRouter.patch(
  "/:id/cancel",
  authenticate,
  validateParams(orderIdSchema),
  cancelMyOrder,
);