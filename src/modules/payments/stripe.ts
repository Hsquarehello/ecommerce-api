import Stripe from "stripe";
import { env } from "../../config/env.js";
import { AppError } from "../../errors/index.js";

let stripeClient: Stripe | undefined;

export const getStripeClient = () => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError("Stripe is not configured", 503);
  }

  stripeClient ??= new Stripe(env.STRIPE_SECRET_KEY);
  return stripeClient;
};
