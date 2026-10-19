"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { runOfflineAction } from "@/lib/offline/actions";
import type { AppLocale } from "@/lib/locale";
import type { GuestVM, RatePlanVM, RoomVM } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BookingGuestCounter } from "./booking-guest-counter";
import { formatISOCompactDate } from "@/lib/dates";
import { BookingDateCalendar } from "@/components/calendar/booking-date-calendar";
import { useBookingOptions } from "@/components/calendar/use-booking-options";
import { initialBookingStep } from "@/lib/reservations/calendar-navigation";
import { BookingPriceFields } from "./booking-price-fields";
import { bookingPrice, type ManualBookingPrice } from "@/lib/reservations/manual-price";
import { validBookingRange } from "@/lib/reservations/date-range";

interface Props {
  locale: AppLocale;
  todayISO: string;
  defaultCheckInTime: string;
  defaultCheckOutTime: string;
  rooms: RoomVM[];
  guests: GuestVM[];
  ratePlans: RatePlanVM[];
  scope: string;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialRoomId?: string;
  datesSelected?: boolean;
  initialAdults?: number;
  initialChildren?: number;
}

export function MobileNewReservation({ locale, todayISO, defaultCheckInTime, defaultCheckOutTime, rooms, guests, ratePlans, scope, initialCheckIn, initialCheckOut, initialRoomId, datesSelected = false, initialAdults, initialChildren = 0 }: Props) {
  const router = useRouter();
  const kk = locale === "kk";
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<number>(() => initialBookingStep({ checkIn: initialCheckIn ?? "", checkOut: initialCheckOut ?? "" }, datesSelected, initialRoomId));
  const [checkIn, setCheckIn] = useState(initialCheckIn ?? "");
  const [checkOut, setCheckOut] = useState(initialCheckOut ?? "");
  const [adults, setAdults] = useState(initialAdults ?? Math.min(2, rooms.find((room) => room.id === initialRoomId)?.capacity ?? 2));
  const [children, setChildren] = useState(initialChildren);
  const heading = useRef<HTMLHeadingElement>(null);
  const [roomId, setRoomId] = useState(initialRoomId ?? "");
  const [source, setSource] = useState("direct");
  const [guestId, setGuestId] = useState("new");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositCollected, setDepositCollected] = useState(false);
  const [manualPrice, setManualPrice] = useState<ManualBookingPrice>(null);

  const validDates = validBookingRange({ checkIn, checkOut });
  const optionsQuery = validDates ? new URLSearchParams({ mode: "quote", from: checkIn, to: checkOut, guests: String(adults + children) }).toString() : null;
  const options = useBookingOptions(optionsQuery, scope, kk);
  const availableRooms = useMemo(() => rooms.filter((room) => options.data?.quotes.some((quote) => quote.roomId === room.id)), [rooms, options.data]);
  const chosenRoom = rooms.find((room) => room.id === roomId);
  const selectedRoom = availableRooms.find((room) => room.id === roomId);
  const selectedQuote = options.data?.quotes.find((quote) => quote.roomId === roomId);
  const preselectedRoom = rooms.find((room) => room.id === initialRoomId);
  const preselectedUnavailable = Boolean(options.data && preselectedRoom && !availableRooms.some((room) => room.id === preselectedRoom.id));
  const selectedPlan = ratePlans.find((plan) => plan.id === selectedQuote?.ratePlanId);
  const nights = validDates ? daysBetween(checkIn, checkOut) : 0;
  const estimate = selectedQuote?.total ?? 0;
  const price = bookingPrice(manualPrice, nights, estimate);
  const manualPriceValid = price.valid;
  const useManualPrice = !selectedPlan || manualPrice !== null;
  const total = price.total;
  const guestReady = guestId === "new" ? guestName.trim().length >= 2 : guests.some((guest) => guest.id === guestId);
  const stepTitle = step === 1 ? (kk ? "Күндер, пәтер және қонақтар" : "Даты, квартира и гости") : step === 2 ? (kk ? "Қонақ деректері" : "Данные гостя") : (kk ? "Құны және растау" : "Стоимость и подтверждение");
  const nightsLabel = kk ? "түн" : "ноч.";

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "start" });
  }, [step]);

  function selectRoom(id: string) {
    if (id !== roomId) setManualPrice(null);
    setRoomId(id);
  }

  function continueFlow() {
    if (options.loading || options.error || !selectedRoom || !validDates) return;
    if (step === 1) setStep(2);
    else if (step === 2 && guestReady) setStep(3);
  }

  function submit() {
    if (!selectedRoom || !selectedQuote || !guestReady || !manualPriceValid || options.loading || options.error) return;
    startTransition(async () => {
      const label = `${kk ? "Жаңа бронь" : "Новая бронь"} · ${selectedRoom.number} · ${checkIn} → ${checkOut}`;
      const result = await runOfflineAction("reservation.create", label, {
        guestId: guestId === "new" ? undefined : guestId,
        guestName: guestId === "new" ? guestName.trim() : undefined,
        guestPhone: guestId === "new" ? guestPhone.trim() || undefined : undefined,
        roomId: selectedRoom.id,
        checkIn,
        checkOut,
        checkInTime: defaultCheckInTime,
        checkOutTime: defaultCheckOutTime,
        adults,
        children,
        ratePlanId: selectedPlan?.id,
        pricingMode: useManualPrice ? "MANUAL" : "RATE_PLAN",
        manualTotalAmount: useManualPrice ? total : undefined,
        expectedRateTotal: !useManualPrice ? estimate : undefined,
        expectedRateCurrency: !useManualPrice ? selectedQuote.currency : undefined,
        sourceChannel: source,
        notes: notes.trim() || undefined,
        depositAmount: Number(depositAmount) || 0,
        depositCollected: (Number(depositAmount) || 0) > 0 && depositCollected,
      });
      if (!result.ok) {
        toast.error(kk ? "Бронь сақталмады. Деректеріңіз сақталды. Күндер мен бағаны қайта тексеріңіз." : "Бронь не сохранена. Введённые данные сохранены. Перепроверьте даты и цену.");
        options.retry();
        return;
      }
      if (result.queued) { toast.success(result.message); router.replace("/dashboard/reservations"); return; }
      const reservationId = result.data?.id;
      if (!reservationId) { toast.error(kk ? "Бронь ашылмады" : "Не удалось открыть бронь"); return; }
      toast.success(kk ? "Бронь жасалды" : "Бронь создана");
      // replace: the finished wizard must not stay in history, otherwise "Back" reopens it.
      router.replace(`/dashboard/reservations/${reservationId}`);
    });
  }

  const stepDisabled = options.loading || Boolean(options.error) || (!validDates || !selectedRoom || (step >= 2 && !guestReady) || (step === 3 && !manualPriceValid));

  return (
    <div className="mx-auto max-w-md space-y-5 pb-[max(env(safe-area-inset-bottom),16px)]" data-clarity-mask="true">
      <header className="flex items-start gap-3"><button type="button" onClick={() => step > 1 ? setStep((value) => value - 1) : router.back()} className="mt-0.5 grid size-11 place-items-center rounded-full bg-white text-[#536059] ring-1 ring-[#e6e8df]" aria-label={kk ? "Артқа" : "Назад"}><ChevronLeft className="size-5" /></button><div><h1 ref={heading} tabIndex={-1} className="sh-mobile-title outline-none">{kk ? "Жаңа бронь" : "Новая бронь"}</h1><p className="sh-mobile-eyebrow">{kk ? `${step}/3 қадам · ${stepTitle}` : `Шаг ${step} из 3 · ${stepTitle}`}</p></div></header>
      <div className="flex gap-1.5">{[1, 2, 3].map((item) => <span key={item} className={cn("h-1 flex-1 rounded-full bg-[#e3e5dd]", item <= step && "bg-[#07866b]")} />)}</div>

      {step > 1 ? <div className="rounded-2xl bg-[#e7f4ef] px-4 py-3 text-sm text-[#19755f]"><p className="font-bold">{chosenRoom?.number} · {formatISOCompactDate(checkIn)} → {formatISOCompactDate(checkOut)}</p><p className="mt-1 text-sm">{nights} {nightsLabel} · {adults + children} {kk ? "қонақ" : "гост."} · {defaultCheckInTime} / {defaultCheckOutTime}</p></div> : null}
      {step === 1 ? <BookingDateCalendar locale={locale} scope={scope} todayISO={todayISO} roomId={roomId || undefined} checkInTime={defaultCheckInTime} checkOutTime={defaultCheckOutTime} value={{ checkIn, checkOut }} onChange={(range) => { setCheckIn(range.checkIn); setCheckOut(range.checkOut); }} onContinue={continueFlow} disabled={stepDisabled} continueLabel={kk ? "Қонақ деректеріне" : "К данным гостя"}>
        <section className="sh-mobile-card space-y-3 p-4" aria-label={kk ? "Қонақтар" : "Гости"}><BookingGuestCounter label={kk ? "Ересектер" : "Взрослые"} value={adults} min={1} onChange={setAdults} /><BookingGuestCounter label={kk ? "Балалар" : "Дети"} value={children} min={0} onChange={setChildren} /></section>
        {preselectedUnavailable && preselectedRoom ? <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{kk ? `${preselectedRoom.number} қолжетімсіз. Күндерді, қонақ санын немесе пәтерді өзгертіңіз.` : `${preselectedRoom.number} недоступна. Измените даты, число гостей или квартиру.`}</p> : null}
        <details key={selectedRoom ? "selected" : "choose"} open={!selectedRoom} className="space-y-3"><summary className="min-h-11 cursor-pointer text-sm font-bold text-[#07866b]">{selectedRoom ? `${selectedRoom.number} · ${kk ? "Пәтерді өзгерту" : "Изменить квартиру"}` : (kk ? "Пәтерді таңдаңыз" : "Выберите квартиру")}</summary>
        {!validDates ? <p className="text-sm text-[#626f5b]">{kk ? "Алдымен күндерді таңдаңыз." : "Сначала выберите даты."}</p> : options.loading ? <p role="status" className="text-sm text-[#626f5b]">{kk ? "Бос пәтерлерді тексереміз…" : "Проверяем свободные квартиры…"}</p> : options.error ? null : <>
        <section><h2 className="sh-mobile-section-title mb-2">{kk ? "Бос пәтерлер" : "Свободные квартиры"}</h2>{availableRooms.length ? <div className="space-y-2">{availableRooms.map((room) => { const active = room.id === roomId; return <button key={room.id} id={`mobile-room-${room.id}`} type="button" aria-pressed={active} onClick={() => selectRoom(room.id)} className={cn("sh-mobile-card flex min-h-[66px] w-full items-center gap-3 px-3 text-left", active && "border-[#07866b] bg-[#f2faf7] ring-1 ring-[#07866b]")}><span className={cn("grid size-6 shrink-0 place-items-center rounded-full border border-[#d9ddd5] text-transparent", active && "border-[#07866b] bg-[#07866b] text-white")}><Check className="size-3.5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-[#303d36]">{room.number}</span><span className="mt-0.5 block truncate text-sm text-[#56635b]">{room.roomTypeName} · {room.floor} {kk ? "қабат" : "этаж"} · {kk ? `сыйымдылығы ${room.capacity ?? "—"}` : `до ${room.capacity ?? "—"} гостей`}</span><span className="mt-1 block text-sm font-semibold text-[#26352f]">{new Intl.NumberFormat(kk ? "kk-KZ" : "ru-RU", { style: "currency", currency: options.data?.quotes.find((quote) => quote.roomId === room.id)?.currency ?? "KZT" }).format(options.data?.quotes.find((quote) => quote.roomId === room.id)?.total ?? 0)} · {nights} {nightsLabel}</span></span></button>; })}</div> : <div className="sh-mobile-card border-amber-200 bg-amber-50 p-5 text-center text-sm text-amber-900">{kk ? "Күндер мен қонақтар санына сәйкес бос пәтер жоқ. Күндерді немесе қонақтар санын өзгертіңіз." : "Нет свободного объекта для этих дат и числа гостей. Измените даты или количество гостей."}</div>}</section>
        </>}

        </details>
      </BookingDateCalendar> : null}
      {step === 2 ? <section className="space-y-4">
        <div><label className="sh-mobile-section-title mb-2 block" htmlFor="mobile-guest">{kk ? "Қонақты таңдаңыз" : "Выберите гостя"}</label><select id="mobile-guest" value={guestId} onChange={(event) => setGuestId(event.target.value)} className="sh-mobile-card h-12 w-full px-3 text-base font-bold"><option value="new">{kk ? "+ Жаңа қонақ" : "+ Новый гость"}</option>{guests.map((guest) => <option key={guest.id} value={guest.id}>{guest.fullName}</option>)}</select></div>
        {guestId === "new" ? <div className="space-y-3"><label className="block text-sm font-bold text-[#4b5650]">{kk ? "Аты-жөні" : "Имя и фамилия"}<input value={guestName} onChange={(event) => setGuestName(event.target.value)} className="sh-mobile-card mt-1.5 h-12 w-full px-3 text-base font-normal" placeholder={kk ? "Қонақтың аты" : "Имя гостя"} /></label><label className="block text-sm font-bold text-[#4b5650]">{kk ? "Телефон" : "Телефон"}<input value={guestPhone} onChange={(event) => setGuestPhone(event.target.value)} className="sh-mobile-card mt-1.5 h-12 w-full px-3 text-base font-normal" placeholder="+7 700 000 00 00" inputMode="tel" /></label></div> : null}

      </section> : null}
      {step === 3 ? <section className="space-y-4">
        <p className="text-sm font-semibold text-[#39453f]">{guestId === "new" ? guestName : guests.find((guest) => guest.id === guestId)?.fullName}</p>
        {selectedQuote ? <BookingPriceFields value={manualPrice} onChange={setManualPrice} nights={nights} quotedTotal={estimate} currency={selectedQuote.currency} locale={locale} /> : <p role="status" className="rounded-xl bg-accent p-4 text-sm">{kk ? "Баға қайта тексерілген соң көрсетіледі." : "Стоимость появится после повторной проверки доступности."}</p>}


        <details className="sh-mobile-card p-4"><summary className="min-h-11 cursor-pointer text-sm font-bold text-[#07866b]">{kk ? "Депозит, ескертпе және дереккөз" : "Депозит, заметка и источник"}</summary><div className="mt-3 space-y-4">
        <label className="block"><span className="sh-mobile-section-title mb-2 block">{kk ? "Броньға ескертпе" : "Заметка к брони"}</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} rows={3} className="sh-mobile-card w-full resize-none px-3 py-2.5 text-sm text-[#303d36] outline-none placeholder:text-[#a1a79f] focus:border-[#07866b] focus:ring-2 focus:ring-[#07866b]/15" placeholder={kk ? "Мысалы: кілтті консьержге қалдыру, қонақтан депозит алу…" : "Например: оставить ключ у консьержа, забрать депозит, приготовить детскую кроватку…"} /><span className="mt-1 block text-[10px] text-[#858c85]">{kk ? "Бронь картасында және қонақ тарихында көрінеді." : "Видно в карточке брони и в истории гостя."}</span></label>
        <div className="sh-mobile-card space-y-3 p-4"><div><h2 className="text-sm font-extrabold text-[#303d36]">{kk ? "Қайтарылатын депозит" : "Возвратный депозит"}</h2><p className="mt-1 text-[10px] text-[#858c85]">{kk ? "Нөл қалдырыңыз, егер депозит қажет болмаса." : "Оставьте 0, если депозит не нужен. После выезда напомним вернуть его."}</p></div><label className="block text-[10px] font-bold text-[#68736b]">{kk ? "Депозит сомасы · ₸" : "Сумма депозита · ₸"}<input type="number" min="0" step="500" inputMode="numeric" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} className="sh-mobile-card mt-1.5 h-11 w-full px-3 text-sm font-bold text-[#303d36]" placeholder="0" /></label>{Number(depositAmount) > 0 ? <label className="flex items-start gap-2 text-[11px] font-semibold text-[#455249]"><input type="checkbox" checked={depositCollected} onChange={(event) => setDepositCollected(event.target.checked)} className="mt-0.5 size-4 accent-[#07866b]" />{kk ? "Депозитті қонақтан алдым" : "Депозит уже получен от гостя"}</label> : null}</div>        <section><label className="sh-mobile-section-title mb-2 block" htmlFor="mobile-booking-source">{kk ? "Дереккөз" : "Источник"}</label><select id="mobile-booking-source" value={source} onChange={(event) => setSource(event.target.value)} className="sh-mobile-card h-12 w-full px-3 text-base font-bold text-[#3f4a44]"><option value="direct">{kk ? "Тікелей бронь" : "Прямая бронь"}</option><option value="booking">Booking.com</option><option value="airbnb">Airbnb</option><option value="ostrovok">Ostrovok</option><option value="krisha">Krisha.kz</option></select></section>
        </div></details>
      </section> : null}

      {options.loading && step > 1 ? <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" />{kk ? "Күндер мен бағаны тексереміз…" : "Проверяем даты и цену…"}</p> : null}
      {options.error ? <div role="alert" className="rounded-xl bg-amber-50 p-3 text-sm"><p>{options.error}</p><button type="button" className="min-h-11 font-bold underline" onClick={options.retry}>{kk ? "Қайталау" : "Повторить"}</button></div> : null}
      {step > 1 && !selectedRoom && options.data ? <div role="alert" className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm"><p>{kk ? "Таңдалған пәтер қолжетімсіз. Деректеріңіз сақталды." : "Выбранная квартира недоступна. Введённые данные сохранены."}</p>{step > 1 ? <button type="button" className="min-h-11 font-bold underline" onClick={() => setStep(1)}>{kk ? "Басқа пәтерді таңдау" : "Выбрать другую квартиру"}</button> : null}</div> : null}
      {step > 1 ? <div className="space-y-2"><button type="button" className="min-h-11 text-sm font-bold text-[#07866b] underline" onClick={() => setStep(1)}>{kk ? "Күндерді немесе пәтерді өзгерту" : "Изменить даты или квартиру"}</button><button type="button" disabled={pending || stepDisabled} onClick={() => step < 3 ? continueFlow() : submit()} className="sh-mobile-primary flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#07866b] px-4 text-white disabled:opacity-50">{pending ? <Loader2 className="size-4 animate-spin" /> : null}{step < 3 ? (kk ? "Құнын тексеру" : "К стоимости") : (kk ? "Бронь жасау" : "Создать бронь")}</button></div> : null}
    </div>
  );
}

function daysBetween(from: string, to: string) { return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000); }
