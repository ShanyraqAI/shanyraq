import { stayDb as db } from "@/lib/guest-stay/db";
import {
  requireCommunicationAccess,
  requireSameOrigin,
  communicationError,
  privateJson,
} from "@/lib/communications/http";
import { readBoundedBody } from "@/lib/communications/body";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { assertBillingWriteAccess } from "@/lib/billing/service";
import { PublicError } from "@/server/errors";
import { id, staffCommand, disabled } from "@/lib/guest-stay/policy";
import { staffStay, stayWorkspace } from "@/lib/guest-stay/service";
import { scopeOf } from "@/lib/communications/service";
import { scope, tenant, ownedRoom } from "@/lib/guest-stay/catalog";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function enabled() {
  if (
    process.env.GUEST_STAY_ENABLED !== "true" &&
    process.env.PUBLIC_CATALOG_ENABLED !== "true"
  )
    throw new PublicError("Функция пока не включена.");
}
export async function GET(request: Request) {
  try {
    enabled();
    const m = await requireCommunicationAccess(true);
    const q = new URL(request.url).searchParams;
    const roomId = q.get("roomId") || undefined,
      reservationId = q.get("reservationId") || undefined,
      stayId = q.get("stayId") || undefined;
    [roomId, reservationId, stayId].filter(Boolean).forEach((v) => id.parse(v));
    if (!roomId && !reservationId && !stayId)
      throw new PublicError("Укажите квартиру или бронь.");
    const stays =
      process.env.GUEST_STAY_ENABLED === "true"
        ? await stayWorkspace(db, m, reservationId, roomId, stayId)
        : { stays: [] };
    const room = roomId ? await ownedRoom(db, m, roomId) : null;
    const listing =
      room && process.env.PUBLIC_CATALOG_ENABLED === "true"
        ? await db.catalogListing.findFirst({
            where: { ...tenant(m), roomId: room.id },
          })
        : null;
    const policy =
      room && process.env.GUEST_STAY_ENABLED === "true"
        ? await db.guestStayPolicy.findFirst({
            where: { ...tenant(m), rentalPropertyId: room.rentalPropertyId },
          })
        : null;
    const photos = room
      ? await db.communicationPhoto.findMany({
          where: { ...tenant(m), roomId: room.id, archivedAt: null },
          select: { id: true, name: true },
          orderBy: { position: "asc" },
          take: 6,
        })
      : [];
    const ratePlans = room
      ? await db.ratePlan.findMany({
          where: {
            hotelId: m.hotelId,
            roomTypeId: room.roomTypeId,
            rentalPropertyId: room.rentalPropertyId,
          },
          select: { id: true, name: true },
        })
      : [];
    const hotel = await db.hotel.findFirstOrThrow({
      where: { id: m.hotelId, orgId: m.organizationId },
      select: { slug: true },
    });
    return privateJson({
      ...stays,
      scope: scope(m),
      photoScope: scopeOf(m),
      listing: listing
        ? {
            id: listing.id,
            version: listing.version,
            title: listing.title,
            description: listing.description,
            publicLocation: listing.publicLocation,
            amenities: listing.amenities,
            restrictions: listing.restrictions,
            contactUrl: listing.contactUrl,
            ratePlanId: listing.ratePlanId,
            photoIds: listing.photoIds,
            published: listing.published,
          }
        : null,
      policy: policy
        ? {
            identityMode: policy.identityMode,
            requireArrival: policy.requireArrival,
            requireAgreement: policy.requireAgreement,
            parking: policy.parking,
            checkoutInstructions: policy.checkoutInstructions,
            entryPhotoIds: policy.entryPhotoIds,
            version: policy.version,
          }
        : null,
      roomLabel: room
        ? `${room.rentalProperty.publicName} · ${room.number}`
        : "",
      photos,
      ratePlans,
      catalogPath: `/catalog/${hotel.slug}`,
      catalogEnabled: process.env.PUBLIC_CATALOG_ENABLED === "true",
      stayEnabled: process.env.GUEST_STAY_ENABLED === "true",
    });
  } catch (e) {
    return communicationError(e);
  }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    enabled();
    const m = await requireCommunicationAccess(true);
    if (request.headers.get("x-shanyraq-scope") !== scope(m))
      throw new PublicError("Workspace изменился. Обновите страницу.");
    await enforceRateLimit("guest-stay-owner", scope(m), 60, 60000);
    const c = staffCommand.parse(
      JSON.parse(
        new TextDecoder().decode(await readBoundedBody(request, 22000)),
      ),
    );
    if (c.action === "saveListing") disabled("PUBLIC_CATALOG_ENABLED");
    else disabled("GUEST_STAY_ENABLED");
    // Emergency revocations remain possible even when billing is read-only.
    if (!(
      c.action === "decision" &&
      ["REVOKE_ACCESS", "REVOKE_LINK"].includes(c.decision)
    ))
      await assertBillingWriteAccess(m.organizationId);
    return privateJson(await staffStay(db, m, c));
  } catch (e) {
    return communicationError(e);
  }
}
