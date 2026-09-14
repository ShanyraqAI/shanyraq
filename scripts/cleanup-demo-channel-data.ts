import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../src/lib/db";
import { recomputeExistingAvailability } from "../src/lib/availability/service";

const apply = process.argv.includes("--apply");
const demoNote = "(демо-канал)";
const demoChannels = ["booking", "ostrovok", "krisha"];

async function findDemoReservations() {
  return db.reservation.findMany({
    where: {
      sourceChannel: { in: demoChannels },
      externalReservationId: { not: null },
      notes: { contains: demoNote },
    },
    include: { guest: true },
    orderBy: { createdAt: "asc" },
  });
}

async function main() {
  const reservations = await findDemoReservations();
  const invalid = reservations.filter((reservation) => {
    const externalId = reservation.externalReservationId ?? "";
    return !externalId.startsWith(`${reservation.sourceChannel}-`) || !/^\w+-[a-z0-9]{6}-\d{3}$/i.test(externalId);
  });
  if (invalid.length) throw new Error(`Refusing cleanup: ${invalid.length} rows do not match the mock-provider signature.`);

  const ids = reservations.map((reservation) => reservation.id);
  const guestIds = [...new Set(reservations.map((reservation) => reservation.guestId))];
  const hotelRoomTypes = [...new Map(reservations.map((reservation) => [
    `${reservation.hotelId}:${reservation.roomTypeId}`,
    { hotelId: reservation.hotelId, roomTypeId: reservation.roomTypeId },
  ])).values()];
  const notificationKeys = ids.map((id) => `new-reservation:${id}`);
  const [notifications, audits, activeJobs, externalConnections] = await Promise.all([
    ids.length ? db.notification.findMany({ where: { dedupeKey: { in: notificationKeys } } }) : [],
    ids.length ? db.auditLog.findMany({ where: { entity: "Reservation", entityId: { in: ids } } }) : [],
    db.channelSyncJob.findMany({ where: { status: { in: ["PENDING", "RUNNING"] } } }),
    db.channelConnection.findMany({
      where: { channel: { isInternal: false }, status: { in: ["CONNECTED", "ERROR"] } },
      select: { id: true, hotelId: true, channelId: true, status: true },
    }),
  ]);

  const preview = {
    mode: apply ? "apply" : "dry-run",
    demoReservations: reservations.length,
    notifications: notifications.length,
    auditRows: audits.length,
    activeJobs: activeJobs.length,
    externalConnections: externalConnections.length,
    hotels: [...new Set(reservations.map((reservation) => reservation.hotelId))],
  };
  console.log(JSON.stringify(preview, null, 2));
  if (!apply) return;

  const backupDir = path.resolve("output", "incident-backups");
  await mkdir(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `demo-channel-cleanup-${stamp}.json`);
  await writeFile(backupPath, JSON.stringify({ createdAt: new Date().toISOString(), reservations, notifications, audits, activeJobs, externalConnections }, null, 2), { flag: "wx" });

  const result = await db.$transaction(async (tx) => {
    const current = await tx.reservation.findMany({
      where: { id: { in: ids }, notes: { contains: demoNote } },
      select: { id: true },
    });
    if (current.length !== ids.length) throw new Error("Cleanup target changed after preview; refusing to continue.");

    const removedNotifications = notificationKeys.length
      ? await tx.notification.deleteMany({ where: { dedupeKey: { in: notificationKeys } } })
      : { count: 0 };
    const removedAudits = ids.length
      ? await tx.auditLog.deleteMany({ where: { entity: "Reservation", entityId: { in: ids } } })
      : { count: 0 };
    const removedReservations = ids.length
      ? await tx.reservation.deleteMany({ where: { id: { in: ids } } })
      : { count: 0 };

    let availabilityRowsUpdated = 0;
    for (const pair of hotelRoomTypes) {
      availabilityRowsUpdated += await recomputeExistingAvailability(pair.hotelId, [pair.roomTypeId], tx);
    }

    let removedGuests = 0;
    for (const guestId of guestIds) {
      const guest = await tx.guest.findUnique({
        where: { id: guestId },
        select: { email: true, _count: { select: { reservations: true } } },
      });
      if (guest?._count.reservations === 0 && guest.email?.includes("@example.")) {
        await tx.guest.delete({ where: { id: guestId } });
        removedGuests++;
      }
    }

    const removedJobs = await tx.channelSyncJob.deleteMany({ where: { status: { in: ["PENDING", "RUNNING"] } } });
    const disconnected = await tx.channelConnection.updateMany({
      where: { channel: { isInternal: false } },
      data: {
        status: "DISCONNECTED",
        credentialsJson: null,
        credentialsEncrypted: null,
        importCursor: 0,
        lastSyncStatus: null,
        lastError: null,
      },
    });

    for (const hotelId of new Set(reservations.map((reservation) => reservation.hotelId))) {
      await tx.auditLog.create({
        data: {
          hotelId,
          actor: "system",
          action: "system.demo_channel_cleanup",
          entity: "Hotel",
          entityId: hotelId,
          metaJson: JSON.stringify({ removedReservations: reservations.filter((item) => item.hotelId === hotelId).length }),
        },
      });
    }

    return {
      removedReservations: removedReservations.count,
      removedNotifications: removedNotifications.count,
      removedAudits: removedAudits.count,
      removedGuests,
      removedJobs: removedJobs.count,
      disconnectedConnections: disconnected.count,
      availabilityRowsUpdated,
    };
  }, { timeout: 60_000 });

  const remainingDemoReservations = await findDemoReservations();
  const remainingActiveJobs = await db.channelSyncJob.count({ where: { status: { in: ["PENDING", "RUNNING"] } } });
  const remainingConnectedChannels = await db.channelConnection.count({
    where: { channel: { isInternal: false }, status: { in: ["CONNECTED", "ERROR"] } },
  });
  console.log(JSON.stringify({
    backupPath,
    result,
    verification: {
      remainingDemoReservations: remainingDemoReservations.length,
      remainingActiveJobs,
      remainingConnectedChannels,
    },
  }, null, 2));
}

main().finally(() => db.$disconnect());
