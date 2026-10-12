import { prisma } from "../../config/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";

const cartInclude = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          images: true,
          price: true,
          stock: true,
          status: true,
        },
      },
    },
  },
};

export type CartWithItems = Prisma.CartGetPayload<{
  include: typeof cartInclude;
}>;

export const cartsRepository = {
  ensureCart(userId: string) {
    return prisma.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  },

  findCart(userId: string) {
    return prisma.cart.findUnique({ where: { userId } });
  },

  findCartWithItems(userId: string) {
    return prisma.cart.findUnique({
      where: { userId },
      include: cartInclude,
    });
  },

  findProduct(productId: string) {
    return prisma.product.findUnique({ where: { id: productId } });
  },

  findItem(cartId: string, productId: string) {
    return prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId, productId } },
    });
  },

  addItem(cartId: string, productId: string, quantity: number) {
    return prisma.cartItem.upsert({
      where: { cartId_productId: { cartId, productId } },
      create: { cartId, productId, quantity },
      update: { quantity: { increment: quantity } },
    });
  },

  setItemQuantity(cartId: string, productId: string, quantity: number) {
    return prisma.cartItem.updateMany({
      where: { cartId, productId },
      data: { quantity },
    });
  },

  removeItem(cartId: string, productId: string) {
    return prisma.cartItem.deleteMany({ where: { cartId, productId } });
  },

  clearItems(cartId: string) {
    return prisma.cartItem.deleteMany({ where: { cartId } });
  },

  // Runs the order creation and the cart clearing inside one transaction so
  // a checkout either fully succeeds or fully rolls back.
  checkout<T>(
    cartId: string,
    createOrder: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(async (transaction) => {
      const order = await createOrder(transaction);
      await transaction.cartItem.deleteMany({ where: { cartId } });
      return order;
    });
  },
};