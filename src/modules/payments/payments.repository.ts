import { prisma } from "../../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { OrderStatus, PaymentStatus } from "../../generated/prisma/enums.js";

export const paymentsRepository = {
  findOrderForCheckout(orderId: string, userId: string) {
    return prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { payment: true },
    });
  },

  preparePayment(orderId: string, amount: number) {
    return prisma.payment.upsert({
      where: { orderId },
      create: { orderId, amount },
      update: {
        amount,
        status: PaymentStatus.PENDING,
        transactionId: null,
        paymentRawData: Prisma.DbNull,
      },
    });
  },

  saveCheckoutSession(paymentId: string, sessionId: string) {
    return prisma.payment.update({
      where: { id: paymentId },
      data: {
        transactionId: sessionId,
        paymentRawData: { checkoutSessionId: sessionId },
      },
    });
  },

  applyCheckoutResult(
    paymentId: string,
    orderId: string,
    sessionId: string,
    status: PaymentStatus,
  ) {
    return prisma.$transaction(async (transaction) => {
      const payment = await transaction.payment.findFirst({
        where: {
          id: paymentId,
          orderId,
          transactionId: sessionId,
          status: PaymentStatus.PENDING,
        },
        include: { order: true },
      });

      if (!payment) return false;

      if (status === PaymentStatus.SUCCESS) {
        if (payment.order.status !== OrderStatus.PENDING) return false;
        await transaction.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.PAID },
        });
      }

      await transaction.payment.update({
        where: { id: paymentId },
        data: { status },
      });

      return true;
    });
  },
};
