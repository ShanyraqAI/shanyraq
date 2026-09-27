"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Check, ChevronLeft, Loader2, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { setReservationStatusAction } from "@/server/actions/reservations";
import type { AppLocale } from "@/lib/locale";
import type { ReservationVM } from "@/lib/types";
import { reservationDisplayId } from "@/lib/types";
import { channelLabel } from "@/lib/i18n";
import { formatISOCompactDate } from "@/lib/dates";
import { formatMoney } from "@/lib/utils";

export function MobileReservationDetail({ reservation, locale }: { reservation: ReservationVM; locale: AppLocale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const kk = locale === "kk";
  const nextStatus = reservation.status === "CHECKED_IN" ? "CHECKED_OUT" : "CHECKED_IN";
  const canUpdateStatus = ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(reservation.status);

  function updateStatus() {
    startTransition(async () => {
      const result = await setReservationStatusAction({ id: reservation.id, status: nextStatus });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(nextStatus === "CHECKED_IN" ? (kk ? "Қонақ орналастырылды" : "Гость заселён") : (kk ? "Қонақ шығарылды" : "Гость выселен"));
      router.refresh();
    });
  }

  return <div className="mx-auto max-w-md space-y-4">
    <header className="flex items-start gap-3"><button type="button" onClick={() => router.back()} className="mt-0.5 grid size-9 place-items-center rounded-full bg-white ring-1 ring-[#e7e9e1]"><ChevronLeft className="size-5" /></button><div className="min-w-0 flex-1"><h1 className="sh-mobile-title">{kk ? "Бронь" : "Бронь"} #{reservationDisplayId(reservation.sequenceNumber)}</h1><p className="sh-mobile-eyebrow truncate">{reservation.guestName}</p></div></header>
    <div className="flex gap-2"><span className="rounded-full bg-[#e1f3ec] px-3 py-1 text-[9px] font-bold text-[#16826a]">{reservation.status === "CHECKED_IN" ? (kk ? "Орналасты" : "Заселён") : (kk ? "Расталды" : "Подтверждена")}</span><span className="rounded-full bg-[#e4edfb] px-3 py-1 text-[9px] font-bold text-[#5187d4]">{reservation.paymentMethod === "ONLINE" ? (kk ? "Онлайн төленді" : "Оплачено") : (kk ? "Төлем орнында" : "Оплата на месте")}</span></div>
    <section className="sh-mobile-card p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-base font-extrabold text-[#2c3932]">{reservation.roomNumber} · {reservation.roomTypeName}</p><p className="mt-1 text-[10px] text-[#939991]">{formatISOCompactDate(reservation.checkIn)}, {reservation.checkInTime} → {formatISOCompactDate(reservation.checkOut)}, {reservation.checkOutTime}</p></div><b className="text-sm text-[#2f3b35]">{formatMoney(reservation.totalAmount)}</b></div><div className="mt-3 flex gap-3 border-t border-[#eff0ea] pt-3 text-[10px] text-[#727a73]"><span>{reservation.adults} {kk ? "ересек" : "взр."}</span><span>{reservation.children} {kk ? "бала" : "детей"}</span><span>{channelLabel(reservation.channel)}</span></div></section>
    <div className="grid grid-cols-3 gap-2"><a href={reservation.guestPhone ? `tel:${reservation.guestPhone}` : undefined} className="sh-mobile-card flex min-h-14 flex-col items-center justify-center gap-1 text-[9px] font-bold text-[#16826a]"><Phone className="size-4" />{kk ? "Қоңырау" : "Позвонить"}</a><a href={reservation.guestPhone ? `https://wa.me/${reservation.guestPhone.replace(/\D/g, "")}` : undefined} target="_blank" rel="noopener noreferrer" className="sh-mobile-card flex min-h-14 flex-col items-center justify-center gap-1 text-[9px] font-bold text-[#16826a]"><MessageCircle className="size-4" />{kk ? "Жазу" : "Написать"}</a>{canUpdateStatus ? <button type="button" disabled={pending} onClick={updateStatus} className="sh-mobile-card flex min-h-14 flex-col items-center justify-center gap-1 text-[9px] font-bold text-[#16826a]">{pending ? <Loader2 className="size-4 animate-spin" /> : nextStatus === "CHECKED_IN" ? <Check className="size-4" /> : <CalendarCheck className="size-4" />}{nextStatus === "CHECKED_IN" ? (kk ? "Орналастыру" : "Заселить") : (kk ? "Шығару" : "Выселить")}</button> : <span className="sh-mobile-card flex min-h-14 flex-col items-center justify-center gap-1 text-[9px] font-bold text-muted-foreground"><Check className="size-4" />{kk ? "Аяқталды" : "Завершено"}</span>}</div>
    <section><h2 className="sh-mobile-section-title mb-2">{kk ? "Төлем" : "Оплата"}</h2><div className="sh-mobile-card space-y-2 p-4 text-xs"><Row label={kk ? "Барлығы" : "Итого"} value={formatMoney(reservation.totalAmount)} /><Row label={kk ? "Төленді" : "Оплачено"} value={reservation.paymentMethod === "ONLINE" ? formatMoney(reservation.totalAmount) : formatMoney(0)} accent /><Row label={kk ? "Әдіс" : "Способ"} value={reservation.paymentMethod === "ONLINE" ? "Online" : kk ? "Орнында" : "На месте"} /></div></section>
    <section><h2 className="sh-mobile-section-title mb-2">{kk ? "Қонақ деректері" : "Детали гостя"}</h2><div className="sh-mobile-card space-y-2 p-4 text-xs"><Row label={kk ? "Телефон" : "Телефон"} value={reservation.guestPhone ?? "—"} /><Row label="Email" value={reservation.guestEmail ?? "—"} /><Row label={kk ? "Түсініктеме" : "Комментарий"} value={reservation.notes ?? (kk ? "Жоқ" : "Нет")} /></div></section>
    <Link href={`/dashboard/reservations?reservation=${reservation.id}`} className="sh-mobile-primary flex w-full items-center justify-center">{kk ? "Броньды өзгерту" : "Изменить бронь"}</Link>
  </div>;
}

function Row({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) { return <div className="flex items-start justify-between gap-4"><span className="text-[#919790]">{label}</span><span className={accent ? "font-bold text-[#07866b]" : "text-right font-bold text-[#3b4740]"}>{value}</span></div>; }
