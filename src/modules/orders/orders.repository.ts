import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/index.js";
import { OrderStatus } from "../../generated/prisma/enums.js";
import type { OrderListQuery } from "./orders.schema.js";

const orderInclude = {
  orderItems: {
    include: {
      product: {
        select: { id: true, name: true, sku: true, images: true },
      },
    },
  },
  payment: true,
};

export type OrderItemLine = {
  productId: string;
  quantity: number;
  price: number;
};

export const ordersRepository = {
  list(query: OrderListQuery, userId: string | undefined) {
    const where = {
      ...(userId ? { userId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    return Promise.all([
      prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.order.count({ where }),
    ]);
  },

  findById(id: string, userId: string | undefined) {
    return prisma.order.findFirst({
      where: { id, ...(userId ? { userId } : {}) },
      include: orderInclude,
    });
  },

  findProducts(ids: string[]) {
    return prisma.product.findMany({ where: { id: { in: ids } } });
  },

  createWithItems(
    userId: string,
    shippingAddress: string,
    totalAmount: number,
    items: OrderItemLine[],
  ) {
    return prisma.$transaction(async (transaction) => {
      // Decrement stock conditionally so concurrent orders cannot oversell.
      for (const item of items) {
        const result = await transaction.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (result.count === 0) {
          throw new AppError(
            "Insufficient stock for one or more ordered products",
            409,
          );
        }
      }

      return transaction.order.create({
        data: {
          userId,
          shippingAddress,
          totalAmount,
          orderItems: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
            })),
          },
        },
        include: orderInclude,
      });
    });
  },

  cancel(
    orderId: string,
    userId: string | undefined,
    cancellableStatuses: OrderStatus[],
  ) {
    return prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findFirst({
        where: { id: orderId, ...(userId ? { userId } : {}) },
        include: { orderItems: true },
      });

      // The status guard makes cancellation idempotent and race safe.
      if (!order || !cancellableStatuses.includes(order.status)) return null;

      for (const item of order.orderItems) {
        await transaction.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      return transaction.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
        include: orderInclude,
      });
    });
  },

  updateStatus(id: string, status: OrderStatus) {
    return prisma.order.update({
      where: { id },
      data: { status },
      include: orderInclude,
    });
  },
};