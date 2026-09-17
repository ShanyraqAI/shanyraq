"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/tenant";
import { hasHotelPermission } from "@/lib/access";
import { firstZodError } from "@/lib/constants";
import { createDocumentSchema, documentProfileSchema } from "@/lib/documents/schema";
import { createReservationDocument, getReservationDocumentWorkspace } from "@/lib/documents/service";
import { PublicError, toErrorMessage } from "@/server/errors";
import { fail, ok, type ActionResult } from "@/server/types";
import { writeAudit } from "@/lib/reservations/service";

async function requireDocumentMembership(options: { owner?: boolean } = {}) {
  const membership = await getCurrentMembership();
  if (!membership) throw new PublicError("Требуется вход в аккаунт");
  if (options.owner && membership.role !== "OWNER") throw new PublicError("Только владелец может изменять реквизиты");
  if (!options.owner && !hasHotelPermission(membership, "RESERVATIONS")) throw new PublicError("Нет доступа к документам бронирований");
  return membership;
}

export async function saveDocumentProfileAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = documentProfileSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const membership = await requireDocumentMembership({ owner: true });
    const data = parsed.data;
    const nullable = (value: string) => value || null;
    await db.documentProfile.upsert({
      where: { organizationId: membership.organizationId },
      create: {
        organizationId: membership.organizationId,
        ...data,
        identityDocument: nullable(data.identityDocument),
        postalCode: nullable(data.postalCode),
        phone: nullable(data.phone),
        email: nullable(data.email),
        bankName: nullable(data.bankName),
        iban: nullable(data.iban),
        bic: nullable(data.bic),
        kbe: nullable(data.kbe),
        signerAuthority: nullable(data.signerAuthority),
        accountantName: nullable(data.accountantName),
        vatRegistrationNumber: nullable(data.vatRegistrationNumber),
      },
      update: {
        ...data,
        identityDocument: nullable(data.identityDocument),
        postalCode: nullable(data.postalCode),
        phone: nullable(data.phone),
        email: nullable(data.email),
        bankName: nullable(data.bankName),
        iban: nullable(data.iban),
        bic: nullable(data.bic),
        kbe: nullable(data.kbe),
        signerAuthority: nullable(data.signerAuthority),
        accountantName: nullable(data.accountantName),
        vatRegistrationNumber: nullable(data.vatRegistrationNumber),
      },
    });
    await writeAudit(membership.hotelId, "documents.profile_saved", "Organization", membership.organizationId);
    revalidatePath("/dashboard/settings");
    return ok(undefined, "Реквизиты сохранены");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function getReservationDocumentWorkspaceAction(reservationId: string): Promise<ActionResult<Awaited<ReturnType<typeof getReservationDocumentWorkspace>>>> {
  try {
    const membership = await requireDocumentMembership();
    const workspace = await getReservationDocumentWorkspace(membership.organizationId, membership.hotelId, reservationId);
    return ok(workspace);
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function createReservationDocumentAction(input: unknown): Promise<ActionResult<{ id: string; documentNumber: string }>> {
  try {
    const parsed = createDocumentSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const membership = await requireDocumentMembership();
    const document = await createReservationDocument({
      organizationId: membership.organizationId,
      hotelId: membership.hotelId,
      userId: membership.userId,
      input: parsed.data,
    });
    await writeAudit(membership.hotelId, "reservation.document_created", "GeneratedDocument", document.id, {
      reservationId: parsed.data.reservationId,
      type: parsed.data.type,
      documentNumber: document.documentNumber,
    });
    revalidatePath("/dashboard/reservations");
    return ok({ id: document.id, documentNumber: document.documentNumber }, "Документ создан");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}
