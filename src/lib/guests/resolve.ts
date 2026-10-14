import type { Prisma } from "@prisma/client";
import { PublicError } from "@/server/errors";
/** Only an explicit tenant-owned ID reuses a profile; names or contact details never prove identity. */
export async function resolveGuest(
  tx: Prisma.TransactionClient,
  hotelId: string,
  input: {
    guestId?: string;
    guestName?: string;
    guestEmail?: string | null;
    guestPhone?: string | null;
    country?: string | null;
  },
): Promise<{ id: string; created: boolean }> {
  if (input.guestId) {
    const existing = await tx.guest.findFirst({
      where: { id: input.guestId, hotelId },
      select: { id: true },
    });
    if (!existing) throw new PublicError("Гость не найден в текущем объекте.");
    return { id: existing.id, created: false };
  }
  const fullName = input.guestName?.trim();
  if (!fullName) throw new PublicError("Укажите гостя.");
  const created = await tx.guest.create({
    data: {
      hotelId,
      fullName,
      email: input.guestEmail || null,
      phone: input.guestPhone || null,
      country: input.country || null,
    },
    select: { id: true },
  });
  return { id: created.id, created: true };
}
