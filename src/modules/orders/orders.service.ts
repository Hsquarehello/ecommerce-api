import { AppError } from "../../errors/index.js";
import { OrderStatus, ProductStatus } from "../../generated/prisma/enums.js";
import { ordersRepository } from "./orders.repository.js";
import type {
  AdminOrderListQuery,
  CreateOrderInput,
  OrderListQuery,
  UpdateOrderStatusInput,
} from "./orders.schema.js";

const isPrismaError = (error: unknown, code: string) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === code;

const mapOrderError = (error: unknown): never => {
  if (isPrismaError(error, "P2003")) {
    throw new AppError("One or more related records do not exist", 400);
  }
  if (isPrismaError(error, "P2025")) {
    throw new AppError("Order not found", 404);
  }
  throw error;
};

// Allowed admin status changes; CANCELLED is reachable from PENDING and PAID.
const statusTransitions: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

const list = async (query: OrderListQuery, userId: string | undefined) => {
  const [items, total] = await ordersRepository.list(query, userId);
  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

const mergeDuplicateItems = (items: CreateOrderInput["items"]) => {
  const quantities = new Map<string, number>();
  for (const item of items) {
    quantities.set(
      item.productId,
      (quantities.get(item.productId) ?? 0) + item.quantity,
    );
  }
  return [...quantities].map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
};

const cancelOrder = async (
  orderId: string,
  userId: string | undefined,
  cancellableStatuses: OrderStatus[],
  notAllowedMessage: string,
) => {
  const order = await ordersRepository.findById(orderId, userId);
  if (!order) throw new AppError("Order not found", 404);
  if (!cancellableStatuses.includes(order.status)) {
    throw new AppError(notAllowedMessage, 409);
  }

  const cancelled = await ordersRepository.cancel(
    orderId,
    userId,
    cancellableStatuses,
  );
  if (!cancelled) {
    throw new AppError("The order can no longer be cancelled", 409);
  }
  return cancelled;
};

export const ordersService = {
  async create(userId: string, input: CreateOrderInput) {
    const items = mergeDuplicateItems(input.items);
    const products = await ordersRepository.findProducts(
      items.map((item) => item.productId),
    );
    const productById = new Map(products.map((product) => [product.id, product]));

    // Prices are captured server-side and totals are computed in integer
    // cents to avoid floating point drift.
    let totalCents = 0;
    const pricedItems = items.map((item) => {
      const product = productById.get(item.productId);
      if (!product) {
        throw new AppError("One or more ordered products do not exist", 400);
      }
      if (product.status !== ProductStatus.ACTIVE) {
        throw new AppError(
          `Product "${product.name}" is not available for purchase`,
          400,
        );
      }
      if (product.stock < item.quantity) {
        throw new AppError(`Insufficient stock for "${product.name}"`, 409);
      }

      const priceCents = Math.round(Number(product.price) * 100);
      totalCents += priceCents * item.quantity;
      return { ...item, price: priceCents / 100 };
    });

    try {
      return await ordersRepository.createWithItems(
        userId,
        input.shippingAddress,
        totalCents / 100,
        pricedItems,
      );
    } catch (error) {
      return mapOrderError(error);
    }
  },

  listMine(userId: string, query: OrderListQuery) {
    return list(query, userId);
  },

  async getMine(userId: string, id: string) {
    const order = await ordersRepository.findById(id, userId);
    if (!order) throw new AppError("Order not found", 404);
    return order;
  },

  cancelMine(userId: string, id: string) {
    return cancelOrder(
      id,
      userId,
      [OrderStatus.PENDING],
      "Only pending orders can be cancelled",
    );
  },

  listAll(query: AdminOrderListQuery) {
    return list(query, query.userId);
  },

  async getAny(id: string) {
    const order = await ordersRepository.findById(id, undefined);
    if (!order) throw new AppError("Order not found", 404);
    return order;
  },

  async updateStatus(id: string, input: UpdateOrderStatusInput) {
    const order = await ordersRepository.findById(id, undefined);
    if (!order) throw new AppError("Order not found", 404);
    if (order.status === input.status) return order;

    const allowedStatuses = statusTransitions[order.status];
    if (!allowedStatuses.includes(input.status)) {
      throw new AppError(
        `Cannot change order status from ${order.status} to ${input.status}`,
        409,
      );
    }

    if (input.status === OrderStatus.CANCELLED) {
      const cancelled = await ordersRepository.cancel(
        id,
        undefined,
        [order.status],
      );
      if (!cancelled) {
        throw new AppError("The order can no longer be cancelled", 409);
      }
      return cancelled;
    }

    try {
      return await ordersRepository.updateStatus(id, input.status);
    } catch (error) {
      return mapOrderError(error);
    }
  },
};