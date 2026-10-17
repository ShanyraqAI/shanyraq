"use client";

import Link from "next/link";
import { GuestPaymentRequestButton } from "@/components/guest-payments/request";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, CalendarRange, Check, ChevronLeft, ChevronRight, CircleDot, FileText, Loader2, MessageCircle, Pencil, Phone, KeyRound, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { runOfflineAction } from "@/lib/offline/actions";
import { issueReservationPasscodeAction } from "@/server/actions/ttlock";
import type { AppLocale } from "@/lib/locale";
import type { GuestVM, RatePlanVM, ReservationVM, RoomVM } from "@/lib/types";
import { ReservationFormDialog } from "./reservation-form-dialog";
import { ReservationDocumentsDialog } from "./reservation-documents-dialog";
import { reservationDisplayId } from "@/lib/types";
import { channelLabel } from "@/lib/i18n";
import { formatISOCompactDate } from "@/lib/dates";
import { formatMoney } from "@/lib/utils";
import { CommunicationComposer } from "@/components/communications/composer";
import { whatsappHref } from "@/lib/whatsapp";

export function MobileReservationDetail({ reservation, rooms, ratePlans, guests, hotelCurrency, locale, ttlockReady, ttlockPasscode, guestPaymentsEnabled = false }: { reservation: ReservationVM; rooms: RoomVM[]; ratePlans: RatePlanVM[]; guests: GuestVM[]; hotelCurrency: string; locale: AppLocale; guestPaymentsEnabled?: boolean; ttlockReady: boolean; ttlockPasscode: { code: string; startsAt: string; endsAt: string } | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<"edit" | "move" | null>(null);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [communicationOpen, setCommunicationOpen] = useState(false);
  const kk = locale === "kk";
  const nextStatus = reservation.status === "CHECKED_IN" ? "CHECKED_OUT" : "CHECKED_IN";
  const canUpdateStatus = ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(reservation.status);
  const codeMessage = ttlockPasscode ? `${kk ? "Сәлеметсіз бе" : "Здравствуйте"}, ${reservation.guestName}! ${kk ? "Пәтерге кіру коды" : "Код доступа в квартиру"} ${reservation.roomNumber}: ${ttlockPasscode.code}.` : "";
  const codeWhatsappUrl = whatsappHref(reservation.guestPhone, codeMessage);
  const statusLabels: Record<string, string> = kk
    ? { PENDING: "Күтуде", CONFIRMED: "Расталды", CHECKED_IN: "Орналасты", CHECKED_OUT: "Шығып кетті", CANCELLED: "Бас тартылды", NO_SHOW: "Келмеді" }
    : { PENDING: "Ожидает подтверждения", CONFIRMED: "Подтверждена", CHECKED_IN: "Заселён", CHECKED_OUT: "Завершена", CANCELLED: "Отменена", NO_SHOW: "Неявка" };
  const paymentMethodLabel = reservation.paymentMethod === "ONLINE" ? (kk ? "Онлайн" : "Онлайн") : reservation.paymentMethod === "CASH" ? (kk ? "Қолма-қол" : "Наличные") : (kk ? "Көрсетілмеген" : "Не указан");

  function updateStatus() {
    startTransition(async () => {
      const label = `${nextStatus === "CHECKED_IN" ? (kk ? "Орналастыру" : "Заселение") : (kk ? "Шығару" : "Выселение")} · ${reservation.guestName} · ${reservation.roomNumber}`;
      const result = await runOfflineAction("reservation.status", label, { id: reservation.id, status: nextStatus });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.queued) { toast.success(result.message); return; }
      toast.success(nextStatus === "CHECKED_IN" ? (kk ? "Қонақ орналастырылды" : "Гость заселён") : (kk ? "Қонақ шығарылды" : "Гость выселен"));
      router.refresh();
    });
  }

  function createTTLockCode() {
    const formData = new FormData();
    formData.set("reservationId", reservation.id);
    startTransition(async () => {
      try {
        const result = await issueReservationPasscodeAction(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(kk ? "Кіру коды жасалды" : "Код доступа создан");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : (kk ? "Кодты жасау сәтсіз аяқталды" : "Не удалось создать код"));
      }
    });
  }

  function markDepositReturned() {
    startTransition(async () => {
      const result = await runOfflineAction("reservation.depositReturn", `${kk ? "Кепілді қайтару" : "Возврат залога"} · ${reservation.guestName}`, { id: reservation.id });
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(result.message);
      if (result.queued) return;
      router.refresh();
    });
  }

  function markDepositCollected() {
    startTransition(async () => {
      const result = await runOfflineAction("reservation.depositCollect", `${kk ? "Кепіл алынды" : "Залог получен"} · ${reservation.guestName}`, { id: reservation.id });
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(result.message);
      if (result.queued) return;
      router.refresh();
    });
  }

  return <div className="mx-auto max-w-md space-y-4">
    <header className="flex items-start gap-3"><button type="button" onClick={() => (window.history.length > 1 ? router.back() : router.replace("/dashboard/reservations"))} className="mt-0.5 grid size-9 place-items-center rounded-full bg-white ring-1 ring-[#e7e9e1]"><ChevronLeft className="size-5" /></button><div className="min-w-0 flex-1"><h1 className="sh-mobile-title">{kk ? "Бронь" : "Бронь"} #{reservationDisplayId(reservation.sequenceNumber)}</h1><p className="sh-mobile-eyebrow truncate">{reservation.guestName}</p></div></header>
    <div className="flex flex-wrap gap-2"><span className="rounded-full bg-[#e1f3ec] px-3 py-1 text-[9px] font-bold text-[#16826a]">{statusLabels[reservation.status] ?? reservation.status}</span><span className="rounded-full bg-[#e4edfb] px-3 py-1 text-[9px] font-bold text-[#5187d4]">{kk ? "Төлем тәсілі" : "Способ оплаты"}: {paymentMethodLabel}</span></div>
    <section className="sh-mobile-card p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-base font-extrabold text-[#2c3932]">{reservation.roomNumber} · {reservation.roomTypeName}</p><p className="mt-1 text-[10px] text-[#939991]">{formatISOCompactDate(reservation.checkIn)}, {reservation.checkInTime} → {formatISOCompactDate(reservation.checkOut)}, {reservation.checkOutTime}</p></div><span className="text-right"><b className="block text-sm text-[#2f3b35]">{formatMoney(reservation.totalAmount)}</b><span className="block text-[10px] text-[#939991]">{formatMoney(Math.round(reservation.totalAmount / Math.max(1, daysBetween(reservation.checkIn, reservation.checkOut))))} {kk ? "/ түн" : "/ ночь"}</span></span></div><div className="mt-3 flex gap-3 border-t border-[#eff0ea] pt-3 text-[10px] text-[#727a73]"><span>{reservation.adults} {kk ? "ересек" : "взр."}</span><span>{reservation.children} {kk ? "бала" : "детей"}</span><span>{channelLabel(reservation.channel)}</span></div></section>
    {ttlockPasscode ? (
      <section className="sh-mobile-card flex items-center justify-between gap-3 border border-emerald-100 bg-emerald-50/60 p-4">
        <div className="flex min-w-0 items-center gap-3"><KeyRound className="size-5 shrink-0 text-emerald-700"/><div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">{kk ? "TTLock кіру коды" : "Код доступа TTLock"}</p>
          <code className="text-xl font-extrabold tracking-[.2em] text-slate-900">{ttlockPasscode.code}</code>
          <p className="text-[10px] text-slate-500">{new Date(ttlockPasscode.startsAt).toLocaleString(kk ? "kk-KZ" : "ru-RU")} — {new Date(ttlockPasscode.endsAt).toLocaleString(kk ? "kk-KZ" : "ru-RU")}</p>
        </div></div>
        {codeWhatsappUrl && <a href={codeWhatsappUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#20a56b] px-3 py-2 text-[10px] font-bold text-white">WhatsApp</a>}
      </section>
    ) : null}
    {!ttlockPasscode && reservation.status !== "CANCELLED" && reservation.status !== "NO_SHOW" ? (
      ttlockReady ? (
        <button type="button" disabled={pending} onClick={createTTLockCode} className="sh-mobile-card flex w-full items-center justify-center gap-2 border border-dashed border-emerald-200 p-3 text-xs font-bold text-emerald-800 disabled:opacity-50">
          {pending ? <Loader2 className="size-4 animate-spin"/> : <KeyRound className="size-4"/>}
          {kk ? "TTLock кодын жасау" : "Создать код TTLock"}
        </button>
      ) : (
        <Link href="/dashboard/locks" className="sh-mobile-card block w-full border border-dashed border-amber-200 p-3 text-center text-xs font-semibold text-amber-800">
          {kk ? "TTLock қосу немесе пәтерге құлыпты байланыстыру" : "Подключите TTLock и привяжите замок к квартире"}
        </Link>
      )
    ) : null}
    <div className="grid grid-cols-3 gap-2"><a href={reservation.guestPhone ? `tel:${reservation.guestPhone}` : undefined} className="sh-mobile-card flex min-h-14 flex-col items-center justify-center gap-1 text-[9px] font-bold text-[#16826a]"><Phone className="size-4" />{kk ? "Қоңырау" : "Позвонить"}</a><button type="button" onClick={() => setCommunicationOpen(true)} className="sh-mobile-card flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-bold text-[#16826a]"><MessageCircle className="size-4" />{kk ? "Хабарлама" : "Сообщение"}</button>{canUpdateStatus ? <button type="button" disabled={pending} onClick={updateStatus} className="sh-mobile-card flex min-h-14 flex-col items-center justify-center gap-1 text-[9px] font-bold text-[#16826a]">{pending ? <Loader2 className="size-4 animate-spin" /> : nextStatus === "CHECKED_IN" ? <Check className="size-4" /> : <CalendarCheck className="size-4" />}{nextStatus === "CHECKED_IN" ? (kk ? "Орналастыру" : "Заселить") : (kk ? "Шығару" : "Выселить")}</button> : <span className="sh-mobile-card flex min-h-14 flex-col items-center justify-center gap-1 text-[9px] font-bold text-muted-foreground"><CircleDot className="size-4" />{statusLabels[reservation.status] ?? reservation.status}</span>}</div>
    <GuestPaymentRequestButton reservationId={reservation.id} enabled={guestPaymentsEnabled} locale={locale} />
    <section><h2 className="sh-mobile-section-title mb-2">{kk ? "Төлем" : "Оплата"}</h2><div className="sh-mobile-card space-y-2 p-4 text-xs"><Row label={kk ? "Барлығы" : "Итого"} value={formatMoney(reservation.totalAmount)} /><Row label={kk ? "Төленгені" : "Оплачено"} value="—" accent /><Row label={kk ? "Төлем тәсілі" : "Способ оплаты"} value={paymentMethodLabel} /></div></section>
    {(reservation.depositAmount ?? 0) > 0 ? <section><h2 className="sh-mobile-section-title mb-2">{kk ? "Қайтарылатын депозит" : "Возвратный депозит"}</h2><div className="sh-mobile-card space-y-3 p-4 text-xs"><Row label={kk ? "Сомасы" : "Сумма"} value={formatMoney(reservation.depositAmount ?? 0)} /><Row label={kk ? "Қабылданды" : "Получен"} value={reservation.depositCollectedAt ? (kk ? "Иә" : "Да") : (kk ? "Жоқ" : "Нет")} /><Row label={kk ? "Қайтарылды" : "Возвращён"} value={reservation.depositReturnedAt ? (kk ? "Иә" : "Да") : reservation.status === "CHECKED_OUT" && reservation.depositCollectedAt ? (kk ? "Қайтару керек" : "Нужно вернуть") : (kk ? "Күтілуде" : "Ожидается выезд")} />{!reservation.depositCollectedAt && !["CANCELLED", "NO_SHOW"].includes(reservation.status) ? <button type="button" disabled={pending} onClick={markDepositCollected} className="sh-mobile-primary w-full disabled:opacity-60">{pending ? <Loader2 className="mx-auto size-4 animate-spin" /> : (kk ? "Депозитті алдым" : "Отметить получение депозита")}</button> : null}{reservation.status === "CHECKED_OUT" && reservation.depositCollectedAt && !reservation.depositReturnedAt ? <button type="button" disabled={pending} onClick={markDepositReturned} className="sh-mobile-primary w-full disabled:opacity-60">{pending ? <Loader2 className="mx-auto size-4 animate-spin" /> : (kk ? "Депозитті қайтардым" : "Отметить возврат депозита")}</button> : null}</div></section> : null}
    <section><h2 className="sh-mobile-section-title mb-2">{kk ? "Қонақ деректері" : "Детали гостя"}</h2><div className="sh-mobile-card space-y-2 p-4 text-xs"><Row label={kk ? "Телефон" : "Телефон"} value={reservation.guestPhone ?? "—"} /><Row label="Email" value={reservation.guestEmail ?? "—"} /></div></section>
    <section><h2 className="sh-mobile-section-title mb-2">{kk ? "Броньға ескертпе" : "Заметка к брони"}</h2>{reservation.notes ? <div className="flex items-start gap-2.5 rounded-2xl border border-[#cfe5dc] bg-[#e7f4ef] p-4 text-sm text-[#19755f]"><StickyNote className="mt-0.5 size-4 shrink-0" /><p className="whitespace-pre-wrap">{reservation.notes}</p></div> : <button type="button" onClick={() => setEditing("edit")} className="sh-mobile-card flex w-full items-center gap-2.5 p-4 text-left text-xs text-[#858c85]"><StickyNote className="size-4 shrink-0 text-[#07866b]" />{kk ? "Ескертпе жоқ. Қосу үшін «Өзгерту» басыңыз." : "Заметки нет. Нажмите, чтобы добавить через «Изменить»."}</button>}</section>
    <button type="button" onClick={() => setDocumentsOpen(true)} className="sh-mobile-card flex w-full items-center gap-3 p-4 text-left">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e4f3ee] text-[#07866b]"><FileText className="size-5" /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-[#2d3a33]">{kk ? "Құжаттар" : "Документы"}</span><span className="mt-0.5 block text-[11px] text-[#8f968f]">{kk ? "Шарт, шот-фактура, акт — бронь деректерімен" : "Договор, счёт-фактура, акт — по данным брони"}</span></span>
      <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-[#07866b] px-3 py-1.5 text-[11px] font-bold text-white">{kk ? "Бастау" : "Начать"}<ChevronRight className="size-3.5" /></span>
    </button>
    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={() => setEditing("edit")} className="sh-mobile-primary flex items-center justify-center gap-2"><Pencil className="size-4" />{kk ? "Өзгерту" : "Изменить"}</button>
      <button type="button" onClick={() => setEditing("move")} className="sh-mobile-card flex min-h-[50px] items-center justify-center gap-2 text-[0.84rem] font-bold text-[#16826a]"><CalendarRange className="size-4" />{kk ? "Ауыстыру" : "Перенести"}</button>
    </div>
    {editing ? <ReservationFormDialog
      mode="edit"
      variant={editing === "move" ? "move" : undefined}
      open
      onOpenChange={(open) => { if (!open) setEditing(null); }}
      rooms={rooms}
      ratePlans={ratePlans}
      guests={guests}
      hotelCurrency={hotelCurrency}
      initial={{ id: reservation.id, guestId: reservation.guestId, roomId: reservation.roomId, checkIn: reservation.checkIn, checkOut: reservation.checkOut, checkInTime: reservation.checkInTime, checkOutTime: reservation.checkOutTime, adults: reservation.adults, children: reservation.children, ratePlanId: reservation.ratePlanId ?? undefined, pricingMode: reservation.pricingMode, totalAmount: reservation.totalAmount, notes: reservation.notes ?? "", paymentMethod: reservation.paymentMethod }}
    /> : null}
    <CommunicationComposer reservationId={reservation.id} open={communicationOpen} onOpenChange={setCommunicationOpen} />
    <ReservationDocumentsDialog reservationId={reservation.id} open={documentsOpen} onOpenChange={setDocumentsOpen} />
  </div>;
}

function Row({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) { return <div className="flex items-start justify-between gap-4"><span className="text-[#919790]">{label}</span><span className={accent ? "font-bold text-[#07866b]" : "text-right font-bold text-[#3b4740]"}>{value}</span></div>; }
function daysBetween(from: string, to: string) { return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000); }
