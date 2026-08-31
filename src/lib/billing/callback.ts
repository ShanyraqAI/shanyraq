import { db } from "@/lib/db";
import { paymentConfig } from "./config";
import { applyPaymentResult, matchesPayment } from "./service";
import { paymentReply, readPaymentFields, validSignature } from "./freedompay";

export async function handlePaymentCallback(request: Request, kind: "check" | "result") {
  const config = paymentConfig();
  if (!config) return new Response("Payment service unavailable", { status: 503 });
  let fields;
  try { fields = await readPaymentFields(request); }
  catch { return new Response("Invalid request", { status: 400 }); }
  if (!validSignature(kind, fields, config.secret) || (fields.pg_merchant_id && fields.pg_merchant_id !== config.merchantId)) return new Response("Invalid signature", { status: 403 });
  try {
    if (kind === "result") {
      await applyPaymentResult(fields);
    } else {
      const order = await db.billingPayment.findUnique({ where: { id: fields.pg_order_id ?? "" } });
      // Check URL does not necessarily include the mode; it is signed and the provider ID is already bound at initialization.
      const matches = order && matchesPayment(order, { ...fields, pg_testing_mode: fields.pg_testing_mode ?? (order.testMode ? "1" : "0") });
      if (!matches || order.status !== "PENDING" || order.expiresAt <= new Date()) return paymentReply(kind, "rejected", config.secret);
    }
    return paymentReply(kind, "ok", config.secret);
  } catch {
    console.error("Billing callback not accepted", { incident: crypto.randomUUID(), kind });
    return paymentReply(kind, "error", config.secret);
  }
}
