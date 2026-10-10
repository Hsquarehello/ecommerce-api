import { z } from "zod";
import { ProductStatus } from "../../generated/prisma/enums.js";

const productFields = {
  name: z.string().trim().min(1).max(200),
  sku: z.string().trim().min(1).max(100).nullable(),
  description: z.string().trim().max(5000).nullable(),
  price: z.coerce.number().finite().nonnegative(),
  costPrice: z.coerce.number().finite().nonnegative().nullable(),
  stock: z.coerce.number().int().nonnegative(),
  lowStockThreshold: z.coerce.number().int().nonnegative(),
  status: z.enum(ProductStatus),
  images: z.array(z.string().url()).max(20),
  vendor: z.string().trim().max(120).nullable(),
  weight: z.string().trim().max(50).nullable(),
  categoryId: z.uuid(),
};

export const createProductSchema = z
  .object({
    ...productFields,
    sku: productFields.sku.optional(),
    description: productFields.description.optional(),
    costPrice: productFields.costPrice.optional(),
    stock: productFields.stock.default(0),
    lowStockThreshold: productFields.lowStockThreshold.default(10),
    status: productFields.status.default(ProductStatus.ACTIVE),
    images: productFields.images.default([]),
    vendor: productFields.vendor.optional(),
    weight: productFields.weight.optional(),
  })
  .strict();

export const updateProductSchema = z
  .object(productFields)
  .partial()
  .strict()
  .refine((product) => Object.keys(product).length > 0, {
    message: "At least one product field must be provided",
  });

export const productIdSchema = z.object({ id: z.uuid() });

const productListFields = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(100).optional(),
  categoryId: z.uuid().optional(),
  sortBy: z.enum(["name", "price", "createdAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
};

export const productListQuerySchema = z.object(productListFields).strict();

export const adminProductListQuerySchema = z
  .object({
    ...productListFields,
    status: z.enum(ProductStatus).optional(),
  })
  .strict();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type AdminProductListQuery = z.infer<typeof adminProductListQuerySchema>;
