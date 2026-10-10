import { prisma } from "../../config/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { ProductStatus } from "../../generated/prisma/enums.js";
import type {
  CreateProductInput,
  ProductListQuery,
  UpdateProductInput,
} from "./products.schema.js";

export const productsRepository = {
  list(query: ProductListQuery, status?: ProductStatus) {
    const where = {
      ...(status ? { status } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.search
        ? {
            OR: [
              {
                name: { contains: query.search, mode: "insensitive" as const },
              },
              {
                description: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
              { sku: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    return Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.product.count({ where }),
    ]);
  },

  findById(id: string, status?: ProductStatus) {
    return prisma.product.findFirst({
      where: { id, ...(status ? { status } : {}) },
      include: { category: true },
    });
  },

  create(input: CreateProductInput) {
    return prisma.product.create({
      data: input as Prisma.ProductUncheckedCreateInput,
      include: { category: true },
    });
  },

  update(id: string, input: UpdateProductInput) {
    return prisma.product.update({
      where: { id },
      data: input as Prisma.ProductUncheckedUpdateInput,
      include: { category: true },
    });
  },
};
