import { ProductStatus } from "../../generated/prisma/enums.js";
import { AppError } from "../../errors/index.js";
import { productsRepository } from "./products.repository.js";
import type {
  AdminProductListQuery,
  CreateProductInput,
  ProductListQuery,
  UpdateProductInput,
} from "./products.schema.js";

const isPrismaError = (error: unknown, code: string) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === code;

const mapProductError = (error: unknown): never => {
  if (isPrismaError(error, "P2002")) {
    throw new AppError("A product with this SKU already exists", 409);
  }
  if (isPrismaError(error, "P2003")) {
    throw new AppError("The selected category does not exist", 400);
  }
  if (isPrismaError(error, "P2025")) {
    throw new AppError("Product not found", 404);
  }
  throw error;
};

const list = async (query: ProductListQuery, status?: ProductStatus) => {
  const [items, total] = await productsRepository.list(query, status);
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      totalItems: total,
      totalPages,
      hasNextPage: query.page < totalPages,
      hasPrevPage: query.page > 1 && totalPages > 0,
    },
  };
};

const toPublicProduct = <
  T extends { costPrice: unknown; lowStockThreshold: number },
>(
  product: T,
) => {
  const {
    costPrice: _costPrice,
    lowStockThreshold: _lowStockThreshold,
    ...publicProduct
  } = product;
  return publicProduct;
};

export const productsService = {
  async listPublic(query: ProductListQuery) {
    const result = await list(query, ProductStatus.ACTIVE);
    return { ...result, items: result.items.map(toPublicProduct) };
  },

  listAdmin(query: AdminProductListQuery) {
    const { status, ...pagination } = query;
    return list(pagination, status);
  },

  async getPublic(id: string) {
    const product = await productsRepository.findById(id, ProductStatus.ACTIVE);
    if (!product) throw new AppError("Product not found", 404);
    return toPublicProduct(product);
  },

  async getAdmin(id: string) {
    const product = await productsRepository.findById(id);
    if (!product) throw new AppError("Product not found", 404);
    return product;
  },

  async create(input: CreateProductInput) {
    try {
      return await productsRepository.create(input);
    } catch (error) {
      return mapProductError(error);
    }
  },

  async update(id: string, input: UpdateProductInput) {
    try {
      return await productsRepository.update(id, input);
    } catch (error) {
      return mapProductError(error);
    }
  },

  async archive(id: string) {
    const product = await productsRepository.findById(id);
    if (!product) throw new AppError("Product not found", 404);

    try {
      return await productsRepository.update(id, {
        status: ProductStatus.ARCHIVED,
      });
    } catch (error) {
      return mapProductError(error);
    }
  },
};
