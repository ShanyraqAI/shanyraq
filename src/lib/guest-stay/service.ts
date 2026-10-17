import type { GuestStay, PrismaClient, Prisma } from "@prisma/client";
import type { CurrentMembership } from "@/lib/tenant";
import type { z } from "zod";
import { PublicError } from "@/server/errors";
import { parseISODate, toISODate } from "@/lib/dates";
import { guestAgreement } from "@/lib/agreements/service";
import { CONSENT_VERSION } from "@/lib/agreements/policy";
import {
  capability,
  disabled,
  hash,
  checkoutPassed,
  stayLink,
  staffCommand,
  guestCommand,
  formInput,
  policyInput,
  range,
} from "./policy";
import {
  owner,
  tenant,
  ownedRoom,
  scope,
  saveListing,
  type Tx,
} from "./catalog";
const unavailable = () =>
  new PublicError(
    "Ссылка недоступна, отозвана или срок истёк. Свяжитесь с хозяином.",
  );
const stale = () =>
  new PublicError(
    "Данные изменились. Обновите страницу перед повторным действием.",
  );
async function event(
  tx: Tx,
  s: GuestStay,
  action: string,
  actorId?: string,
  reason = "",
) {
  await tx.guestStayEvent.create({
    data: { stayId: s.id, action, actorId, reason, version: s.version },
  });
}
async function live(tx: Tx, s: GuestStay) {
  const room = await tx.room.findFirst({
    where: {
      id: s.roomId,
      hotelId: s.hotelId,
      hotel: { orgId: s.organizationId },
    },
    include: { rentalProperty: true, hotel: true },
  });
  if (!room) throw unavailable();
  const r = s.reservationId
    ? await tx.reservation.findFirst({
        where: {
          id: s.reservationId,
          roomId: s.roomId,
          hotelId: s.hotelId,
          rentalPropertyId: room.rentalPropertyId,
        },
        include: { guest: { select: { fullName: true, phone: true } } },
      })
    : null;
  if (s.reservationId && !r) throw unavailable();
  const checkIn = r?.checkIn ?? s.checkIn,
    checkOut = r?.checkOut ?? s.checkOut;
  const checkInTime = r?.checkInTime ?? room.hotel.defaultCheckInTime,
    checkOutTime = r?.checkOutTime ?? room.hotel.defaultCheckOutTime;
  const revision = hash(
    JSON.stringify({
      roomId: room.id,
      checkIn,
      checkOut,
      checkInTime,
      checkOutTime,
      amount: r?.totalAmount.toString() ?? null,
      deposit: r?.depositAmount.toString() ?? null,
      currency: r?.currency ?? room.rentalProperty.currency,
      adults: r?.adults,
      children: r?.children,
      requireAgreement: s.requireAgreement,
      agreementBundleId: s.agreementBundleId,
      identityMode: s.identityMode,
      requireArrival: s.requireArrival,
    }),
  );
  return {
    room,
    r,
    revision,
    checkIn,
    checkOut,
    checkInTime,
    checkOutTime,
    cancelled:
      !!r && ["CANCELLED", "NO_SHOW", "CHECKED_OUT"].includes(r.status),
    ended: checkoutPassed(checkOut, checkOutTime, room.rentalProperty.timezone),
  };
}
async function lock(tx: Tx, id: string, hotelId?: string) {
  // Same order as canonical booking/agreements writers: reservation before stay.
  const candidate = await tx.guestStay.findFirst({
    where: { id, ...(hotelId ? { hotelId } : {}) },
    select: { id: true, reservationId: true },
  });
  if (!candidate) throw unavailable();
  if (candidate.reservationId)
    await tx.$queryRaw`SELECT "id" FROM "Reservation" WHERE "id"=${candidate.reservationId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "GuestStay" WHERE "id"=${id} FOR UPDATE`;
  const row = await tx.guestStay.findFirst({
    where: { id, ...(hotelId ? { hotelId } : {}) },
  });
  if (!row) throw unavailable();
  return row;
}
function active(s: GuestStay) {
  if (s.revokedAt || s.expiresAt <= new Date()) throw unavailable();
}
async function fromToken(tx: Tx, token: string, locked = false) {
  const row = await tx.guestStay.findUnique({
    where: { tokenHash: hash(token) },
  });
  if (!row) throw unavailable();
  const s = locked ? await lock(tx, row.id) : row;
  if (s.tokenHash !== hash(token)) throw unavailable();
  active(s);
  return s;
}
async function agreementView(
  db: PrismaClient,
  s: GuestStay,
  action: "load" | "accept" | "pdf" | "evidence" = "load",
  raw: Record<string, unknown> = {},
  historyOnly = false,
) {
  if (!s.agreementBundleId) {
    if (s.requireAgreement)
      throw new PublicError(
        "Хозяин ещё не подготовил условия. Подтверждение недоступно.",
      );
    return null;
  }
  if (process.env.GUEST_DOCUMENT_BUNDLES_ENABLED !== "true")
    throw new PublicError(
      "Модуль подтверждений выключен. Свяжитесь с хозяином.",
    );
  if (!s.reservationId)
    throw new PublicError("Сначала хозяин должен связать запись с бронью.");
  const bundle = await db.agreementBundle.findFirst({
    where: {
      id: s.agreementBundleId,
      hotelId: s.hotelId,
      organizationId: s.organizationId,
      reservationId: s.reservationId,
    },
    select: { requireOtp: true },
  });
  if (!bundle || bundle.requireOtp)
    throw new PublicError("Нужен действующий пакет без обязательного SMS.");
  return guestAgreement(
    db,
    { token: "0".repeat(64), action, ...raw } as Parameters<
      typeof guestAgreement
    >[1],
    {
      authorizedStay: {
        id: s.agreementBundleId,
        hotelId: s.hotelId,
        reservationId: s.reservationId,
        stayId: s.id,
        tokenHash: s.tokenHash,
      },
      historyOnly,
    },
  );
}
async function acknowledged(db: PrismaClient, s: GuestStay) {
  if (!s.requireAgreement && !s.agreementBundleId) return true;
  try {
    const a = await agreementView(db, s);
    return (
      a?.kind === "json" &&
      !!("guestAcceptedAt" in a.data && a.data.guestAcceptedAt)
    );
  } catch {
    return false;
  }
}
async function summary(db: PrismaClient, s: GuestStay) {
  const l = await live(db, s);
  const consent = await acknowledged(db, s);
  const ready =
    s.formState === "SUBMITTED" &&
    s.submittedRevision === l.revision &&
    s.reviewedRevision === l.revision &&
    !!s.reviewedAt &&
    consent &&
    (s.identityMode === "NONE" || !!s.originalCheckedAt);
  const allowed =
    ready &&
    !!s.accessGrantedAt &&
    !l.cancelled &&
    !l.ended &&
    !!l.r &&
    !s.revokedAt &&
    s.expiresAt > new Date();
  return { l, consent, ready, allowed };
}
export async function stayWorkspace(
  db: PrismaClient,
  m: CurrentMembership,
  reservationId?: string,
  roomId?: string,
  stayId?: string,
) {
  disabled("GUEST_STAY_ENABLED");
  await owner(db, m);
  if (roomId) await ownedRoom(db, m, roomId);
  if (
    reservationId &&
    !(await db.reservation.findFirst({
      where: {
        id: reservationId,
        hotelId: m.hotelId,
        hotel: { orgId: m.organizationId },
      },
      select: { id: true },
    }))
  )
    throw unavailable();
  const stays = await db.guestStay.findMany({
    where: {
      ...tenant(m),
      ...(reservationId ? { reservationId } : {}),
      ...(roomId ? { roomId } : {}),
      ...(stayId ? { id: stayId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return {
    scope: scope(m),
    stays: await Promise.all(
      stays.map(async (s) => {
        const { l, consent, allowed, ready } = await summary(db, s);
        const events = await db.guestStayEvent.findMany({
          where: { stayId: s.id },
          orderBy: { createdAt: "desc" },
          take: 50,
        });
        const bundles =
          process.env.GUEST_DOCUMENT_BUNDLES_ENABLED === "true" &&
          s.reservationId
            ? await db.agreementBundle.findMany({
                where: {
                  ...tenant(m),
                  reservationId: s.reservationId,
                  revokedAt: null,
                  requireOtp: false,
                },
                select: {
                  id: true,
                  ownerAcceptedAt: true,
                  guestAcceptedAt: true,
                },
                orderBy: { createdAt: "desc" },
                take: 20,
              })
            : [];
        return {
          id: s.id,
          version: s.version,
          reservationId: s.reservationId,
          roomId: s.roomId,
          formState: s.formState,
          form: {
            firstName: s.firstName,
            lastName: s.lastName,
            phone: s.phone,
            arrivalTime: s.arrivalTime,
          },
          knownGuestName: l.r?.guest.fullName ?? null,
          knownPhone: l.r?.guest.phone ?? null,
          revision: l.revision,
          reviewed: !!s.reviewedAt && s.reviewedRevision === l.revision,
          consent,
          requireAgreement: s.requireAgreement,
          requireArrival: s.requireArrival,
          agreementBundleId: s.agreementBundleId,
          identityMode: s.identityMode,
          originalCheckedAt: s.originalCheckedAt?.toISOString() ?? null,
          allowed,
          canGrant:
            ready &&
            !!l.r &&
            !l.cancelled &&
            !l.ended &&
            !s.revokedAt &&
            s.expiresAt > new Date(),
          reason: l.cancelled
            ? "Бронь отменена или завершена"
            : l.ended
              ? "Время выезда прошло"
              : !l.r
                ? "Предварительная запись не блокирует даты. Для доступа свяжите её с реальной бронью"
                : !ready
                  ? "Нужны данные, ознакомление (если требуется), проверка и при необходимости проверка оригинала"
                  : !allowed
                    ? "Хозяин ещё не разрешил доступ"
                    : "Доступ разрешён",
          url:
            !s.revokedAt && s.expiresAt > new Date()
              ? stayLink(s.sealedToken)
              : null,
          revoked: !!s.revokedAt,
          expiresAt: s.expiresAt.toISOString(),
          message: `${l.room.rentalProperty.publicName} · ${l.room.number}\n${toISODate(l.checkIn)} — ${toISODate(l.checkOut)}`,
          events: events.map((e) => ({
            id: e.id,
            action: e.action,
            actorId: e.actorId,
            reason: e.reason,
            version: e.version,
            createdAt: e.createdAt.toISOString(),
          })),
          bundles: bundles.map((b) => ({
            id: b.id,
            createdAt: b.ownerAcceptedAt.toISOString(),
            accepted: !!b.guestAcceptedAt,
          })),
        };
      }),
    ),
  };
}
export async function staffStay(
  db: PrismaClient,
  m: CurrentMembership,
  raw: z.infer<typeof staffCommand>,
) {
  const c = staffCommand.parse(raw);
  if (c.action === "saveListing")
    return db.$transaction((tx) =>
      saveListing(tx, m, c.roomId, c.version, c.listing),
    );
  disabled("GUEST_STAY_ENABLED");
  return db.$transaction(
    async (tx) => {
      await owner(tx, m);
      if (c.action === "savePolicy") {
        const room = await ownedRoom(tx, m, c.roomId);
        await tx.$queryRaw`SELECT "id" FROM "RentalProperty" WHERE "id"=${room.rentalPropertyId} FOR UPDATE`;
        const old = await tx.guestStayPolicy.findUnique({
          where: { rentalPropertyId: room.rentalPropertyId },
        });
        if ((old?.version ?? 0) !== c.version) throw stale();
        if (
          c.policy.requireAgreement &&
          process.env.GUEST_DOCUMENT_BUNDLES_ENABLED !== "true"
        )
          throw new PublicError(
            "Сначала включите проверенный модуль agreements.",
          );
        const data = policyInput.parse(c.policy);
        if (
          new Set(data.entryPhotoIds).size !== data.entryPhotoIds.length ||
          (await tx.communicationPhoto.count({
            where: {
              ...tenant(m),
              roomId: c.roomId,
              archivedAt: null,
              id: { in: data.entryPhotoIds },
            },
          })) !== data.entryPhotoIds.length
        )
          throw new PublicError("Выберите фотографии входа этой квартиры.");
        return tx.guestStayPolicy.upsert({
          where: { rentalPropertyId: room.rentalPropertyId },
          create: {
            ...tenant(m),
            rentalPropertyId: room.rentalPropertyId,
            ...data,
          },
          update: { ...data, version: { increment: 1 } },
          select: { version: true },
        });
      }
      if (c.action === "create") {
        range.parse({ checkIn: c.checkIn, checkOut: c.checkOut });
        const room = await ownedRoom(tx, m, c.roomId);
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`guest-stay:${m.hotelId}:${c.reservationId ?? c.requestKey}`},0))::text`;
        const r = c.reservationId
          ? await tx.reservation.findFirst({
              where: {
                id: c.reservationId,
                hotelId: m.hotelId,
                roomId: room.id,
                rentalPropertyId: room.rentalPropertyId,
              },
            })
          : null;
        if (
          c.reservationId &&
          (!r || ["CANCELLED", "NO_SHOW", "CHECKED_OUT"].includes(r.status))
        )
          throw unavailable();
        const old = await tx.guestStay.findFirst({
          where: {
            ...tenant(m),
            ...(c.reservationId
              ? { reservationId: c.reservationId }
              : { requestKey: c.requestKey }),
          },
        });
        if (old) {
          if (
            old.roomId !== room.id ||
            (!c.reservationId &&
              (toISODate(old.checkIn) !== c.checkIn ||
                toISODate(old.checkOut) !== c.checkOut))
          )
            throw stale();
          active(old);
          return { id: old.id, url: stayLink(old.sealedToken), replayed: true };
        }
        const p = await tx.guestStayPolicy.findUnique({
          where: { rentalPropertyId: room.rentalPropertyId },
        });
        const secret = capability();
        stayLink(secret.sealedToken); // Validate origin before persisting.
        const s = await tx.guestStay.create({
          data: {
            ...tenant(m),
            roomId: room.id,
            reservationId: r?.id,
            requestKey: c.requestKey,
            checkIn: r?.checkIn ?? parseISODate(c.checkIn),
            checkOut: r?.checkOut ?? parseISODate(c.checkOut),
            identityMode: p?.identityMode ?? "NONE",
            requireArrival: p?.requireArrival ?? false,
            requireAgreement: p?.requireAgreement ?? false,
            ...secret,
            expiresAt: new Date(Date.now() + 90 * 86400000),
          },
        });
        await event(
          tx,
          s,
          "CREATED",
          m.userId,
          r
            ? "Связана с существующей бронью, статус и календарь не изменены"
            : "Предварительная запись. Даты не блокируются",
        );
        return { id: s.id, url: stayLink(s.sealedToken), replayed: false };
      }
      let s = await lock(tx, c.stayId, m.hotelId);
      if (s.organizationId !== m.organizationId || s.version !== c.version)
        throw stale();
      const l = await live(tx, s);
      let data: Prisma.GuestStayUpdateInput = { version: { increment: 1 } };
      if (c.decision === "REVOKE_LINK")
        data = {
          ...data,
          revokedAt: new Date(),
          accessGrantedAt: null,
          accessGrantedBy: null,
        };
      else if (c.decision === "ROTATE")
        data = {
          ...data,
          ...capability(),
          revokedAt: null,
          accessGrantedAt: null,
          accessGrantedBy: null,
          expiresAt: new Date(Date.now() + 90 * 86400000),
        };
      else {
        active(s);
        if (c.decision === "REVOKE_ACCESS")
          data = { ...data, accessGrantedAt: null, accessGrantedBy: null };
        if (
          c.decision === "ORIGINAL_CHECKED" &&
          s.identityMode !== "ORIGINAL_AT_ARRIVAL"
        )
          throw new PublicError(
            "Проверка оригинала для этой формы не запрашивается.",
          );
        if (c.decision === "ORIGINAL_CHECKED")
          data = {
            ...data,
            originalCheckedAt: new Date(),
            originalCheckedBy: m.userId,
          };
        if (c.decision === "CORRECTION")
          data = {
            ...data,
            formState: "CORRECTION",
            correctionReason: c.reason,
            reviewedAt: null,
            reviewedBy: null,
            reviewedRevision: null,
            accessGrantedAt: null,
            accessGrantedBy: null,
          };
        if (c.decision === "ACCEPT") {
          if (s.formState !== "SUBMITTED" || s.submittedRevision !== l.revision)
            throw new PublicError(
              "Сначала гость должен отправить актуальную форму.",
            );
          data = {
            ...data,
            reviewedAt: new Date(),
            reviewedBy: m.userId,
            reviewedRevision: l.revision,
          };
        }
        if (c.decision === "LINK_RESERVATION") {
          if (s.reservationId || !c.referenceId)
            throw new PublicError(
              "Укажите существующую бронь для предварительной записи.",
            );
          const r = await tx.reservation.findFirst({
            where: {
              id: c.referenceId,
              hotelId: m.hotelId,
              roomId: s.roomId,
              checkIn: s.checkIn,
              checkOut: s.checkOut,
              status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
            },
          });
          if (!r)
            throw new PublicError(
              "Квартира и даты должны совпадать с активной бронью.",
            );
          data = {
            ...data,
            reservation: { connect: { id: r.id } },
            formState: "DRAFT",
            submittedRevision: null,
            reviewedAt: null,
            reviewedRevision: null,
            accessGrantedAt: null,
          };
        }
        if (c.decision === "BIND_AGREEMENT") {
          if (
            !s.reservationId ||
            !c.referenceId ||
            process.env.GUEST_DOCUMENT_BUNDLES_ENABLED !== "true"
          )
            throw new PublicError(
              "Нужны бронь и включённый модуль agreements.",
            );
          const b = await tx.agreementBundle.findFirst({
            where: {
              ...tenant(m),
              id: c.referenceId,
              reservationId: s.reservationId,
              revokedAt: null,
              expiresAt: { gt: new Date() },
              requireOtp: false,
            },
          });
          if (!b)
            throw new PublicError(
              "Нужен пакет этой брони без обязательного SMS.",
            );
          data = {
            ...data,
            agreementHistoryIds:
              s.agreementBundleId && s.agreementBundleId !== b.id
                ? [...new Set([...s.agreementHistoryIds, s.agreementBundleId])]
                : s.agreementHistoryIds,
            agreementBundleId: b.id,
            requireAgreement: true,
            formState: "DRAFT",
            submittedRevision: null,
            reviewedAt: null,
            reviewedRevision: null,
            accessGrantedAt: null,
          };
        }
        if (c.decision === "SET_REQUIREMENTS") {
          if (!c.requirements)
            throw new PublicError("Укажите требования для этой брони.");
          if (
            c.requirements.requireAgreement &&
            process.env.GUEST_DOCUMENT_BUNDLES_ENABLED !== "true"
          )
            throw new PublicError("Модуль agreements выключен.");
          data = {
            ...data,
            ...c.requirements,
            formState: "DRAFT",
            submittedRevision: null,
            reviewedRevision: null,
            reviewedAt: null,
            reviewedBy: null,
            accessGrantedAt: null,
            accessGrantedBy: null,
            ...(c.requirements.identityMode !== s.identityMode
              ? { originalCheckedAt: null, originalCheckedBy: null }
              : {}),
          };
        }
        if (c.decision === "GRANT") {
          // Re-evaluate immutable agreement revision, owner review and all independent states.
          const checked = await summary(db, s);
          if (!checked.ready || !l.r || l.cancelled || l.ended)
            throw new PublicError(
              "Нельзя разрешить доступ: завершите проверку, ознакомление и привязку брони.",
            );
          data = {
            ...data,
            accessGrantedAt: new Date(),
            accessGrantedBy: m.userId,
          };
        }
      }
      s = await tx.guestStay.update({ where: { id: s.id }, data });
      await event(tx, s, c.decision, m.userId, c.reason);
      return { id: s.id, version: s.version };
    },
    { timeout: 15000 },
  );
}
export async function guestStayView(db: PrismaClient, token: string) {
  disabled("GUEST_STAY_ENABLED");
  const s = await fromToken(db, token);
  const { l, consent, allowed } = await summary(db, s);
  let agreement = null;
  let agreementError = "";
  try {
    const a = await agreementView(db, s, "load", {}, true);
    if (a?.kind === "json") agreement = a.data;
  } catch (e) {
    agreementError =
      e instanceof PublicError ? e.message : "Условия пока недоступны";
  }
  // Secrets are not fetched until every authorization check has succeeded.
  let access = null;
  if (allowed) {
    const policy = await db.guestStayPolicy.findFirst({
      where: {
        hotelId: s.hotelId,
        organizationId: s.organizationId,
        rentalPropertyId: l.room.rentalPropertyId,
      },
    });
    const entryPhotos = await db.communicationPhoto.findMany({
      where: {
        hotelId: s.hotelId,
        organizationId: s.organizationId,
        roomId: s.roomId,
        archivedAt: null,
        id: { in: policy?.entryPhotoIds ?? [] },
      },
      select: { id: true },
    });
    const p = await db.communicationProfile.findFirst({
      where: {
        organizationId: s.organizationId,
        hotelId: s.hotelId,
        roomId: s.roomId,
      },
      select: {
        address: true,
        mapLink: true,
        keyInstructions: true,
        wifiName: true,
        wifiPassword: true,
        supportPhone: true,
        checkinGuideLink: true,
        rulesLink: true,
      },
    });
    // Validate legacy URLs too; never emit javascript/data/http URLs.
    const safe = (v: string) => {
      try {
        const u = new URL(v);
        return u.protocol === "https:" && !u.username && !u.password ? v : "";
      } catch {
        return "";
      }
    };
    access = {
      parking: policy?.parking ?? "",
      checkoutInstructions: policy?.checkoutInstructions ?? "",
      entryPhotoPositions: (policy?.entryPhotoIds ?? [])
        .map((v, i) => (entryPhotos.some((p) => p.id === v) ? i : -1))
        .filter((v) => v >= 0),
      address: p?.address || l.room.rentalProperty.address || "",
      mapLink: safe(p?.mapLink ?? ""),
      keyInstructions: p?.keyInstructions ?? "",
      wifiName: p?.wifiName ?? "",
      wifiPassword: p?.wifiPassword ?? "",
      supportPhone: p?.supportPhone ?? "",
      checkinGuideLink: safe(p?.checkinGuideLink ?? ""),
      rulesLink: safe(p?.rulesLink ?? ""),
    };
  }
  const agreementHistory = await Promise.all(
    s.agreementHistoryIds.map(async (bundleId) => {
      try {
        const a = await agreementView(
          db,
          { ...s, agreementBundleId: bundleId },
          "load",
          {},
          true,
        );
        return a?.kind === "json" &&
          "guestAcceptedAt" in a.data &&
          a.data.guestAcceptedAt
          ? {
              id: bundleId,
              acceptedAt: new Date(a.data.guestAcceptedAt).toISOString(),
            }
          : null;
      } catch {
        return null;
      }
    }),
  );
  return {
    agreementHistory: agreementHistory.filter((v) => v !== null),
    version: s.version,
    revision: l.revision,
    title: `${l.room.rentalProperty.publicName} · ${l.room.number}`,
    checkIn: toISODate(l.checkIn),
    checkOut: toISODate(l.checkOut),
    checkInTime: l.checkInTime,
    checkOutTime: l.checkOutTime,
    timezone: l.room.rentalProperty.timezone,
    paymentNote:
      l.r?.paymentCollect === "ota"
        ? "Оплата через площадку. Условия оплаты уточните в вашей брони на площадке."
        : l.r?.paymentMethod === "CASH"
          ? "Оплата при встрече по договорённости с хозяином."
          : "Способ и состояние оплаты уточните у хозяина. Заполнение формы не подтверждает оплату.",
    agreedTotal: l.r?.totalAmount.toString() ?? null,
    deposit: l.r?.depositAmount.toString() ?? null,
    currency: l.r?.currency ?? l.room.rentalProperty.currency,
    knownGuestName: l.r?.guest.fullName ?? null,
    form: {
      firstName: s.firstName,
      lastName: s.lastName,
      phone: s.phone || l.r?.guest.phone || "",
      arrivalTime: s.arrivalTime,
    },
    formState: s.formState,
    needsResubmit: s.submittedRevision !== l.revision,
    requireArrival: s.requireArrival,
    requireAgreement: s.requireAgreement,
    identityMode: s.identityMode,
    correctionReason: s.correctionReason,
    consent,
    agreement,
    agreementError,
    cancelled: l.cancelled,
    ended: l.ended,
    access,
  };
}
export async function guestStayCommand(
  db: PrismaClient,
  raw: z.infer<typeof guestCommand>,
) {
  disabled("GUEST_STAY_ENABLED");
  const c = guestCommand.parse(raw);
  if (c.action === "load")
    return { kind: "json" as const, data: await guestStayView(db, c.token) };
  if (c.action === "photo") {
    const s = await fromToken(db, c.token);
    const checked = await summary(db, s);
    if (!checked.allowed) throw unavailable();
    const policy = await db.guestStayPolicy.findFirst({
      where: {
        hotelId: s.hotelId,
        organizationId: s.organizationId,
        rentalPropertyId: checked.l.room.rentalPropertyId,
      },
    });
    const photoId = policy?.entryPhotoIds[c.position];
    if (!photoId) throw unavailable();
    const photo = await db.communicationPhoto.findFirst({
      where: {
        id: photoId,
        hotelId: s.hotelId,
        organizationId: s.organizationId,
        roomId: s.roomId,
        archivedAt: null,
      },
      select: { bytes: true, contentType: true },
    });
    if (!photo) throw unavailable();
    return { kind: "photo" as const, ...photo };
  }
  if (c.action === "agreement") {
    let s = await fromToken(db, c.token);
    if (c.bundleId && c.bundleId !== s.agreementBundleId) {
      if (c.command === "accept" || !s.agreementHistoryIds.includes(c.bundleId))
        throw unavailable();
      s = { ...s, agreementBundleId: c.bundleId };
    }
    const {
      bundleId: ignoredBundle,
      command,
      token: ignored,
      action: ignoredAction,
      ...rest
    } = c;
    void ignored;
    void ignoredAction;
    void ignoredBundle;
    const a = await agreementView(
      db,
      s,
      command,
      {
        ...rest,
        ...(command === "accept" ? { consentVersion: CONSENT_VERSION } : {}),
      },
      command !== "accept",
    );
    if (!a) throw new PublicError("Пакет не настроен.");
    return a;
  }
  await db.$transaction(async (tx) => {
    let s = await fromToken(tx, c.token, true);
    const l = await live(tx, s);
    if (l.cancelled || l.ended || c.revision !== l.revision) throw stale();
    const form = formInput.parse(c.form);
    const oldForm = {
      firstName: s.firstName,
      lastName: s.lastName,
      phone: s.phone,
      arrivalTime: s.arrivalTime,
    };
    if (
      s.formState === "SUBMITTED" &&
      s.submittedRevision === l.revision &&
      hash(JSON.stringify(oldForm)) === hash(JSON.stringify(form)) &&
      c.submit
    )
      return;
    if (s.version !== c.version) throw stale();
    if (
      s.accessGrantedAt ||
      (s.formState === "SUBMITTED" && s.submittedRevision === l.revision)
    )
      throw new PublicError(
        "Данные уже переданы. Для изменения попросите хозяина вернуть форму.",
      );
    if (s.requireArrival && !form.arrivalTime)
      throw new PublicError("Укажите время прибытия.");
    if (c.submit && !(await acknowledged(db, s)))
      throw new PublicError(
        "Сначала подтвердите актуальные обязательные условия.",
      );
    s = await tx.guestStay.update({
      where: { id: s.id },
      data: {
        ...form,
        formState: c.submit ? "SUBMITTED" : "DRAFT",
        submittedRevision: c.submit ? l.revision : null,
        reviewedAt: null,
        reviewedRevision: null,
        accessGrantedAt: null,
        correctionReason: "",
        version: { increment: 1 },
      },
    });
    await event(tx, s, c.submit ? "FORM_SUBMITTED" : "DRAFT_SAVED");
  });
  return { kind: "json" as const, data: await guestStayView(db, c.token) };
}
export type StayWorkspace = Awaited<ReturnType<typeof stayWorkspace>>;
export type GuestStayView = Awaited<ReturnType<typeof guestStayView>>;
