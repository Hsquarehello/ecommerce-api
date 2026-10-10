import { z } from "zod";

export const createCheckoutSchema = z.object({ orderId: z.uuid() }).strict();

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
