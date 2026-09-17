import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseISODate } from "@/lib/dates";
import { PublicError } from "@/server/errors";
import { officialDocumentNumber } from "@/lib/documents/numbers";
import {
  createDocumentSchema,
  type CreateDocumentInput,
  type DocumentDraft,
  type DocumentProfileValues,
  type DocumentType,
  type GeneratedDocumentListItem,
} from "@/lib/documents/schema";

export const EMPTY_DOCUMENT_PROFILE: DocumentProfileValues = {
  entityType: "INDIVIDUAL_ENTREPRENEUR",
  legalName: "",
  iinBin: "",
  identityDocument: "",
  postalCode: "",
  legalAddress: "",
  phone: "",
  email: "",
  bankName: "",
  iban: "",
  bic: "",
  kbe: "",
  signerName: "",
  signerTitle: "Руководитель",
  signerAuthority: "",
  accountantName: "",
  vatMode: "WITHOUT_VAT",
  vatRegistrationNumber: "",
  defaultPaymentTerms: "Оплата наличными или переводом",
};

function toProfileValues(profile: Record<string, unknown> | null): DocumentProfileValues | null {
  if (!profile) return null;
  return {
    entityType: profile.entityType as DocumentProfileValues["entityType"],
    legalName: String(profile.legalName),
    iinBin: String(profile.iinBin),
    identityDocument: String(profile.identityDocument ?? ""),
    postalCode: String(profile.postalCode ?? ""),
    legalAddress: String(profile.legalAddress),
    phone: String(profile.phone ?? ""),
    email: String(profile.email ?? ""),
    bankName: String(profile.bankName ?? ""),
    iban: String(profile.iban ?? ""),
    bic: String(profile.bic ?? ""),
    kbe: String(profile.kbe ?? ""),
    signerName: String(profile.signerName),
    signerTitle: String(profile.signerTitle),
    signerAuthority: String(profile.signerAuthority ?? ""),
    accountantName: String(profile.accountantName ?? ""),
    vatMode: profile.vatMode as DocumentProfileValues["vatMode"],
    vatRegistrationNumber: String(profile.vatRegistrationNumber ?? ""),
    defaultPaymentTerms: String(profile.defaultPaymentTerms),
  };
}

export async function getDocumentProfile(organizationId: string): Promise<DocumentProfileValues | null> {
  const profile = await db.documentProfile.findUnique({ where: { organizationId } });
  return toProfileValues(profile);
}

