import type { RequestHandler } from "express";
import { asyncHandler } from "../../middleware/index.js";
import {
  adminProductListQuerySchema,
  productListQuerySchema,
} from "./products.schema.js";
import { productsService } from "./products.service.js";

export const listProducts: RequestHandler = asyncHandler(
  async (request, response) => {
    const query = productListQuerySchema.parse(request.query);
    const result = await productsService.listPublic(query);
    response.status(200).json({ data: result });
  },
);

export const listAdminProducts: RequestHandler = asyncHandler(
  async (request, response) => {
    const query = adminProductListQuerySchema.parse(request.query);
    const result = await productsService.listAdmin(query);
    response.status(200).json({ data: result });
  },
);

export const getProduct: RequestHandler = asyncHandler(
  async (request, response) => {
    const product = await productsService.getPublic(
      request.params.id as string,
    );
    response.status(200).json({ data: product });
  },
);

export const getAdminProduct: RequestHandler = asyncHandler(
  async (request, response) => {
    const product = await productsService.getAdmin(request.params.id as string);
    response.status(200).json({ data: product });
  },
);

export const createProduct: RequestHandler = asyncHandler(
  async (request, response) => {
    const product = await productsService.create(request.body);
    response.status(201).json({ data: product });
  },
);

export const updateProduct: RequestHandler = asyncHandler(
  async (request, response) => {
    const product = await productsService.update(
      request.params.id as string,
      request.body,
    );
    response.status(200).json({ data: product });
  },
);

export const archiveProduct: RequestHandler = asyncHandler(
  async (request, response) => {
    const product = await productsService.archive(request.params.id as string);
    response.status(200).json({ data: product });
  },
);
