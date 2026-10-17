import { db } from "@/lib/db";
import type { CurrentMembership } from "@/lib/tenant";
import { PublicError } from "@/server/errors";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp";
import { profileSchema, type commandSchema } from "./schema";
import type { z } from "zod";
import { validateFinalMessage, validateTemplateSyntax } from "./template";
import type { CommunicationWorkspace, ReservationCommunicationWorkspace } from "./types";

function optionalRecipientPhone(value: string | null | undefined) { const phone = normalizeWhatsAppPhone(value); return phone && /^[1-9][0-9]{9,14}$/.test(phone) ? phone : null; }

export const scopeOf = (m: CurrentMembership) => `${m.organizationId}:${m.hotelId}`;
const tenant = (m: CurrentMembership) => ({ organizationId: m.organizationId, hotelId: m.hotelId });
const photoSelect = { id: true, name: true, position: true } as const;
const templateSelect = { id: true, name: true, body: true, language: true, status: true, roomId: true, version: true, isDefault: true } as const;

export async function requireRoom(m: CurrentMembership, roomId: string) {
  const room = await db.room.findFirst({ where: { id: roomId, hotelId: m.hotelId, hotel: { orgId: m.organizationId } }, include: { rentalProperty: true } });
  if (!room) throw new PublicError("Квартира не найдена в текущем объекте");
  return room;
}
export async function requireReservation(m: CurrentMembership, reservationId: string) {
  const reservation = await db.reservation.findFirst({
    where: { id: reservationId, hotelId: m.hotelId, hotel: { orgId: m.organizationId } },
    include: { guest: true, room: { include: { communicationProfile: true, rentalProperty: true } }, hotel: true },
  });
  if (!reservation) throw new PublicError("Бронь не найдена в текущем объекте");
  return reservation;
}
export async function getCommunicationWorkspace(m: CurrentMembership, cursor?: string): Promise<CommunicationWorkspace> {
  if (cursor && !await db.guestCommunication.findFirst({ where: { id: cursor, ...tenant(m) }, select: { id: true } })) throw new PublicError("История не найдена");
  const [rooms, templates, history] = await Promise.all([
    db.room.findMany({ where: { hotelId: m.hotelId, hotel: { orgId: m.organizationId } }, orderBy: { number: "asc" }, include: { communicationProfile: true, rentalProperty: true, communicationPhotos: { where: { archivedAt: null }, orderBy: { position: "asc" }, select: photoSelect } } }),
    db.communicationTemplate.findMany({ where: tenant(m), orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }], select: templateSelect }),
    db.guestCommunication.findMany({ where: tenant(m), orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 51, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true, reservationId: true, state: true, createdAt: true, reservation: { select: { guest: { select: { fullName: true } } } } } }),
  ]);
  return {
    rooms: rooms.map((room) => ({ id: room.id, label: `${room.number} · ${room.rentalProperty.publicName}`, version: room.communicationProfile?.version ?? 0,
      profile: profileSchema.parse(room.communicationProfile ?? { publicName: `${room.rentalProperty.publicName} · ${room.number}`, address: room.rentalProperty.address ?? "" }), photos: room.communicationPhotos })),
    templates, history: history.slice(0, 50).map((h) => ({ id: h.id, guestName: h.reservation.guest.fullName, reservationId: h.reservationId, state: h.state, createdAt: h.createdAt.toISOString() })),
    nextCursor: history.length > 50 ? history[49].id : null, owner: m.role === "OWNER", scope: scopeOf(m),
  };
}
export async function getReservationCommunicationWorkspace(m: CurrentMembership, id: string): Promise<ReservationCommunicationWorkspace> {
  const r = await requireReservation(m, id);
  const [templates, photos] = await Promise.all([
    db.communicationTemplate.findMany({ where: { ...tenant(m), status: "ACTIVE", OR: [{ roomId: null }, { roomId: r.roomId }] }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }], select: templateSelect }),
    db.communicationPhoto.findMany({ where: { ...tenant(m), roomId: r.roomId, archivedAt: null }, orderBy: { position: "asc" }, select: photoSelect }),
  ]);
  templates.sort((a, b) => Number(b.roomId === r.roomId && b.isDefault) - Number(a.roomId === r.roomId && a.isDefault) || Number(b.language === r.hotel.language) - Number(a.language === r.hotel.language));
  const p = r.room.communicationProfile;
  const date = (value: Date) => value.toISOString().slice(0, 10).split("-").reverse().join(".");
  return { reservationId: r.id, guestName: r.guest.fullName, phone: optionalRecipientPhone(r.guest.phone), roomName: `${r.room.number} · ${r.room.rentalProperty.publicName}`, scope: scopeOf(m), draftScope: `${m.userId}:${scopeOf(m)}:${r.id}`, templates, photos,
    values: {
      guest_name: r.guest.fullName, guest_phone: r.guest.phone ?? "", reservation_number: r.sequenceNumber?.toString() ?? r.id,
      checkin_date: date(r.checkIn), checkin_time: r.checkInTime, checkout_date: date(r.checkOut), checkout_time: r.checkOutTime,
      nights_count: Math.round((r.checkOut.getTime() - r.checkIn.getTime()) / 86400000).toString(),
      total_amount: r.totalAmount.toString(), currency: r.currency,
      property_name: p?.publicName || `${r.room.rentalProperty.publicName} · ${r.room.number}`,
      property_address: p?.address || r.room.rentalProperty.address || "", property_map_link: p?.mapLink ?? "",
      wifi_name: p?.wifiName ?? "", wifi_password: p?.wifiPassword ?? "", key_instructions: p?.keyInstructions ?? "",
      rules_link: p?.rulesLink ?? "", checkin_guide_link: p?.checkinGuideLink ?? "", support_phone: p?.supportPhone ?? "",
    },
  };
}

