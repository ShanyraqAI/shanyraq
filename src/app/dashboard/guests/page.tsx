import { db, getCurrentHotelId } from "@/lib/db";
import { loadGuestPage } from "@/lib/guests/service";
import Link from "next/link";
import { GUEST_PAGE_SIZE, guestPageUrl } from "@/lib/guests/pagination";
import { PageHeader } from "@/components/shared/page-header";
import { GuestsTable } from "@/components/guests/guests-table";
import { t } from "@/lib/i18n";
import { requireSectionAccess } from "@/server/guards";
import { getRequestLocale } from "@/lib/locale-server";

export const dynamic = "force-dynamic";

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{
    guest?: string | string[];
    page?: string;
    q?: string;
    stays?: string;
    notes?: string;
    tab?: string;
  }>;
}) {
  await requireSectionAccess("GUESTS");
  const hotelId = await getCurrentHotelId();
  const locale = await getRequestLocale();
  const params = await searchParams;
  const initialSelectedId =
    typeof params.guest === "string" ? params.guest : null;
  const {
    page,
    stays,
    notes,
    q,
    total,
    rows,
    reservations,
    repeatGuests,
    guestTotal,
    repeatRate,
    detailCounts,
    notesTotal,
  } = await loadGuestPage(db, hotelId, {
    ...params,
    guest: initialSelectedId ?? undefined,
  });

  return (
    <div>
      <div className="hidden sm:block">
        <PageHeader
          title={locale === "kk" ? "Қонақтар" : t.guests.title}
          description={
            locale === "kk"
              ? "Қонақ профилі, байланыстары және сапарлар тарихы."
              : t.guests.description
          }
        />
      </div>
      <div className="mb-4 space-y-3 sm:hidden">
        <header>
          <h1 className="sh-mobile-title">
            {locale === "kk" ? "Қонақтар" : "Гости"}
          </h1>
          <p className="sh-mobile-eyebrow">
            {guestTotal} {locale === "kk" ? "профиль" : "профилей"}
          </p>
        </header>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#138a70] to-[#08634f] p-4 text-white shadow-lg">
          <div className="absolute -bottom-14 -right-10 size-36 rounded-full border-[15px] border-[#dac785]/25" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold text-white/70">
                {locale === "kk" ? "Қайта келген қонақтар" : "Повторные гости"}
              </p>
              <p className="mt-1 text-[25px] font-extrabold">{repeatRate}%</p>
              <p className="mt-1 text-[9px] font-bold text-[#e5d894]">
                {repeatGuests}{" "}
                {locale === "kk" ? "қонақ қайта оралды" : "гостей вернулись"}
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-2 text-[10px] font-black text-[#087861]">
              CRM
            </span>
          </div>
        </div>
      </div>
      <GuestsTable
        key={`${page}:${q}:${initialSelectedId}:${stays}:${notes}:${params.tab}`}
        guests={rows}
        reservations={reservations}
        initialSelectedId={initialSelectedId}
        locale={locale}
        serverQuery={q}
        page={page}
        staysPage={stays}
        notesPage={notes}
        historyTotal={detailCounts}
        notesTotal={notesTotal}
        detailTab={params.tab === "notes" ? "notes" : "stays"}
      />
      <nav
        aria-label="Страницы гостей"
        className="mt-4 flex min-h-11 items-center justify-between gap-3 text-sm"
      >
        {page > 1 ? (
          <Link
            className="flex min-h-11 items-center rounded-xl border px-3"
            href={guestPageUrl({ page: page - 1, q })}
          >
            Назад
          </Link>
        ) : (
          <span />
        )}
        <span>
          Страница {page} · найдено {total}
        </span>
        {page * GUEST_PAGE_SIZE < total ? (
          <Link
            className="flex min-h-11 items-center rounded-xl border px-3"
            href={guestPageUrl({ page: page + 1, q })}
          >
            Далее
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
