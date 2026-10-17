import { z } from "zod";
const singleLine = (limit: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(limit)
    .refine(
      (value) => !/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(value),
      "Укажите название одной строкой без управляющих символов.",
    );
const identifier = z.string().min(1).max(200);
export const paymentCommand = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("saveMethod"),
      rentalPropertyId: identifier,
      name: singleLine(100),
      recipient: singleLine(160),
      url: z.string().trim().min(1).max(500),
      enabled: z.boolean(),
      version: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      action: z.literal("prepare"),
      reservationId: identifier,
      revision: z.string().length(64),
      amount: z.string().max(20),
      purpose: z.enum(["BALANCE", "PREPAYMENT", "CUSTOM"]),
      collectionConfirmed: z.boolean(),
      locale: z.enum(["ru", "kk"]),
      key: z.string().uuid(),
    })
    .strict(),
  z.object({ action: z.literal("validate"), id: identifier }).strict(),
]);