export async function runCommunicationCommand(m: CurrentMembership, command: z.infer<typeof commandSchema>) {
  const t = tenant(m);
  if (command.action === "saveProfile") {
    await requireRoom(m, command.roomId);
    return db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`communication-profile:${command.roomId}`}, 0))::text`;
      const old = await tx.communicationProfile.findFirst({ where: { ...t, roomId: command.roomId } });
      if ((old?.version ?? 0) !== command.version) throw new PublicError("Данные изменились на другом устройстве. Обновите страницу.");
      const saved = await tx.communicationProfile.upsert({ where: { roomId: command.roomId }, create: { ...t, roomId: command.roomId, ...command.profile }, update: { ...command.profile, version: { increment: 1 } }, select: { id: true, version: true } });
      await tx.auditLog.create({ data: { hotelId: m.hotelId, actorUserId: m.userId, actor: m.userId, action: "communication.profile_saved", entity: "CommunicationProfile", entityId: saved.id } });
      return saved;
    });
  }
  if (command.action === "saveTemplate") {
    const input = command.template;
    const syntaxError = validateTemplateSyntax(input.body);
    if (syntaxError) throw new PublicError(syntaxError);
    if (input.roomId) await requireRoom(m, input.roomId);
    return db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`communication-template:${m.hotelId}`}, 0))::text`;
      const old = input.id ? await tx.communicationTemplate.findFirst({ where: { id: input.id, ...t } }) : null;
      if (input.id && !old) throw new PublicError("Шаблон не найден");
      if ((old?.version ?? 0) !== input.version) throw new PublicError("Шаблон изменился. Обновите страницу.");
      if (input.isDefault && input.status !== "ACTIVE") throw new PublicError("Шаблон по умолчанию должен быть активным");
      if (input.isDefault) await tx.communicationTemplate.updateMany({ where: { ...t, roomId: input.roomId, language: input.language, isDefault: true }, data: { isDefault: false } });
      const data = { name: input.name, body: input.body, roomId: input.roomId, language: input.language, status: input.status, isDefault: input.isDefault };
      const saved = old ? await tx.communicationTemplate.update({ where: { id: old.id }, data: { ...data, version: { increment: 1 } } }) : await tx.communicationTemplate.create({ data: { ...t, ...data } });
      await tx.communicationTemplateVersion.create({ data: { templateId: saved.id, hotelId: m.hotelId, version: saved.version, snapshot: data } });
      await tx.auditLog.create({ data: { hotelId: m.hotelId, actorUserId: m.userId, actor: m.userId, action: "communication.template_saved", entity: "CommunicationTemplate", entityId: saved.id } });
      return { id: saved.id, version: saved.version };
    });
  }
  if (command.action === "archivePhoto") {
    return db.$transaction(async (tx) => {
      const changed = await tx.communicationPhoto.updateMany({ where: { id: command.photoId, ...t, archivedAt: null }, data: { archivedAt: new Date() } });
      if (!changed.count) throw new PublicError("Фото не найдено");
      await tx.auditLog.create({ data: { hotelId: m.hotelId, actorUserId: m.userId, actor: m.userId, action: "communication.photo_archived", entity: "CommunicationPhoto", entityId: command.photoId } });
      return { ok: true };
    });
  }
  if (command.action === "prepare") {
    const error = validateFinalMessage(command.body);
    if (error) throw new PublicError(error);
    const r = await requireReservation(m, command.reservationId);
    if (["CANCELLED", "NO_SHOW"].includes(r.status)) throw new PublicError("Нельзя подготовить сообщение для отменённой брони или неявки");
    if (command.signingRequestId) {
      const signing = await db.documentSigningRequest.findFirst({ where: { id: command.signingRequestId, ...t, reservationId: r.id, revokedAt: null, expiresAt: { gt: new Date() } }, select: { signedAt: true, reservationVersion: true } });
      if (!signing || (!signing.signedAt && signing.reservationVersion.getTime() !== r.updatedAt.getTime())) throw new PublicError("Ссылка на документ устарела. Создайте новую и проверьте текст.");
    }
    if (command.agreementBundleId) {
      if (process.env.GUEST_DOCUMENT_BUNDLES_ENABLED !== "true") throw new PublicError("Пакеты документов ещё не включены.");
      if (command.signingRequestId) throw new PublicError("Выберите один документ или один пакет.");
      const { validateAgreementAttachment } = await import("@/lib/agreements/service");
      await validateAgreementAttachment(db, m, r.id, command.agreementBundleId, command.body);
    }
    const phone = optionalRecipientPhone(r.guest.phone);
    const ids = [...new Set(command.photoIds)];
    const photos = await db.communicationPhoto.findMany({ where: { ...t, roomId: r.roomId, archivedAt: null, id: { in: ids } }, select: { id: true, name: true } });
    if (photos.length !== ids.length) throw new PublicError("Некоторые фото недоступны. Обновите список.");
    const template = command.templateId ? await db.communicationTemplate.findFirst({ where: { id: command.templateId, ...t, status: "ACTIVE", OR: [{ roomId: null }, { roomId: r.roomId }] }, select: { id: true, version: true } }) : null;
    if (command.templateId && !template) throw new PublicError("Шаблон больше не доступен для этой квартиры");
    // A request key is hotel-scoped; retries return the immutable original snapshot.
    const message = await db.guestCommunication.upsert({ where: { hotelId_requestKey: { hotelId: m.hotelId, requestKey: command.requestKey } },
      create: { ...t, reservationId: r.id, roomId: r.roomId, createdById: m.userId, requestKey: command.requestKey, recipientPhone: phone, body: command.body, attachments: photos, templateId: template?.id, templateVersion: template?.version }, update: {} });
    if (message.reservationId !== r.id || message.createdById !== m.userId) throw new PublicError("Повторный запрос не соответствует сообщению");
    return { id: message.id, text: message.body, phone: message.recipientPhone, photoIds: (message.attachments as Array<{ id: string }>).map((p) => p.id), scope: scopeOf(m) };
  }
  const message = await db.guestCommunication.findFirst({ where: { id: command.messageId, ...t, createdById: m.userId } });
  if (!message) throw new PublicError("Сообщение не найдено");
  await db.guestCommunication.updateMany({ where: { id: message.id, ...t, state: "DRAFT" }, data: { state: command.state, handoffAt: new Date() } });
  return { ok: true };
}
