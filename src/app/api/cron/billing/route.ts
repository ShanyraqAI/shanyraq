import { timingSafeEqual } from "node:crypto";
import { sendBillingReminders } from "@/lib/billing/reminders";
import { billingLaunch } from "@/lib/billing/config";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!billingLaunch()) return Response.json({ skipped: "billing-disabled" });
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Not configured", { status: 503 });
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return new Response("Unauthorized", { status: 401 });
  try { return Response.json(await sendBillingReminders()); }
  catch {
    console.error("Billing reminder job failed", { incident: crypto.randomUUID() });
    return new Response("Unable to process reminders", { status: 503 });
  }
}
