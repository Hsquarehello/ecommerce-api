import { Router } from "express";
import { Role } from "../../generated/prisma/enums.js";
import { validateBody, validateParams } from "../../middleware/index.js";
import { authenticate, authorize } from "../auth/auth.middleware.js";
import {
  archiveProduct,
  createProduct,
  getAdminProduct,
  getProduct,
  listAdminProducts,
  listProducts,
  updateProduct,
} from "./products.controller.js";
import {
  createProductSchema,
  productIdSchema,
  updateProductSchema,
} from "./products.schema.js";

export const productRouter = Router();
const adminOnly = [authenticate, authorize(Role.ADMIN)];

productRouter.get("/", listProducts);
productRouter.get("/admin", ...adminOnly, listAdminProducts);
productRouter.get(
  "/admin/:id",
  ...adminOnly,
  validateParams(productIdSchema),
  getAdminProduct,
);
productRouter.post(
  "/",
  ...adminOnly,
  validateBody(createProductSchema),
  createProduct,
);
productRouter.get("/:id", validateParams(productIdSchema), getProduct);
productRouter.patch(
  "/:id",
  ...adminOnly,
  validateParams(productIdSchema),
  validateBody(updateProductSchema),
  updateProduct,
);
productRouter.delete(
  "/:id",
  ...adminOnly,
  validateParams(productIdSchema),
  archiveProduct,
);
