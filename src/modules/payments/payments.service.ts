import Stripe from "stripe";
import { env } from "../../config/env.js";
import { AppError } from "../../errors/index.js";
import {
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
} from "../../generated/prisma/enums.js";
import { paymentsRepository } from "./payments.repository.js";
import type { CreateCheckoutInput } from "./payments.schema.js";
import { getStripeClient } from "./stripe.js";

export const paymentsService = {
  async createCheckoutSession(userId: string, input: CreateCheckoutInput) {
    const stripe = getStripeClient();
    const order = await paymentsRepository.findOrderForCheckout(
      input.orderId,
      userId,
    );

    if (!order) throw new AppError("Order not found", 404);
    if (order.status !== OrderStatus.PENDING) {
      throw new AppError("Only pending orders can be paid", 409);
    }
    if (order.payment && order.payment.provider !== PaymentProvider.STRIPE) {
      throw new AppError("This order uses a different payment provider", 409);
    }
    if (Number(order.totalAmount) <= 0) {
      throw new AppError("Order total must be greater than zero", 400);
    }
    if (order.payment?.status === PaymentStatus.SUCCESS) {
      throw new AppError("This order has already been paid", 409);
    }

    if (
      order.payment?.status === PaymentStatus.PENDING &&
      order.payment.transactionId
    ) {
      const existingSession = await stripe.checkout.sessions.retrieve(
        order.payment.transactionId,
      );
      if (existingSession.status === "open" && existingSession.url) {
        return {
          paymentId: order.payment.id,
          checkoutSessionId: existingSession.id,
          checkoutUrl: existingSession.url,
        };
      }
      if (existingSession.status === "complete") {
        throw new AppError("Payment is awaiting confirmation", 409);
      }
    }

    const payment = await paymentsRepository.preparePayment(
      order.id,
      Number(order.totalAmount),
    );
    const frontendUrl = env.FRONTEND_URL.replace(/\/$/, "");
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: order.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: env.STRIPE_CURRENCY,
            unit_amount: Math.round(Number(order.totalAmount) * 100),
            product_data: { name: `Order ${order.id}` },
          },
        },
      ],
      metadata: { paymentId: payment.id, orderId: order.id },
      success_url: `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/checkout/cancelled`,
    });

    if (!session.url) {
      throw new AppError("Stripe did not return a checkout URL", 502);
    }

    await paymentsRepository.saveCheckoutSession(payment.id, session.id);
    return {
      paymentId: payment.id,
      checkoutSessionId: session.id,
      checkoutUrl: session.url,
    };
  },

  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new AppError("Stripe webhook is not configured", 503);
    }
    if (!signature) throw new AppError("Missing Stripe signature", 400);

    const stripe = getStripeClient();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch {
      throw new AppError("Invalid Stripe webhook signature", 400);
    }

    let session: Stripe.Checkout.Session | undefined;
    let paymentStatus: PaymentStatus | undefined;

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status === "paid") {
          paymentStatus = PaymentStatus.SUCCESS;
        }
        break;
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired":
        session = event.data.object as Stripe.Checkout.Session;
        paymentStatus = PaymentStatus.FAILED;
        break;
      default:
        return;
    }

    const paymentId = session?.metadata?.paymentId;
    const orderId = session?.metadata?.orderId;
    if (!session || !paymentId || !orderId || !paymentStatus) return;

    await paymentsRepository.applyCheckoutResult(
      paymentId,
      orderId,
      session.id,
      paymentStatus,
    );
  },
};
