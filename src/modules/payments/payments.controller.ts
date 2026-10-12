import type { RequestHandler } from "express";
import { AppError } from "../../errors/index.js";
import { asyncHandler } from "../../middleware/index.js";
import { paymentsService } from "./payments.service.js";

export const createCheckoutSession: RequestHandler = asyncHandler(
  async (request, response) => {
    const result = await paymentsService.createCheckoutSession(
      request.authUser!.id,
      request.body,
    );
    response.status(201).json({
      success: true,
      message: "Checkout session created successfully",
      data: result,
    });
  },
);

export const handleStripeWebhook: RequestHandler = asyncHandler(
  async (request, response) => {
    if (!Buffer.isBuffer(request.body)) {
      throw new AppError("Expected a raw Stripe webhook body", 400);
    }

    await paymentsService.handleWebhook(
      request.body,
      request.get("stripe-signature"),
    );
    response.status(200).json({
      success: true,
      message: "Stripe webhook processed successfully",
      data: { received: true },
    });
  },
);
