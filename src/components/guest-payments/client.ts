import { readApi } from "@/components/communications/api";
import type { z } from "zod";
import type { paymentCommand } from "@/lib/guest-payments/schema";
export function paymentPost<T>(
  scope: string,
  command: z.infer<typeof paymentCommand>,
) {
  return fetch("/api/guest-payments", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-shanyraq-scope": scope },
    body: JSON.stringify(command),
  }).then(readApi<T>);
}
export const PAYMENT_INPUT =
  "min-h-11 w-full min-w-0 rounded-xl border bg-background px-3 py-2 text-base";
export const PAYMENT_SECONDARY =
  "text-sm leading-relaxed text-[#52645a] dark:text-muted-foreground";
