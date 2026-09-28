import { timingSafeEqual } from "node:crypto";
import { triggerChannexBookingPoll } from "@/lib/channels/channex/booking-sync";
import { channelSyncEnabled } from "@/lib/channels/runtime-policy";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(request: Request) {
  const secret = process.env.CHANNEX_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  const supplied = request.headers.get("x-shanyraq-webhook-secret") ?? "";
  const expected = Buffer.from(secret);
  const actual = Buffer.from(supplied);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function POST(request: Request) {
  if (!channelSyncEnabled()) return new Response("Not Found", { status: 404 });
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!body || typeof body !== "object") return new Response("Invalid payload", { status: 400 });
  const payload = body as { event?: unknown; property_id?: unknown; payload?: unknown };
  if (payload.event !== "booking") return Response.json({ ignored: true }, { status: 202 });
  const nestedPropertyId = payload.payload && typeof payload.payload === "object"
    ? (payload.payload as { property_id?: unknown }).property_id
    : undefined;
  const propertyId = typeof payload.property_id === "string"
    ? payload.property_id
    : typeof nestedPropertyId === "string" ? nestedPropertyId : null;
  if (!propertyId) return new Response("Missing property_id", { status: 400 });

  try {
    const result = await triggerChannexBookingPoll(propertyId);
    return Response.json(result, { status: result.found ? 200 : 202 });
  } catch {
    const incidentId = crypto.randomUUID();
    console.error("Channex webhook poll failed", { incidentId });
    return Response.json({ error: "Unable to process booking feed", incidentId }, { status: 503 });
  }
}
