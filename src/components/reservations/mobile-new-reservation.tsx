"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { runOfflineAction } from "@/lib/offline/actions";
import type { AppLocale } from "@/lib/locale";
import type { GuestVM, RatePlanVM, RoomVM } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BookingDateCalendar } from "@/components/calendar/booking-date-calendar";
import { useBookingOptions } from "@/components/calendar/use-booking-options";
import { initialBookingStep } from "@/lib/reservations/calendar-navigation";
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
}

export function MobileNewReservation({ locale, todayISO, defaultCheckInTime, defaultCheckOutTime, rooms, guests, ratePlans, scope, initialCheckIn, initialCheckOut, initialRoomId, datesSelected = false }: Props) {
  const router = useRouter();
  const kk = locale === "kk";
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<number>(() => initialBookingStep({ checkIn: initialCheckIn ?? "", checkOut: initialCheckOut ?? "" }, datesSelected, initialRoomId));
  const [checkIn, setCheckIn] = useState(initialCheckIn ?? "");
  const [checkOut, setCheckOut] = useState(initialCheckOut ?? "");
  // A unit preselected from the calendar must not be filtered out by the default guest count.
  const [adults, setAdults] = useState(() => { const capacity = rooms.find((room) => room.id === initialRoomId)?.capacity; return capacity ? Math.min(2, capacity) : 2; });
  const [children, setChildren] = useState(0);
  const [roomId, setRoomId] = useState(initialRoomId ?? "");
  const [source, setSource] = useState("direct");
  const [guestId, setGuestId] = useState("new");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositCollected, setDepositCollected] = useState(false);
  // null = price follows the rate plan; a string = host-entered total.
  const [manualPrice, setManualPrice] = useState<string | null>(null);

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
  const formatMoney = (amount: number, currency = selectedQuote?.currency ?? "KZT") => new Intl.NumberFormat(kk ? "kk-KZ" : "ru-RU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  const manualTotal = manualPrice === null ? null : Number(manualPrice.replace(/\s/g, ""));
  const manualPriceValid = manualTotal === null || (manualPrice?.trim() !== "" && Number.isFinite(manualTotal) && manualTotal >= 0);
  const useManualPrice = !selectedPlan || (manualTotal !== null && manualTotal !== estimate);
  const total = manualTotal ?? estimate;
  const perNight = Number.isFinite(total) ? Math.round(total * 100 / nights) / 100 : 0;
  const guestReady = guestId !== "new" || guestName.trim().length >= 2;
  const stepTitle = step === 1 ? (kk ? "Күндерді таңдаңыз" : "Выберите даты") : step === 2 ? (kk ? "Бос пәтер" : "Свободный объект") : (kk ? "Қонақ және растау" : "Гость и подтверждение");
  const nightsLabel = kk ? "түн" : "ноч.";
  const perNightLabel = kk ? "/ түн" : "/ ночь";

  useEffect(() => {
    if (step === 2 && roomId) document.getElementById(`mobile-room-${roomId}`)?.scrollIntoView({ block: "center" });
  }, [step, roomId]);

  function selectRoom(id: string) {
    if (id !== roomId) setManualPrice(null);
    setRoomId(id);
  }

  function continueFlow() {
    if (step === 1) {
      if (!validDates) return;
      // Never replace the user's apartment. A fixed, free unit skips the list.
      if (initialRoomId && selectedRoom) setStep(3);
      else setStep(2);
      return;
    }
    if (step === 2 && selectedRoom) setStep(3);
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

  const stepDisabled = options.loading || Boolean(options.error) || (step === 1 ? !validDates : step === 2 ? !selectedRoom : !selectedRoom || !guestReady || !manualPriceValid);

  return (
    <div className="mx-auto max-w-md space-y-5 pb-[max(env(safe-area-inset-bottom),16px)]" data-clarity-mask="true">
      <header className="flex items-start gap-3"><button type="button" onClick={() => step > 1 ? setStep((value) => initialRoomId && value === 3 ? 1 : value - 1) : router.back()} className="mt-0.5 grid size-9 place-items-center rounded-full bg-white text-[#536059] ring-1 ring-[#e6e8df]" aria-label={kk ? "Артқа" : "Назад"}><ChevronLeft className="size-5" /></button><div><h1 className="sh-mobile-title">{kk ? "Жаңа бронь" : "Новая бронь"}</h1><p className="sh-mobile-eyebrow">{kk ? `${step}/3 қадам · ${stepTitle}` : `Шаг ${step} из 3 · ${stepTitle}`}</p></div></header>
      <div className="flex gap-1.5">{[1, 2, 3].map((item) => <span key={item} className={cn("h-1 flex-1 rounded-full bg-[#e3e5dd]", item <= step && "bg-[#07866b]")} />)}</div>

      {step === 1 ? <div className="space-y-4">
        <BookingDateCalendar locale={locale} scope={scope} todayISO={todayISO} roomId={initialRoomId ? roomId : undefined} checkInTime={defaultCheckInTime} checkOutTime={defaultCheckOutTime} value={{ checkIn, checkOut }} onChange={(range) => { setCheckIn(range.checkIn); setCheckOut(range.checkOut); setManualPrice(null); }} onContinue={continueFlow} disabled={stepDisabled} />
        {initialRoomId && validDates && options.data && !selectedRoom ? <button type="button" className="min-h-11 text-sm font-bold text-[#07866b] underline" onClick={() => setStep(2)}>{kk ? "Басқа пәтерді таңдау" : "Выбрать другую квартиру"}</button> : null}
        <section><h2 className="sh-mobile-section-title mb-2">{kk ? "Қонақтар" : "Гости"}</h2><div className="sh-mobile-card space-y-3 px-3 py-3"><GuestCounter label={kk ? "Ересектер" : "Взрослые"} value={adults} min={1} onChange={setAdults} /><GuestCounter label={kk ? "Балалар" : "Дети"} value={children} min={0} onChange={setChildren} /></div></section>
      </div> : null}

      {step === 2 ? <div className="space-y-4">
        <div className="rounded-2xl bg-[#e7f4ef] px-4 py-3 text-xs font-semibold text-[#19755f]">
          <p>{checkIn} → {checkOut} · {nights} {nightsLabel} · {availableRooms.length} {kk ? "бос" : "свободно"}</p>
          {selectedRoom ? <p className="mt-1 flex items-center gap-1 font-extrabold text-[#07866b]"><Check className="size-3.5" />{kk ? "Таңдалды" : "Выбрана"}: {selectedRoom.number} · {selectedRoom.roomTypeName}</p> : null}
          {preselectedUnavailable && preselectedRoom ? <p className="mt-1 text-[11px] font-semibold text-amber-800">{kk ? `${preselectedRoom.number} бұл күндерге немесе қонақ санына сәйкес келмейді — басқа пәтерді таңдаңыз.` : `${preselectedRoom.number} недоступна для этих дат или числа гостей. Измените даты или явно выберите другую квартиру.`}</p> : null}
        </div>
        <section><h2 className="sh-mobile-section-title mb-2">{kk ? "Бос пәтерлер" : "Свободные квартиры"}</h2>{availableRooms.length ? <div className="space-y-2">{availableRooms.map((room) => { const quote = options.data!.quotes.find((item) => item.roomId === room.id)!; const nightly = quote.total / nights; const active = room.id === roomId; return <button key={room.id} id={`mobile-room-${room.id}`} type="button" aria-pressed={active} onClick={() => selectRoom(room.id)} className={cn("sh-mobile-card flex min-h-[66px] w-full items-center gap-3 px-3 text-left", active && "border-[#07866b] bg-[#f2faf7] ring-1 ring-[#07866b]")}><span className={cn("grid size-6 shrink-0 place-items-center rounded-full border border-[#d9ddd5] text-transparent", active && "border-[#07866b] bg-[#07866b] text-white")}><Check className="size-3.5" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-extrabold text-[#303d36]">{room.number}</span><span className="mt-0.5 block truncate text-[9px] text-[#959b94]">{room.roomTypeName} · {room.floor} {kk ? "қабат" : "этаж"} · {kk ? `сыйымдылығы ${room.capacity ?? "—"}` : `до ${room.capacity ?? "—"} гостей`}</span></span><span className="text-right"><span className="block text-[10px] font-extrabold text-[#38453e]">{formatMoney(quote.total, quote.currency)}</span><span className="block text-[9px] text-[#959b94]">{formatMoney(nightly, quote.currency)} {kk ? "/ түн орташа" : "/ ночь в среднем"}</span></span></button>; })}</div> : <div className="sh-mobile-card border-amber-200 bg-amber-50 p-5 text-center text-sm text-amber-900">{kk ? "Күндер мен қонақтар санына сәйкес бос пәтер жоқ. Күндерді немесе қонақтар санын өзгертіңіз." : "Нет свободного объекта для этих дат и числа гостей. Измените даты или количество гостей."}</div>}</section>
        <section><label className="sh-mobile-section-title mb-2 block" htmlFor="mobile-booking-source">{kk ? "Дереккөз" : "Источник"}</label><select id="mobile-booking-source" value={source} onChange={(event) => setSource(event.target.value)} className="sh-mobile-card h-12 w-full px-3 text-base font-bold text-[#3f4a44]"><option value="direct">{kk ? "Тікелей бронь" : "Прямая бронь"}</option><option value="booking">Booking.com</option><option value="airbnb">Airbnb</option><option value="ostrovok">Ostrovok</option><option value="krisha">Krisha.kz</option></select></section>
      </div> : null}

      {step === 3 ? <section className="space-y-4">
        <div><label className="sh-mobile-section-title mb-2 block" htmlFor="mobile-guest">{kk ? "Қонақты таңдаңыз" : "Выберите гостя"}</label><select id="mobile-guest" value={guestId} onChange={(event) => setGuestId(event.target.value)} className="sh-mobile-card h-12 w-full px-3 text-base font-bold"><option value="new">{kk ? "+ Жаңа қонақ" : "+ Новый гость"}</option>{guests.map((guest) => <option key={guest.id} value={guest.id}>{guest.fullName}</option>)}</select></div>
        {guestId === "new" ? <div className="space-y-3"><label className="block text-xs font-bold text-[#4b5650]">{kk ? "Аты-жөні" : "Имя и фамилия"}<input value={guestName} onChange={(event) => setGuestName(event.target.value)} className="sh-mobile-card mt-1.5 h-12 w-full px-3 text-base font-normal" placeholder={kk ? "Қонақтың аты" : "Имя гостя"} /></label><label className="block text-xs font-bold text-[#4b5650]">{kk ? "Телефон" : "Телефон"}<input value={guestPhone} onChange={(event) => setGuestPhone(event.target.value)} className="sh-mobile-card mt-1.5 h-12 w-full px-3 text-base font-normal" placeholder="+7 700 000 00 00" inputMode="tel" /></label></div> : null}
        <div className="sh-mobile-card p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-[#939991]">{kk ? "Тұру" : "Проживание"}</p><p className="mt-2 text-sm font-extrabold text-[#2d3a33]">{chosenRoom?.number} · {chosenRoom?.roomTypeName}</p><p className="mt-1 text-xs text-[#858c85]">{checkIn} → {checkOut} · {nights} {nightsLabel} · {adults + children} {kk ? "қонақ" : "гост."}</p></div>
        {selectedQuote ? <div className="rounded-2xl bg-[#e4f3ee] p-4">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="mobile-booking-price" className="text-[10px] font-bold text-[#568276]">{`${kk ? "Тұру құны" : "Стоимость проживания"} · ${selectedQuote.currency === "KZT" ? "₸" : selectedQuote.currency}`}</label>
            {manualPrice !== null && manualTotal !== estimate ? <button type="button" onClick={() => setManualPrice(null)} className="text-[10px] font-bold text-[#07866b] underline-offset-2 hover:underline">{kk ? "Тариф бойынша" : "Вернуть по тарифу"}</button> : null}
          </div>
          <input id="mobile-booking-price" type="text" inputMode="numeric" value={manualPrice ?? String(estimate)} onChange={(event) => setManualPrice(event.target.value.replace(/[^\d]/g, ""))} onFocus={(event) => event.target.select()} className={cn("mt-2 h-12 w-full rounded-xl border border-[#cfe5dc] bg-white px-3 text-xl font-extrabold text-[#08745f] outline-none focus:border-[#07866b] focus:ring-2 focus:ring-[#07866b]/15", !manualPriceValid && "border-red-300")} />
          <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2"><span className="text-[10px] font-bold text-[#568276]">{nights} {nightsLabel} · {kk ? "орташа" : "в среднем"} {formatMoney(perNight)}</span><span className="text-xs font-extrabold text-[#08745f]">{manualPriceValid ? `${formatMoney(perNight)} ${perNightLabel}` : "—"}</span></div>
          <p className="mt-1.5 text-[10px] text-[#568276]">{!selectedPlan ? (kk ? "Пәтердің базалық бағасы. Жалпы соманы өзгертуге болады." : "Базовая цена квартиры. Общую сумму можно изменить.") : useManualPrice ? (kk ? `Қолмен белгіленді · тариф бойынша ${formatMoney(estimate)}` : `Указана вручную · по тарифу ${formatMoney(estimate)}`) : (kk ? "Тариф бойынша. Жалпы соманы өзгерту үшін басыңыз." : "По тарифу. Нажмите, чтобы изменить общую сумму.")}</p>
        </div> : <p role="status" className="rounded-xl bg-[#e4f3ee] p-4 text-sm">{kk ? "Баға қайта тексерілген соң көрсетіледі." : "Стоимость появится после повторной проверки доступности."}</p>}
        <label className="block"><span className="sh-mobile-section-title mb-2 block">{kk ? "Броньға ескертпе" : "Заметка к брони"}</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} rows={3} className="sh-mobile-card w-full resize-none px-3 py-2.5 text-sm text-[#303d36] outline-none placeholder:text-[#a1a79f] focus:border-[#07866b] focus:ring-2 focus:ring-[#07866b]/15" placeholder={kk ? "Мысалы: кілтті консьержге қалдыру, қонақтан депозит алу…" : "Например: оставить ключ у консьержа, забрать депозит, приготовить детскую кроватку…"} /><span className="mt-1 block text-[10px] text-[#858c85]">{kk ? "Бронь картасында және қонақ тарихында көрінеді." : "Видно в карточке брони и в истории гостя."}</span></label>
        <div className="sh-mobile-card space-y-3 p-4"><div><h2 className="text-xs font-extrabold text-[#303d36]">{kk ? "Қайтарылатын депозит" : "Возвратный депозит"}</h2><p className="mt-1 text-[10px] text-[#858c85]">{kk ? "Нөл қалдырыңыз, егер депозит қажет болмаса." : "Оставьте 0, если депозит не нужен. После выезда напомним вернуть его."}</p></div><label className="block text-[10px] font-bold text-[#68736b]">{kk ? "Депозит сомасы · ₸" : "Сумма депозита · ₸"}<input type="number" min="0" step="500" inputMode="numeric" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} className="sh-mobile-card mt-1.5 h-11 w-full px-3 text-sm font-bold text-[#303d36]" placeholder="0" /></label>{Number(depositAmount) > 0 ? <label className="flex items-start gap-2 text-[11px] font-semibold text-[#455249]"><input type="checkbox" checked={depositCollected} onChange={(event) => setDepositCollected(event.target.checked)} className="mt-0.5 size-4 accent-[#07866b]" />{kk ? "Депозитті қонақтан алдым" : "Депозит уже получен от гостя"}</label> : null}</div>
      </section> : null}

      {options.loading && step > 1 ? <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" />{kk ? "Күндер мен бағаны тексереміз…" : "Проверяем даты и цену…"}</p> : null}
      {options.error ? <div role="alert" className="rounded-xl bg-amber-50 p-3 text-sm"><p>{options.error}</p><button type="button" className="min-h-11 font-bold underline" onClick={options.retry}>{kk ? "Қайталау" : "Повторить"}</button></div> : null}
      {step > 1 && !selectedRoom && options.data ? <div role="alert" className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm"><p>{kk ? "Таңдалған пәтер қолжетімсіз. Деректеріңіз сақталды." : "Выбранная квартира недоступна. Введённые данные сохранены."}</p>{step === 3 ? <button type="button" className="min-h-11 font-bold underline" onClick={() => setStep(2)}>{kk ? "Басқа пәтерді таңдау" : "Выбрать другую квартиру"}</button> : null}</div> : null}
      {step > 1 ? <div className="space-y-2"><button type="button" className="min-h-11 text-sm font-bold text-[#07866b] underline" onClick={() => setStep(1)}>{kk ? "Күндерді өзгерту" : "Изменить даты"}</button><button type="button" disabled={pending || stepDisabled} onClick={() => step < 3 ? continueFlow() : submit()} className="sh-mobile-primary flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#07866b] px-4 text-white disabled:opacity-50">{pending ? <Loader2 className="size-4 animate-spin" /> : null}{step < 3 ? (kk ? "Жалғастыру" : "Продолжить") : (kk ? "Бронь жасау" : "Создать бронь")}</button></div> : null}
    </div>
  );
}

function GuestCounter({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (value: number) => void }) {
  return <div className="flex items-center justify-between"><span className="text-xs font-bold text-[#39453f]">{label}</span><span className="flex items-center gap-2"><button type="button" aria-label="−" onClick={() => onChange(Math.max(min, value - 1))} className="grid size-11 place-items-center rounded-full bg-[#eef5f2] text-[#07866b]"><Minus className="size-3.5" /></button><b className="w-5 text-center text-xs">{value}</b><button type="button" aria-label="+" onClick={() => onChange(value + 1)} className="grid size-11 place-items-center rounded-full bg-[#eef5f2] text-[#07866b]"><Plus className="size-3.5" /></button></span></div>;
}

function daysBetween(from: string, to: string) { return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000); }