export async function getReservationDocumentWorkspace(
  organizationId: string,
  hotelId: string,
  reservationId: string,
): Promise<{ profile: DocumentProfileValues | null; draft: DocumentDraft; documents: GeneratedDocumentListItem[] }> {
  const [profile, reservation, documents] = await Promise.all([
    getDocumentProfile(organizationId),
    db.reservation.findFirst({
      where: { id: reservationId, hotelId, hotel: { orgId: organizationId } },
      select: {
        id: true,
        checkIn: true,
        checkOut: true,
        checkInTime: true,
        checkOutTime: true,
        adults: true,
        children: true,
        totalAmount: true,
        currency: true,
        guest: { select: { fullName: true } },
        room: { select: { number: true } },
        hotel: { select: { name: true, address: true, city: true } },
      },
    }),
    db.generatedDocument.findMany({
      where: { organizationId, hotelId, reservationId },
      orderBy: { createdAt: "desc" },
      select: { id: true, type: true, documentNumber: true, documentDate: true, createdAt: true },
    }),
  ]);
  if (!reservation) throw new PublicError("Бронирование не найдено");

  const checkIn = reservation.checkIn.toISOString().slice(0, 10);
  const checkOut = reservation.checkOut.toISOString().slice(0, 10);
  const nights = Math.max(1, Math.round((reservation.checkOut.getTime() - reservation.checkIn.getTime()) / 86_400_000));
  const totalAmount = Number(reservation.totalAmount);
  const propertyAddress = [reservation.hotel.city, reservation.hotel.address, `квартира/номер ${reservation.room.number}`].filter(Boolean).join(", ");
  const serviceDescription = `Услуги краткосрочного проживания по адресу: ${propertyAddress}; период: ${checkIn}–${checkOut}; гость: ${reservation.guest.fullName}`;
  const today = new Date().toISOString().slice(0, 10);

  return {
    profile,
    draft: {
      reservationId,
      type: "CONTRACT",
      documentDate: today,
      customerType: "INDIVIDUAL",
      guestFullName: reservation.guest.fullName,
      guestIin: "",
      guestIdentityDocument: "",
      companyName: "",
      companyBin: "",
      companyAddress: "",
      companyIban: "",
      companyBic: "",
      companyBankName: "",
      representativeName: reservation.guest.fullName,
      representativeIin: "",
      representativeTitle: "",
      representativeAuthority: "",
      propertyAddress,
      checkIn,
      checkOut,
      checkInTime: reservation.checkInTime,
      checkOutTime: reservation.checkOutTime,
      unit: "сутки",
      quantity: nights,
      unitPrice: Math.round((totalAmount / nights) * 100) / 100,
      totalAmount,
      serviceDescription,
      contractReference: "",
      paymentTerms: profile?.defaultPaymentTerms ?? EMPTY_DOCUMENT_PROFILE.defaultPaymentTerms,
      completionDate: checkOut,
      maxGuests: reservation.adults + reservation.children,
      keyLossFine: 5000,
      customerSignerName: reservation.guest.fullName,
      customerSignerTitle: "",
      issuedByName: profile?.signerName ?? "",
    },
    documents: documents.map((item) => ({
      id: item.id,
      type: item.type as DocumentType,
      documentNumber: officialDocumentNumber(item.documentNumber),
      documentDate: item.documentDate.toISOString().slice(0, 10),
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

export async function createReservationDocument(params: {
  organizationId: string;
  hotelId: string;
  userId: string;
  input: CreateDocumentInput;
}) {
  const input = createDocumentSchema.parse(params.input);
  const [profile, reservation] = await Promise.all([
    db.documentProfile.findUnique({ where: { organizationId: params.organizationId } }),
    db.reservation.findFirst({
      where: { id: input.reservationId, hotelId: params.hotelId, hotel: { orgId: params.organizationId } },
      select: { id: true, currency: true, hotel: { select: { city: true, name: true } } },
    }),
  ]);
  if (!profile) throw new PublicError("Сначала заполните реквизиты для документов в настройках");
  if (!reservation) throw new PublicError("Бронирование не найдено");

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`document:${params.organizationId}:${input.type}`}, 0))`;
    const sequence = await tx.documentSequence.upsert({
      where: { organizationId_type: { organizationId: params.organizationId, type: input.type } },
      create: { organizationId: params.organizationId, type: input.type, nextNumber: 2 },
      update: { nextNumber: { increment: 1 } },
    });
    const sequenceNumber = sequence.nextNumber - 1;
    const documentNumber = String(sequenceNumber);
    const snapshot = {
      version: 1,
      type: input.type,
      documentNumber,
      documentDate: input.documentDate,
      currency: reservation.currency,
      city: reservation.hotel.city ?? "Казахстан",
      hotelName: reservation.hotel.name,
      profile: toProfileValues(profile),
      data: input,
    };
    return tx.generatedDocument.create({
      data: {
        organizationId: params.organizationId,
        hotelId: params.hotelId,
        reservationId: reservation.id,
        createdById: params.userId,
        type: input.type,
        sequenceNumber,
        documentNumber,
        documentDate: parseISODate(input.documentDate),
        snapshot: snapshot as Prisma.InputJsonValue,
      },
      select: { id: true, type: true, documentNumber: true, documentDate: true, createdAt: true },
    });
  });
}
