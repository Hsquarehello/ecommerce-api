import { z } from "zod";
import { OrderStatus } from "../../generated/prisma/enums.js";

const orderItemSchema = z
  .object({
    productId: z.uuid(),
    quantity: z.coerce.number().int().min(1).max(999),
  })
  .strict();

export const createOrderSchema = z
  .object({
    items: z.array(orderItemSchema).min(1).max(50),
    shippingAddress: z.string().trim().min(1).max(500),
  })
  .strict();

export const updateOrderStatusSchema = z
  .object({ status: z.enum(OrderStatus) })
  .strict();

export const orderIdSchema = z.object({ id: z.uuid() });

const orderListFields = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(OrderStatus).optional(),
  sortBy: z.enum(["createdAt", "totalAmount"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
};

export const orderListQuerySchema = z.object(orderListFields).strict();

export const adminOrderListQuerySchema = z
  .object({
    ...orderListFields,
    userId: z.uuid().optional(),
  })
  .strict();

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
export type AdminOrderListQuery = z.infer<typeof adminOrderListQuerySchema>;