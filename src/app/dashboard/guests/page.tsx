import { db, getCurrentHotelId } from "@/lib/db";
import { getAllReservations } from "@/lib/stats";
import { toReservationVM } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { GuestsTable, type GuestRow } from "@/components/guests/guests-table";
import { t } from "@/lib/i18n";
import { requireSectionAccess } from "@/server/guards";
import { getRequestLocale } from "@/lib/locale-server";

export const dynamic = "force-dynamic";

export default async function GuestsPage({ searchParams }: { searchParams: Promise<{ guest?: string | string[] }> }) {
  await requireSectionAccess("GUESTS");
  const hotelId = await getCurrentHotelId();
  const locale = await getRequestLocale();
  const params = await searchParams;
  const initialSelectedId = typeof params.guest === "string" ? params.guest : null;
  const [guestsRaw, reservationsRaw] = await Promise.all([
    db.guest.findMany({ where: { hotelId }, orderBy: { sequenceNumber: "desc" }, include: { internalNotes: { orderBy: { createdAt: "desc" }, include: { author: { select: { fullName: true } } } } } }),
    getAllReservations(hotelId),
  ]);

  const reservations = reservationsRaw.map(toReservationVM);

  const rows: GuestRow[] = guestsRaw.map((g) => {
    const mine = reservations.filter((r) => r.guestId === g.id && !["CANCELLED", "NO_SHOW"].includes(r.status));
    const last = mine.sort((a, b) => (a.checkIn < b.checkIn ? 1 : -1))[0];
    return {
      id: g.id,
      sequenceNumber: g.sequenceNumber,
      fullName: g.fullName,
      email: g.email,
      phone: g.phone,
      country: g.country,
      notes: g.notes,
      internalNotes: g.internalNotes.map((note) => ({ id: note.id, content: note.content, createdAt: note.createdAt.toISOString(), authorName: note.author.fullName })),
      reservationCount: mine.length,
      lastStay: last?.checkIn ?? null,
      lastChannel: last?.channel ?? null,
    };
  });

  return (
    <div>
      <PageHeader
        title={locale === "kk" ? "Қонақтар" : t.guests.title}
        description={locale === "kk" ? "Қонақ профилі, байланыстары және сапарлар тарихы." : t.guests.description}
      />
      <GuestsTable guests={rows} reservations={reservations} initialSelectedId={initialSelectedId} locale={locale} />
    </div>
  );
}
