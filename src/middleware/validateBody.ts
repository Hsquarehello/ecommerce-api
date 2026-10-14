import type { RequestHandler } from "express";
import type { ZodType } from "zod";

export const validateBody =
  (schema: ZodType): RequestHandler =>
  (request, _response, next) => {
    try {
      request.body = schema.parse(request.body);
      next();
    } catch (error) {
      console.log(error)
      next(error);
    }
  };
