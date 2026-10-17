import type { Prisma, PrismaClient, AgreementBundle } from "@prisma/client";
import type { z } from "zod";
import type { CurrentMembership } from "@/lib/tenant";
import { AuthorizationError, PublicError } from "@/server/errors";
import { renderDocumentPdf } from "@/lib/documents/pdf";
import {
  smsConfig,
  sendOtpSms,
  type SmsConfig,
  type SmsResult,
} from "@/lib/sms/mobizon";
import {
  bundleLink,
  CONSENT_VERSION,
  OWNER_CONSENT,
  GUEST_CONSENT,
  equalHash,
  guestCommand,
  staffCommand,
  hash,
  normalizePhone,
  otpCode,
  otpHash,
  phoneHash,
  token,
} from "./policy";
type Tx = Prisma.TransactionClient;
const json = (v: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(v));
export const agreementScope = (m: CurrentMembership) =>
  `${m.userId}:${m.organizationId}:${m.hotelId}`;
const tenant = (m: CurrentMembership) => ({
  hotelId: m.hotelId,
  organizationId: m.organizationId,
});
const unavailable = () =>
  new PublicError(
    "Ссылка недоступна или устарела. Попросите владельца создать новый пакет.",
  );
async function owner(tx: Tx, m: CurrentMembership) {
  const member = await tx.membership.findFirst({
    where: {
      id: m.id,
      userId: m.userId,
      hotelId: m.hotelId,
      organizationId: m.organizationId,
      hotel: { orgId: m.organizationId },
      role: "OWNER",
    },
  });
  if (!member) throw new AuthorizationError();
}
async function current(
  tx: Tx,
  reservationId: string,
  hotelId: string,
  allowCancelled = false,
) {
  const r = await tx.reservation.findFirst({
    where: { id: reservationId, hotelId },
    include: {
      guest: true,
      hotel: true,
      room: { include: { rentalProperty: true } },
    },
  });
  if (!r || (!allowCancelled && ["CANCELLED", "NO_SHOW"].includes(r.status)))
    throw unavailable();
  const [profile, communication, publication] = await Promise.all([
    tx.documentProfile.findUnique({ where: { organizationId: r.hotel.orgId } }),
    tx.communicationProfile.findFirst({
      where: { hotelId, roomId: r.roomId ?? "__no_room__" },
    }),
    tx.publicPropertyRules.findUnique({
      where: { rentalPropertyId: r.rentalPropertyId },
    }),
  ]);
  // Conservative invalidation: any booking/profile/rules/contact change requires new consent.
  const revision = hash(
    JSON.stringify({
      reservation: {
        ...r,
        guest: undefined,
        hotel: undefined,
        room: undefined,
      },
      guest: r.guest,
      hotel: {
        name: r.hotel.name,
        address: r.hotel.address,
        city: r.hotel.city,
        houseRules: r.hotel.houseRules,
        defaultCheckInTime: r.hotel.defaultCheckInTime,
        defaultCheckOutTime: r.hotel.defaultCheckOutTime,
      },
      room: r.room,
      profile,
      communication,
      publication,
    }),
  );
  return {
    r,
    revision,
    phone: normalizePhone(r.guest.phone),
    publication,
    rules: publication?.published
      ? publication.text
      : (r.hotel.houseRules ?? ""),
  };
}
async function lockReservation(tx: Tx, reservationId: string, hotelId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Reservation" WHERE "id"=${reservationId} AND "hotelId"=${hotelId} FOR UPDATE`;
  const r = await tx.reservation.findFirst({
    where: { id: reservationId, hotelId },
    select: {
      guestId: true,
      roomId: true,
      rentalPropertyId: true,
      hotel: { select: { orgId: true } },
    },
  });
  if (!r) throw unavailable();
  await tx.$queryRaw`SELECT "id" FROM "Hotel" WHERE "id"=${hotelId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "RentalProperty" WHERE "id"=${r.rentalPropertyId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "PublicPropertyRules" WHERE "rentalPropertyId"=${r.rentalPropertyId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "Guest" WHERE "id"=${r.guestId} FOR UPDATE`;
  if (r.roomId) {
    await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "id"=${r.roomId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "CommunicationProfile" WHERE "roomId"=${r.roomId} FOR UPDATE`;
  }
  await tx.$queryRaw`SELECT "id" FROM "DocumentProfile" WHERE "organizationId"=${r.hotel.orgId} FOR UPDATE`;
}
function state(b: AgreementBundle, revision: string) {
  return b.revokedAt
    ? "REVOKED"
    : b.revision !== revision
      ? "OUTDATED"
      : b.expiresAt <= new Date()
        ? "EXPIRED"
        : b.guestAcceptedAt
          ? "ACKNOWLEDGED"
          : "WAITING_GUEST";
}
export async function agreementWorkspace(
  db: PrismaClient,
  m: CurrentMembership,
  reservationId: string,
) {
  return db.$transaction(async (tx) => {
    await owner(tx, m);
    const c = await current(tx, reservationId, m.hotelId, true);
    const [documents, bundles] = await Promise.all([
      tx.generatedDocument.findMany({
        where: { ...tenant(m), reservationId },
        select: { id: true, type: true, documentNumber: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      tx.agreementBundle.findMany({
        where: { ...tenant(m), reservationId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);
    return {
      scope: agreementScope(m),
      revision: c.revision,
      documents,
      rules: c.rules,
      publicRules: c.publication
        ? {
            text: c.publication.text,
            version: c.publication.version,
            published: c.publication.published,
            url: publicRulesLink(c.publication.id),
          }
        : null,
      phone: c.phone ? `+7 ••• ••• ${c.phone.slice(-4)}` : null,
      smsConfigured: !!smsConfig(),
      bundles: bundles.map((b) => ({
        id: b.id,
        ownerName: b.ownerName,
        ownerAcceptedAt: b.ownerAcceptedAt.toISOString(),
        guestName: b.guestName,
        guestAcceptedAt: b.guestAcceptedAt?.toISOString() ?? null,
        state: state(b, c.revision),
      })),
      legalStatus: "NOT_LEGALLY_REVIEWED" as const,
    };
  });
}
export async function staffAgreement(
  db: PrismaClient,
  m: CurrentMembership,
  raw: z.infer<typeof staffCommand>,
) {
  const c = staffCommand.parse(raw);
  // PDF rendering occurs before locks, but snapshot hashes are rechecked inside transaction.
  const pdfs: {
    id: string;
    title: string;
    required: boolean;
    bytes: Uint8Array;
    contentHash: string;
    sourceHash: string;
  }[] = [];
  const requestHash = hash(JSON.stringify(c));
  let publicToken = "";
  let url = "";
  if (c.action === "create") {
    if (
      new Set(c.documents.map((d) => d.id)).size !== c.documents.length ||
      !c.documents.some((d) => d.required)
    )
      throw new PublicError(
        "Выберите хотя бы один обязательный документ без повторов.",
      );
    if (c.requireOtp && !smsConfig())
      throw new PublicError(
        "SMS не настроено: нужны аккаунт Mobizon, зарегистрированное имя отправителя и серверные ключи.",
      );
    publicToken = token();
    try {
      url = bundleLink(process.env.APP_URL ?? "", publicToken);
    } catch {
      throw new PublicError("Настройте HTTPS APP_URL.");
    }
    for (const selected of c.documents) {
      const d = await db.generatedDocument.findFirst({
        where: {
          id: selected.id,
          reservationId: c.reservationId,
          ...tenant(m),
        },
      });
      if (!d) throw unavailable();
      const bytes = new Uint8Array(await renderDocumentPdf(d.snapshot));
      if (bytes.length > 2 * 1024 * 1024)
        throw new PublicError("PDF больше 2 МБ.");
      pdfs.push({
        id: d.id,
        title: `${d.type} №${d.documentNumber}`,
        required: selected.required,
        bytes,
        contentHash: hash(bytes),
        sourceHash: hash(JSON.stringify(d.snapshot)),
      });
    }
  }
  return db.$transaction(
    async (tx) => {
      await owner(tx, m);
      await lockReservation(tx, c.reservationId, m.hotelId);
      if (c.action === "publishRules") {
        if (c.published && !publicRulesLink("configuration-check"))
          throw new PublicError(
            "Настройте HTTPS APP_URL перед публикацией правил.",
          );
        const r = await tx.reservation.findFirstOrThrow({
          where: { id: c.reservationId, hotelId: m.hotelId },
          select: { rentalPropertyId: true },
        });
        const previous = await tx.publicPropertyRules.findUnique({
          where: { rentalPropertyId: r.rentalPropertyId },
        });
        if ((previous?.version ?? 0) !== c.version)
          throw new PublicError(
            "Публичные правила изменились. Обновите данные.",
          );
        const rule = await tx.publicPropertyRules.upsert({
          where: { rentalPropertyId: r.rentalPropertyId },
          create: {
            ...tenant(m),
            rentalPropertyId: r.rentalPropertyId,
            text: c.text,
            published: c.published,
            updatedById: m.userId,
          },
          update: {
            text: c.text,
            published: c.published,
            updatedById: m.userId,
            version: { increment: 1 },
          },
        });
        await tx.publicRuleRevision.create({
          data: {
            ruleId: rule.id,
            version: rule.version,
            text: rule.text,
            published: rule.published,
            actorId: m.userId,
          },
        });
        await tx.auditLog.create({
          data: {
            hotelId: m.hotelId,
            actorUserId: m.userId,
            actor: m.userId,
            action: c.published ? "rules.published" : "rules.unpublished",
            entity: "PublicPropertyRules",
            entityId: rule.id,
            metaJson: JSON.stringify({
              version: rule.version,
              contentHash: hash(rule.text),
            }),
          },
        });
        return {
          id: rule.id,
          version: rule.version,
          published: rule.published,
          url: publicRulesLink(rule.id),
        };
      }
      if (c.action !== "create") {
        const b = await tx.agreementBundle.findFirst({
          where: {
            id: c.bundleId,
            reservationId: c.reservationId,
            ...tenant(m),
          },
          include: {
            items: { orderBy: { position: "asc" } },
            events: { orderBy: { createdAt: "asc" } },
          },
        });
        if (!b) throw unavailable();
        if (c.action === "evidence") return evidence(b);
        if (!b.revokedAt) {
          await tx.agreementBundle.update({
            where: { id: b.id },
            data: { revokedAt: new Date() },
          });
          await tx.agreementEvent.create({
            data: {
              bundleId: b.id,
              actorId: m.userId,
              action: "OWNER_REVOKED",
              evidence: { bundleHash: b.bundleHash },
            },
          });
        }
        return { ok: true };
      }
      const live = await current(tx, c.reservationId, m.hotelId);
      const previous = await tx.agreementBundle.findUnique({
        where: {
          hotelId_requestKey: { hotelId: m.hotelId, requestKey: c.requestKey },
        },
      });
      if (previous) {
        if (previous.requestHash !== requestHash)
          throw new PublicError("Повтор запроса содержит другие данные.");
        // Raw capability tokens are never stored/recovered. A lost response needs a new explicit request.
        return {
          id: previous.id,
          url: null,
          expiresAt: previous.expiresAt.toISOString(),
          replayed: true,
        };
      }
      if (live.revision !== c.revision)
        throw new PublicError(
          "Бронь, реквизиты или правила изменились. Обновите пакет.",
        );
      if (!live.rules.trim())
        throw new PublicError(
          "Сначала заполните правила проживания в настройках объекта.",
        );
      if (c.requireOtp && !live.phone)
        throw new PublicError(
          "Для SMS нужен номер гостя +7 и 10 цифр в карточке гостя.",
        );
      for (const pdf of pdfs) {
        const d = await tx.generatedDocument.findFirst({
          where: { id: pdf.id, reservationId: c.reservationId, ...tenant(m) },
        });
        if (!d || hash(JSON.stringify(d.snapshot)) !== pdf.sourceHash)
          throw unavailable();
      }
      const items = [
        ...pdfs.map((d, position) => ({
          position,
          title: d.title,
          kind: "DOCUMENT",
          required: d.required,
          pdfBytes: d.bytes,
          contentHash: d.contentHash,
          sourceDocumentId: d.id,
        })),
        ...[
          {
            title: "Правила проживания",
            text: live.rules,
            required: true,
            kind: "RULES",
          },
          {
            title: "Депозит и возврат",
            text: c.depositTerms,
            required: true,
            kind: "DEPOSIT",
          },
          {
            title: "Отмена бронирования",
            text: c.cancellationTerms,
            required: true,
            kind: "CANCELLATION",
          },
          {
            title: "Инструкция заселения",
            text: c.guide,
            required: false,
            kind: "INFORMATION",
          },
        ].map((item, i) => ({
          ...item,
          position: pdfs.length + i,
          contentHash: hash(item.text),
        })),
      ];
      const bundleHash = hash(
        JSON.stringify({
          version: CONSENT_VERSION,
          revision: live.revision,
          ownerName: c.ownerName,
          requireOtp: c.requireOtp,
          items: items.map((i) => ({
            position: i.position,
            title: i.title,
            kind: i.kind,
            required: i.required,
            contentHash: i.contentHash,
          })),
        }),
      );
      // A new version revokes all prior active links; evidence remains untouched.
      const old = await tx.agreementBundle.findMany({
        where: {
          ...tenant(m),
          reservationId: c.reservationId,
          revokedAt: null,
        },
        select: { id: true },
      });
      await tx.agreementBundle.updateMany({
        where: { id: { in: old.map((b) => b.id) } },
        data: { revokedAt: new Date() },
      });
      for (const b of old)
        await tx.agreementEvent.create({
          data: {
            bundleId: b.id,
            actorId: m.userId,
            action: "SUPERSEDED",
            evidence: { byRequestKey: c.requestKey },
          },
        });
      const expiresAt = new Date(Date.now() + c.expiresInDays * 86400000);
      const b = await tx.agreementBundle.create({
        data: {
          ...tenant(m),
          reservationId: c.reservationId,
          createdById: m.userId,
          requestKey: c.requestKey,
          requestHash,
          tokenHash: hash(publicToken),
          revision: live.revision,
          bundleHash,
          ownerName: c.ownerName,
          requireOtp: c.requireOtp,
          expiresAt,
          items: { create: items },
          events: {
            create: {
              action: "OWNER_ACKNOWLEDGED",
              actorId: m.userId,
              evidence: {
                bundleHash,
                consentVersion: CONSENT_VERSION,
                consentText: OWNER_CONSENT,
                ownerName: c.ownerName,
                method: "AUTHENTICATED_OWNER",
                identityVerified: false,
                legalStatus: "NOT_LEGALLY_REVIEWED",
              },
            },
          },
        },
      });
      return {
        id: b.id,
        url,
        expiresAt: expiresAt.toISOString(),
        replayed: false,
      };
    },
    { timeout: 15000 },
  );
}
type Loaded = Awaited<ReturnType<typeof load>>;
type AuthorizedStayBundle = {
  id: string;
  hotelId: string;
  reservationId: string;
  stayId: string;
  tokenHash: string;
};
async function load(
  tx: Tx,
  value: string,
  authorizedStay?: AuthorizedStayBundle,
  historyOnly = false,
) {
  const b = await tx.agreementBundle.findUnique({
    where: authorizedStay
      ? {
          id: authorizedStay.id,
          hotelId: authorizedStay.hotelId,
          reservationId: authorizedStay.reservationId,
        }
      : { tokenHash: hash(value) },
    include: {
      items: { orderBy: { position: "asc" } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!b) throw unavailable();
  if (authorizedStay) {
    const stay = await tx.guestStay.findFirst({
      where: {
        id: authorizedStay.stayId,
        tokenHash: authorizedStay.tokenHash,
        hotelId: authorizedStay.hotelId,
        reservationId: authorizedStay.reservationId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (
      !stay ||
      (historyOnly
        ? ![stay.agreementBundleId, ...stay.agreementHistoryIds].includes(b.id)
        : stay.agreementBundleId !== b.id)
    )
      throw unavailable();
  }
  // An already-accepted immutable snapshot remains readable after checkout/expiry.
  // Only the internally authorized stay can request history; acceptance always validates live revision.
  if (historyOnly && authorizedStay && b.guestAcceptedAt)
    return { b, phone: null };
  const live = await current(tx, b.reservationId, b.hotelId);
  if (["REVOKED", "EXPIRED", "OUTDATED"].includes(state(b, live.revision)))
    throw unavailable();
  return { b, phone: live.phone };
}
async function locked(
  tx: Tx,
  value: string,
  authorizedStay?: AuthorizedStayBundle,
) {
  const candidate = await tx.agreementBundle.findUnique({
    where: authorizedStay
      ? {
          id: authorizedStay.id,
          hotelId: authorizedStay.hotelId,
          reservationId: authorizedStay.reservationId,
        }
      : { tokenHash: hash(value) },
    select: { reservationId: true, hotelId: true, id: true },
  });
  if (!candidate) throw unavailable();
  await lockReservation(tx, candidate.reservationId, candidate.hotelId);
  if (authorizedStay)
    await tx.$queryRaw`SELECT "id" FROM "GuestStay" WHERE "id"=${authorizedStay.stayId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "AgreementBundle" WHERE "id"=${candidate.id} FOR UPDATE`;
  return load(tx, value, authorizedStay);
}
function view({ b, phone }: Loaded) {
  return {
    id: b.id,
    bundleHash: b.bundleHash,
    ownerName: b.ownerName,
    ownerAcceptedAt: b.ownerAcceptedAt.toISOString(),
    expiresAt: b.expiresAt.toISOString(),
    guestName: b.guestName,
    guestAcceptedAt: b.guestAcceptedAt?.toISOString() ?? null,
    requireOtp: b.requireOtp,
    smsConfigured: !!smsConfig(),
    phone: phone ? `+7 ••• ••• ${phone.slice(-4)}` : null,
    consentVersion: CONSENT_VERSION,
    consentText: GUEST_CONSENT,
    legalStatus: "NOT_LEGALLY_REVIEWED" as const,
    items: b.items.map((i) => ({
      id: i.id,
      title: i.title,
      kind: i.kind,
      required: i.required,
      text: i.text,
      contentHash: i.contentHash,
      hasPdf: !!i.pdfBytes,
    })),
  };
}
function evidence(b: Loaded["b"]) {
  return {
    id: b.id,
    bundleHash: b.bundleHash,
    legalStatus: "NOT_LEGALLY_REVIEWED",
    ownerName: b.ownerName,
    ownerAcceptedAt: b.ownerAcceptedAt,
    guestName: b.guestName,
    guestAcceptedAt: b.guestAcceptedAt,
    revokedAt: b.revokedAt,
    expiresAt: b.expiresAt,
    guestEvidence: b.guestEvidence,
    items: b.items.map((i) => ({
      ...i,
      pdfBytes: i.pdfBytes ? Buffer.from(i.pdfBytes).toString("base64") : null,
    })),
    events: b.events,
  };
}
export async function guestAgreement(
  db: PrismaClient,
  raw: z.infer<typeof guestCommand>,
  deps: {
    // Internal server-only delegation AFTER a GuestStay capability has been checked.
    authorizedStay?: AuthorizedStayBundle;
    historyOnly?: boolean;
    config?: SmsConfig | null;
    send?: (
      config: SmsConfig,
      phone: string,
      code: string,
    ) => Promise<SmsResult>;
  } = {},
) {
  const c = guestCommand.parse(raw);
  if (c.action === "load")
    return {
      kind: "json" as const,
      data: view(
        await load(db, c.token, deps.authorizedStay, deps.historyOnly),
      ),
    };
  if (c.action === "pdf") {
    const { b } = await load(
      db,
      c.token,
      deps.authorizedStay,
      deps.historyOnly,
    );
    const item = b.items.find((i) => i.id === c.itemId);
    if (!item?.pdfBytes) throw unavailable();
    return { kind: "pdf" as const, bytes: item.pdfBytes };
  }
  if (c.action === "evidence") {
    const { b } = await load(
      db,
      c.token,
      deps.authorizedStay,
      deps.historyOnly,
    );
    return { kind: "json" as const, data: evidence(b) };
  }
  const config = deps.config === undefined ? smsConfig() : deps.config;
  if (c.action === "otp") {
    if (!config)
      throw new PublicError(
        "SMS не настроено. Владелец должен подключить Mobizon.",
      );
    const code = otpCode();
    const result = await db.$transaction(async (tx) => {
      const { b, phone } = await locked(tx, c.token, deps.authorizedStay);
      if (
        !b.requireOtp ||
        b.guestAcceptedAt ||
        b.bundleHash !== c.bundleHash ||
        !phone
      )
        throw unavailable();
      const duplicate = await tx.agreementOtp.findUnique({
        where: {
          bundleId_requestKey: { bundleId: b.id, requestKey: c.requestKey },
        },
      });
      if (duplicate)
        return { existing: true as const, challenge: duplicate, phone };
      const pHash = phoneHash(config.secret, phone);
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`document-otp:${pHash}`},0))::text`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`document-otp-org:${b.organizationId}`},0))::text`;
      const accountCount = await tx.agreementOtp.count({
        where: {
          bundle: { organizationId: b.organizationId },
          createdAt: { gte: new Date(Date.now() - 86400000) },
        },
      });
      if (accountCount >= 50)
        throw new PublicError("Лимит отправки объекта: 50 SMS за 24 часа.");
      const recent = await tx.agreementOtp.findFirst({
        where: { phoneHash: pHash },
        orderBy: { createdAt: "desc" },
      });
      const cooldown =
        recent && ["PENDING", "UNKNOWN"].includes(recent.state)
          ? 600000
          : 60000;
      if (recent && Date.now() - recent.createdAt.getTime() < cooldown)
        throw new PublicError(
          "Повторная отправка пока недоступна. При неизвестном результате ждите 10 минут и проверьте SMS.",
        );
      const count = await tx.agreementOtp.count({
        where: {
          phoneHash: pHash,
          createdAt: { gte: new Date(Date.now() - 86400000) },
        },
      });
      if (count >= 5)
        throw new PublicError("Лимит SMS на этот номер: 5 за 24 часа.");
      // Invalidate older codes, including previously accepted transport attempts.
      await tx.agreementOtp.updateMany({
        where: { bundleId: b.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      const id = token();
      const challenge = await tx.agreementOtp.create({
        data: {
          id,
          bundleId: b.id,
          requestKey: c.requestKey,
          phoneHash: pHash,
          codeHash: otpHash(config.secret, id, b.bundleHash, phone, code),
          state: "PENDING",
          expiresAt: new Date(Date.now() + 300000),
        },
      });
      await tx.agreementEvent.create({
        data: {
          bundleId: b.id,
          action: "OTP_REQUESTED",
          evidence: {
            challengeId: id,
            method: "MOBIZON",
            bundleHash: b.bundleHash,
          },
        },
      });
      return { existing: false as const, challenge, phone };
    });
    if (result.existing)
      return {
        kind: "json" as const,
        data: {
          challengeId: result.challenge.id,
          state: result.challenge.state,
          expiresAt: result.challenge.expiresAt.toISOString(),
          delivered: false,
        },
      };
    // Paid I/O only AFTER durable reservation of an attempt. A crash leaves PENDING;
    // request-key replay never sends again, even if outcome is ambiguous.
    let sent: SmsResult;
    try {
      sent = await (deps.send ?? sendOtpSms)(config, result.phone, code);
    } catch {
      sent = { state: "UNKNOWN" };
    }
    await db.$transaction(async (tx) => {
      await tx.agreementOtp.update({
        where: { id: result.challenge.id },
        data: {
          state: sent.state,
          providerMessageId: sent.state === "ACCEPTED" ? sent.messageId : null,
        },
      });
      await tx.agreementEvent.create({
        data: {
          bundleId: result.challenge.bundleId,
          action: "OTP_TRANSPORT_RESULT",
          evidence: {
            challengeId: result.challenge.id,
            state: sent.state,
            delivered: false,
          },
        },
      });
    });
    return {
      kind: "json" as const,
      data: {
        challengeId: result.challenge.id,
        state: sent.state,
        expiresAt: result.challenge.expiresAt.toISOString(),
        delivered: false,
      },
    };
  }
  const result = await db.$transaction(async (tx) => {
    const live = await locked(tx, c.token, deps.authorizedStay);
    const { b, phone } = live;
    if (c.bundleHash !== b.bundleHash) throw unavailable();
    const ids = new Set(c.acceptedItems);
    if (
      ids.size !== c.acceptedItems.length ||
      c.acceptedItems.some(
        (id) => !b.items.some((i) => i.id === id && i.kind !== "INFORMATION"),
      ) ||
      b.items.some((i) => i.required && !ids.has(i.id))
    )
      throw new PublicError("Примите каждый обязательный документ отдельно.");
    const actionHash = hash(
      JSON.stringify({
        signerName: c.signerName,
        acceptedItems: [...ids].sort(),
        consentVersion: c.consentVersion,
        bundleHash: b.bundleHash,
      }),
    );
    if (b.guestAcceptedAt) {
      const stored = b.guestEvidence as { actionHash?: string } | null;
      if (stored?.actionHash !== actionHash)
        throw new PublicError("Пакет уже принят с другими данными.");
      return { data: view(live) };
    }
    let method = "LINK_TYPED_NAME";
    if (b.requireOtp) {
      if (!config || !phone || !c.challengeId || !c.code)
        throw new PublicError("Введите SMS-код для этого пакета.");
      const challenge = await tx.agreementOtp.findFirst({
        where: { id: c.challengeId, bundleId: b.id },
      });
      if (
        !challenge ||
        challenge.state !== "ACCEPTED" ||
        challenge.consumedAt ||
        challenge.expiresAt <= new Date() ||
        challenge.attempts >= 5 ||
        !equalHash(challenge.phoneHash, phoneHash(config.secret, phone))
      )
        throw new PublicError("Код недоступен или истёк. Запросите новый.");
      const correct = equalHash(
        challenge.codeHash,
        otpHash(config.secret, challenge.id, b.bundleHash, phone, c.code),
      );
      await tx.agreementOtp.update({
        where: { id: challenge.id },
        data: {
          attempts: { increment: 1 },
          ...(correct ? { consumedAt: new Date() } : {}),
        },
      });
      // Return instead of throw: wrong-code attempt MUST commit, not roll back.
      if (!correct) return { error: "Неверный код. Не более 5 попыток." };
      method = "SMS_OTP_PHONE_CONTROL";
    }
    const acceptedAt = new Date();
    const record = {
      actionHash,
      bundleHash: b.bundleHash,
      consentVersion: CONSENT_VERSION,
      consentText: GUEST_CONSENT,
      acceptedItems: [...ids],
      signerName: c.signerName,
      acceptedAt: acceptedAt.toISOString(),
      method,
      challengeId: b.requireOtp ? c.challengeId : null,
      identityVerified: false,
      legalStatus: "NOT_LEGALLY_REVIEWED",
    };
    await tx.agreementBundle.update({
      where: { id: b.id },
      data: {
        guestAcceptedAt: acceptedAt,
        guestName: c.signerName,
        guestEvidence: json(record),
      },
    });
    await tx.agreementEvent.create({
      data: {
        bundleId: b.id,
        action: "GUEST_ACKNOWLEDGED",
        evidence: json(record),
      },
    });
    return { data: view(await load(tx, c.token, deps.authorizedStay)) };
  });
  if ("error" in result) throw new PublicError(result.error!);
  return { kind: "json" as const, data: result.data };
}
export type AgreementWorkspace = Awaited<ReturnType<typeof agreementWorkspace>>;
export type GuestAgreementView = ReturnType<typeof view>;
/** Validate the exact capability link and its immutable revision before message preparation. */
export async function validateAgreementAttachment(
  db: PrismaClient,
  m: CurrentMembership,
  reservationId: string,
  bundleId: string,
  body: string,
) {
  const b = await db.agreementBundle.findFirst({
    where: { id: bundleId, reservationId, ...tenant(m) },
  });
  if (!b) throw unavailable();
  const links = body.match(/https?:\/\/[^\s]+/g) ?? [];
  for (const link of links) {
    let url: URL;
    try {
      url = new URL(link);
    } catch {
      continue;
    }
    const value = url.hash.slice(1);
    if (!/^[a-f0-9]{64}$/.test(value) || hash(value) !== b.tokenHash) continue;
    if (bundleLink(process.env.APP_URL ?? "", value) !== link) continue;
    const live = await load(db, value);
    if (live.b.id === b.id) return { id: b.id, bundleHash: b.bundleHash };
  }
  throw new PublicError(
    "В сообщении отсутствует актуальная ссылка этого пакета. Создайте ссылку заново.",
  );
}

export function publicRulesLink(id: string) {
  try {
    const url = new URL(process.env.APP_URL ?? "");
    if (
      (url.protocol !== "https:" &&
        !(
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(url.hostname)
        )) ||
      Boolean(url.username || url.password)
    )
      return null;
    return `${url.origin}/rules/${encodeURIComponent(id)}`;
  } catch {
    return null;
  }
}
export async function publicRulesView(db: PrismaClient, id: string) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return null;
  const row = await db.publicPropertyRules.findFirst({
    where: { id, published: true, rentalProperty: { status: "ACTIVE" } },
    select: {
      text: true,
      version: true,
      updatedAt: true,
      rentalProperty: { select: { publicName: true } },
    },
  });
  return row
    ? {
        text: row.text,
        version: row.version,
        updatedAt: row.updatedAt.toISOString(),
        propertyName: row.rentalProperty.publicName,
      }
    : null;
}
