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
  const repeatGuests = rows.filter((guest) => guest.reservationCount > 1).length;
  const repeatRate = rows.length ? Math.round(repeatGuests / rows.length * 100) : 0;

  return (
    <div>
      <div className="hidden sm:block"><PageHeader
        title={locale === "kk" ? "Қонақтар" : t.guests.title}
        description={locale === "kk" ? "Қонақ профилі, байланыстары және сапарлар тарихы." : t.guests.description}
      /></div>
      <div className="mb-4 space-y-3 sm:hidden"><header><h1 className="sh-mobile-title">{locale === "kk" ? "Қонақтар" : "Гости"}</h1><p className="sh-mobile-eyebrow">{rows.length} {locale === "kk" ? "профиль" : "профилей"}</p></header><div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#138a70] to-[#08634f] p-4 text-white shadow-lg"><div className="absolute -bottom-14 -right-10 size-36 rounded-full border-[15px] border-[#dac785]/25" /><div className="relative flex items-center justify-between"><div><p className="text-[10px] font-semibold text-white/70">{locale === "kk" ? "Қайта келген қонақтар" : "Повторные гости"}</p><p className="mt-1 text-[25px] font-extrabold">{repeatRate}%</p><p className="mt-1 text-[9px] font-bold text-[#e5d894]">{repeatGuests} {locale === "kk" ? "қонақ қайта оралды" : "гостей вернулись"}</p></div><span className="rounded-full bg-white px-3 py-2 text-[10px] font-black text-[#087861]">CRM</span></div></div></div>
      <GuestsTable guests={rows} reservations={reservations} initialSelectedId={initialSelectedId} locale={locale} />
    </div>
  );
}
