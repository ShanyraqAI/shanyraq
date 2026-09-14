import { after } from "next/server";
import { processChannelSyncJobs } from "@/lib/channels/sync-queue";
import { channelSyncEnabled } from "@/lib/channels/runtime-policy";

/** Start durable OTA work after the UI response; the database queue remains
 * the recovery source if this best-effort wake-up cannot run. */
export function wakeChannelSyncWorker(limit = 10): void {
  if (!channelSyncEnabled()) return;
  after(async () => {
    try {
      await processChannelSyncJobs({ limit });
    } catch {
      console.error("Unable to wake channel sync worker", { incidentId: crypto.randomUUID() });
    }
  });
}
