import { AppError } from "../../errors/index.js";
import { ProductStatus } from "../../generated/prisma/enums.js";
import { mapOrderError, ordersService } from "../orders/orders.service.js";
import { cartsRepository } from "./carts.repository.js";
import type { CartWithItems } from "./carts.repository.js";
import type {
  AddCartItemInput,
  CheckoutCartInput,
  UpdateCartItemInput,
} from "./carts.schema.js";

const formatCents = (cents: number) => (cents / 100).toFixed(2);

type CartItemView = {
  id: string;
  productId: string;
  quantity: number;
  lineTotal: string;
  product: CartWithItems["items"][number]["product"];
};

type CartView = {
  id: string | null;
  items: CartItemView[];
  totalQuantity: number;
  totalAmount: string;
};

const emptyCartView = (): CartView => ({
  id: null,
  items: [],
  totalQuantity: 0,
  totalAmount: formatCents(0),
});

const toCartView = (cart: CartWithItems): CartView => {
  // Totals are computed in integer cents to avoid floating point drift.
  let totalCents = 0;
  let totalQuantity = 0;

  const items = cart.items.map((item) => {
    const priceCents = Math.round(Number(item.product.price) * 100);
    const lineTotalCents = priceCents * item.quantity;
    totalCents += lineTotalCents;
    totalQuantity += item.quantity;
    return {
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      lineTotal: formatCents(lineTotalCents),
      product: item.product,
    };
  });

  return {
    id: cart.id,
    items,
    totalQuantity,
    totalAmount: formatCents(totalCents),
  };
};

const getCartView = async (userId: string): Promise<CartView> => {
  const cart = await cartsRepository.findCartWithItems(userId);
  return cart ? toCartView(cart) : emptyCartView();
};

const requireAvailableProduct = async (productId: string, quantity: number) => {
  const product = await cartsRepository.findProduct(productId);
  if (!product) throw new AppError("Product does not exist", 400);
  if (product.status !== ProductStatus.ACTIVE) {
    throw new AppError(
      `Product "${product.name}" is not available for purchase`,
      400,
    );
  }
  if (product.stock < quantity) {
    throw new AppError(`Insufficient stock for "${product.name}"`, 409);
  }
};

export const cartsService = {
  get(userId: string) {
    return getCartView(userId);
  },

  async addItem(userId: string, input: AddCartItemInput) {
    const cart = await cartsRepository.ensureCart(userId);
    const existing = await cartsRepository.findItem(cart.id, input.productId);
    await requireAvailableProduct(
      input.productId,
      (existing?.quantity ?? 0) + input.quantity,
    );
    await cartsRepository.addItem(cart.id, input.productId, input.quantity);
    return getCartView(userId);
  },

  async updateItem(
    userId: string,
    productId: string,
    input: UpdateCartItemInput,
  ) {
    const cart = await cartsRepository.findCart(userId);
    if (!cart) throw new AppError("Product is not in the cart", 404);

    const existing = await cartsRepository.findItem(cart.id, productId);
    if (!existing) throw new AppError("Product is not in the cart", 404);

    await requireAvailableProduct(productId, input.quantity);
    await cartsRepository.setItemQuantity(cart.id, productId, input.quantity);
    return getCartView(userId);
  },

  async removeItem(userId: string, productId: string) {
    const cart = await cartsRepository.findCart(userId);
    if (!cart) throw new AppError("Product is not in the cart", 404);

    const removed = await cartsRepository.removeItem(cart.id, productId);
    if (removed.count === 0) {
      throw new AppError("Product is not in the cart", 404);
    }
    return getCartView(userId);
  },

  async clear(userId: string) {
    const cart = await cartsRepository.findCart(userId);
    if (cart) await cartsRepository.clearItems(cart.id);
    return emptyCartView();
  },

  async checkout(userId: string, input: CheckoutCartInput) {
    const cart = await cartsRepository.findCartWithItems(userId);
    if (!cart || cart.items.length === 0) {
      throw new AppError("Your cart is empty", 400);
    }

    const items = cart.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }));

    try {
      // Stock decrements, the pending order, and the emptied cart either
      // all commit together or all roll back.
      return await cartsRepository.checkout(cart.id, (transaction) =>
        ordersService.createInTransaction(transaction, userId, {
          shippingAddress: input.shippingAddress,
          items,
        }),
      );
    } catch (error) {
      return mapOrderError(error);
    }
  },
};