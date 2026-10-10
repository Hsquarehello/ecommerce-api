import type { RequestHandler } from "express";
import type { ZodType } from "zod";

export const validateParams =
  (schema: ZodType): RequestHandler =>
  (request, _response, next) => {
    const result = schema.safeParse(request.params);
    if (!result.success) {
      next(result.error);
      return;
    }
    next();
  };
