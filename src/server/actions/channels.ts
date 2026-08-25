"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentHotelId } from "@/lib/db";
import {
  connectChannelSchema,
  saveRoomMappingsSchema,
  saveRateMappingsSchema,
  firstZodError,
} from "@/lib/constants";
import { getChannelProvider } from "@/lib/channels/provider-registry";
import type { ChannelCredentials } from "@/lib/channels/types";
import { runChannelSync, syncAllConnectedChannels } from "@/lib/channels/sync-service";
import { writeAudit } from "@/lib/reservations/service";
import { ok, fail, type ActionResult } from "@/server/types";
import { toErrorMessage } from "@/server/errors";

function revalidateChannels() {
  revalidatePath("/dashboard/channels");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
}

/**
 * Credentials are stored as a development placeholder behind parseCredentials()
 * (see sync-service). They are NEVER returned to the client and never logged.
 */
function storeCredentials(credentials: ChannelCredentials): string {
  return JSON.stringify(credentials);
}

export async function testChannelConnectionAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = connectChannelSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const provider = getChannelProvider(parsed.data.channelId);
    const result = await provider.verifyCredentials({
      propertyId: parsed.data.externalPropertyId,
      username: parsed.data.username,
      apiKey: parsed.data.apiKey,
    });
    if (result.ok) return ok(undefined, result.message);
    return fail(result.error);
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function connectChannelAction(input: unknown): Promise<ActionResult<{ connectionId: string }>> {
  try {
    const parsed = connectChannelSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const hotelId = await getCurrentHotelId();
    const data = parsed.data;

    const channel = await db.channel.findUnique({ where: { id: data.channelId } });
    if (!channel) return fail("Unknown channel");

    const credentials: ChannelCredentials = {
      propertyId: data.externalPropertyId,
      username: data.username,
      apiKey: data.apiKey,
    };

    const connection = await db.channelConnection.upsert({
      where: { hotelId_channelId: { hotelId, channelId: data.channelId } },
      create: {
        hotelId,
        channelId: data.channelId,
        status: "CONNECTED",
        externalPropertyId: credentials.propertyId,
        credentialsJson: storeCredentials(credentials),
      },
      update: {
        status: "CONNECTED",
        externalPropertyId: credentials.propertyId,
        credentialsJson: storeCredentials(credentials),
        lastError: null,
      },
    });

    await writeAudit(hotelId, "channel.connected", "ChannelConnection", connection.id, {
      channel: data.channelId,
      propertyId: credentials.propertyId,
    });
    revalidateChannels();
    return ok({ connectionId: connection.id }, `${channel.name} connected`);
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function disconnectChannelAction(connectionId: string): Promise<ActionResult> {
  try {
    const hotelId = await getCurrentHotelId();
    const connection = await db.channelConnection.findFirst({
      where: { id: connectionId, hotelId },
      include: { channel: true },
    });
    if (!connection) return fail("Connection not found");

    await db.$transaction([
      db.channelRoomMapping.deleteMany({ where: { connectionId } }),
      db.channelRateMapping.deleteMany({ where: { connectionId } }),
      db.channelConnection.delete({ where: { id: connectionId } }),
    ]);
    await writeAudit(hotelId, "channel.disconnected", "ChannelConnection", connectionId);
    revalidateChannels();
    return ok(undefined, `${connection.channel.name} disconnected`);
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function saveRoomMappingsAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = saveRoomMappingsSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const hotelId = await getCurrentHotelId();
    const connection = await db.channelConnection.findFirst({
      where: { id: parsed.data.connectionId, hotelId },
    });
    if (!connection) return fail("Connection not found");

    // Replace-all keeps mapping state consistent with the UI.
    await db.$transaction([
      db.channelRoomMapping.deleteMany({ where: { connectionId: connection.id } }),
      ...parsed.data.mappings.map((m) =>
        db.channelRoomMapping.create({
          data: {
            connectionId: connection.id,
            roomTypeId: m.roomTypeId,
            externalRoomTypeId: m.externalRoomTypeId,
            externalRoomName: m.externalRoomName,
          },
        }),
      ),
    ]);
    await writeAudit(hotelId, "channel.room_mappings_saved", "ChannelConnection", connection.id, {
      count: parsed.data.mappings.length,
    });
    revalidateChannels();
    return ok(undefined, "Room mapping saved");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function saveRateMappingsAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = saveRateMappingsSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const hotelId = await getCurrentHotelId();
    const connection = await db.channelConnection.findFirst({
      where: { id: parsed.data.connectionId, hotelId },
    });
    if (!connection) return fail("Connection not found");

    await db.$transaction([
      db.channelRateMapping.deleteMany({ where: { connectionId: connection.id } }),
      ...parsed.data.mappings.map((m) =>
        db.channelRateMapping.create({
          data: {
            connectionId: connection.id,
            ratePlanId: m.ratePlanId,
            externalRateId: m.externalRateId,
            externalRateName: m.externalRateName,
          },
        }),
      ),
    ]);
    await writeAudit(hotelId, "channel.rate_mappings_saved", "ChannelConnection", connection.id, {
      count: parsed.data.mappings.length,
    });
    revalidateChannels();
    return ok(undefined, "Rate mapping saved");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function syncChannelAction(connectionId: string): Promise<
  ActionResult<{
    status: string;
    reservationsImported: number;
    message: string | null;
    error: string | null;
  }>
> {
  try {
    const hotelId = await getCurrentHotelId();
    const owned = await db.channelConnection.findFirst({
      where: { id: connectionId, hotelId },
      select: { id: true },
    });
    if (!owned) return fail("Connection not found");

    const summary = await runChannelSync(connectionId);
    revalidateChannels();
    revalidatePath("/dashboard/reservations");
    if (summary.status === "FAILED") {
      return { ok: false, error: summary.message ?? "Synchronization failed" };
    }
    return ok(
      {
        status: summary.status,
        reservationsImported: summary.reservationsImported,
        message: summary.message,
        error: null,
      },
      summary.message ?? "Synchronization complete",
    );
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function syncAllChannelsAction(): Promise<ActionResult<{ results: { channelId: string; status: string; error: string | null }[] }>> {
  try {
    const hotelId = await getCurrentHotelId();
    const summaries = await syncAllConnectedChannels(hotelId);
    revalidateChannels();
    return ok(
      {
        results: summaries.map((s) => ({
          channelId: s.channelId,
          status: s.status,
          error: s.status === "FAILED" ? (s.message ?? "Failed") : null,
        })),
      },
      summaries.length === 0
        ? "No connected channels to sync"
        : `Synchronized ${summaries.filter((s) => s.status !== "FAILED").length}/${summaries.length} channels`,
    );
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}
