import { db, getCurrentHotelId } from "@/lib/db";
import { getAllReservations } from "@/lib/stats";
import { toReservationVM } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { GuestsTable, type GuestRow } from "@/components/guests/guests-table";
import { t } from "@/lib/i18n";
import { requireSectionAccess } from "@/server/guards";

export const dynamic = "force-dynamic";

export default async function GuestsPage() {
  await requireSectionAccess("FULL");
  const hotelId = await getCurrentHotelId();
  const [guestsRaw, reservationsRaw] = await Promise.all([
    db.guest.findMany({ where: { hotelId }, orderBy: { fullName: "asc" } }),
    getAllReservations(hotelId),
  ]);

  const reservations = reservationsRaw.map(toReservationVM);

  const rows: GuestRow[] = guestsRaw.map((g) => {
    const mine = reservations.filter((r) => r.guestId === g.id && !["CANCELLED", "NO_SHOW"].includes(r.status));
    const last = mine.sort((a, b) => (a.checkIn < b.checkIn ? 1 : -1))[0];
    return {
      id: g.id,
      fullName: g.fullName,
      email: g.email,
      phone: g.phone,
      country: g.country,
      notes: g.notes,
      reservationCount: mine.length,
      lastStay: last?.checkIn ?? null,
      lastChannel: last?.channel ?? null,
    };
  });

  return (
    <div>
      <PageHeader
        title={t.guests.title}
        description={t.guests.description}
      />
      <GuestsTable guests={rows} reservations={reservations} />
    </div>
  );
}
