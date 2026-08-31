import { handlePaymentCallback } from "@/lib/billing/callback";
export const runtime = "nodejs";
export async function POST(request: Request) { return handlePaymentCallback(request, "check"); }
