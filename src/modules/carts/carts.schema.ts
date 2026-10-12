import { z } from "zod";

const cartItemFields = {
  productId: z.uuid(),
  quantity: z.coerce.number().int().min(1).max(999),
};

export const addCartItemSchema = z.object(cartItemFields).strict();

export const updateCartItemSchema = z
  .object({ quantity: cartItemFields.quantity })
  .strict();

export const cartProductIdSchema = z.object({ productId: z.uuid() });

export const checkoutCartSchema = z
  .object({ shippingAddress: z.string().trim().min(1).max(500) })
  .strict();

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type CheckoutCartInput = z.infer<typeof checkoutCartSchema>;