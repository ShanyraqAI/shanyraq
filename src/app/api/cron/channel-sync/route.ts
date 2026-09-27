import { timingSafeEqual } from "node:crypto";
import { processChannelSyncJobs } from "@/lib/channels/sync-queue";
import { channelSyncEnabled } from "@/lib/channels/runtime-policy";
import { pollAllChannexBookings } from "@/lib/channels/channex/booking-sync";
import { enqueueDueChannexFullSyncs } from "@/lib/channels/channex/sync-outbox";
import { processChannexSyncJobs } from "@/lib/channels/channex/sync-worker";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!channelSyncEnabled()) return Response.json({ disabled: true }, { status: 404 });
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Not configured", { status: 503 });

  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const fullSyncsQueued = await enqueueDueChannexFullSyncs();
    const [legacy, channex, bookings] = await Promise.all([
      processChannelSyncJobs({ limit: 10 }),
      processChannexSyncJobs(10),
      pollAllChannexBookings(20),
    ]);
    return Response.json({ legacy, channex, bookings, fullSyncsQueued });
  } catch {
    const incidentId = crypto.randomUUID();
    console.error("Channel sync recovery cron failed", { incidentId });
    return Response.json({ error: "Unable to process channel sync queue", incidentId }, { status: 503 });
  }
}
