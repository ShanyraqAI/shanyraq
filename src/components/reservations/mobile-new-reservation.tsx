"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, ChevronLeft, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { createReservationAction } from "@/server/actions/reservations";
import type { AppLocale } from "@/lib/locale";
import type { GuestVM, RatePlanVM, RoomVM } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";

interface Props {
  locale: AppLocale;
  todayISO: string;
  rooms: RoomVM[];
  guests: GuestVM[];
  ratePlans: RatePlanVM[];
}

export function MobileNewReservation({ locale, todayISO, rooms, guests, ratePlans }: Props) {
  const router = useRouter();
  const kk = locale === "kk";
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(1);
  const [checkIn, setCheckIn] = useState(todayISO);
  const [checkOut, setCheckOut] = useState(() => shiftDate(todayISO, 2));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [source, setSource] = useState("direct");
  const [guestId, setGuestId] = useState(guests[0]?.id ?? "new");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const selectedRoom = rooms.find((room) => room.id === roomId);
  const selectedPlan = ratePlans.find((plan) => plan.roomTypeId === selectedRoom?.roomTypeId);
  const nights = Math.max(1, daysBetween(checkIn, checkOut));
  const estimate = (selectedPlan?.basePrice ?? selectedRoom?.basePrice ?? 0) * nights;
  const canContinue = Boolean(roomId && checkIn && checkOut && checkOut > checkIn);
  const canCreate = guestId !== "new" || guestName.trim().length >= 2;

  const stepTitle = useMemo(() => step === 1 ? (kk ? "Күндер мен нысан" : "Даты и объект") : step === 2 ? (kk ? "Қонақ деректері" : "Данные гостя") : (kk ? "Тексеру" : "Проверка"), [kk, step]);

  function submit() {
    if (!selectedRoom || !canCreate) return;
    startTransition(async () => {
      const result = await createReservationAction({
        guestId: guestId === "new" ? undefined : guestId,
        guestName: guestId === "new" ? guestName.trim() : undefined,
        guestPhone: guestId === "new" ? guestPhone.trim() || undefined : undefined,
        roomId: selectedRoom.id,
        checkIn,
        checkOut,
        checkInTime: "14:00",
        checkOutTime: "12:00",
        adults,
        children,
        ratePlanId: selectedPlan?.id,
        pricingMode: selectedPlan ? "RATE_PLAN" : "MANUAL",
        manualTotalAmount: selectedPlan ? undefined : estimate,
        sourceChannel: source,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const reservationId = result.data?.id;
      if (!reservationId) {
        toast.error(kk ? "Бронь ашылмады" : "Не удалось открыть бронь");
        return;
      }
      toast.success(kk ? "Бронь жасалды" : "Бронь создана");
      router.push(`/dashboard/reservations/${reservationId}`);
    });
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <header className="flex items-start gap-3"><button type="button" onClick={() => step > 1 ? setStep((value) => value - 1) : router.back()} className="mt-0.5 grid size-9 place-items-center rounded-full bg-white text-[#536059] ring-1 ring-[#e6e8df]"><ChevronLeft className="size-5" /></button><div><h1 className="sh-mobile-title">{kk ? "Жаңа бронь" : "Новая бронь"}</h1><p className="sh-mobile-eyebrow">{kk ? `${step}/3 қадам · ${stepTitle}` : `Шаг ${step} из 3 · ${stepTitle}`}</p></div></header>
      <div className="flex gap-1.5">{[1, 2, 3].map((item) => <span key={item} className={cn("h-1 flex-1 rounded-full bg-[#e3e5dd]", item <= step && "bg-[#07866b]")} />)}</div>

      {step === 1 ? <div className="space-y-4">
        <section><h2 className="sh-mobile-section-title mb-2">{kk ? "Тұру күндері" : "Даты проживания"}</h2><div className="grid grid-cols-2 gap-2"><DateField label={kk ? "Келу" : "Заезд"} value={checkIn} min={todayISO} onChange={setCheckIn} /><DateField label={kk ? "Кету" : "Выезд"} value={checkOut} min={shiftDate(checkIn, 1)} onChange={setCheckOut} /></div></section>
        <section><h2 className="sh-mobile-section-title mb-2">{kk ? "Қонақтар" : "Гости"}</h2><div className="sh-mobile-card flex items-center justify-between px-3 py-3"><span className="text-xs font-bold text-[#39453f]">{adults} {kk ? "ересек" : adults === 1 ? "взрослый" : "взрослых"} · {children} {kk ? "бала" : "детей"}</span><div className="flex items-center gap-2"><Counter value={adults} min={1} onChange={setAdults} /><span className="h-5 w-px bg-[#e5e7df]" /><Counter value={children} min={0} onChange={setChildren} /></div></div></section>
        <section><h2 className="sh-mobile-section-title mb-2">{kk ? "Бос юниттер" : "Свободные объекты"}</h2><div className="space-y-2">{rooms.map((room) => { const plan = ratePlans.find((item) => item.roomTypeId === room.roomTypeId); const total = (plan?.basePrice ?? room.basePrice ?? 0) * nights; const active = room.id === roomId; return <button key={room.id} type="button" onClick={() => setRoomId(room.id)} className={cn("sh-mobile-card flex min-h-[66px] w-full items-center gap-3 px-3 text-left", active && "border-[#07866b] bg-[#f2faf7] ring-1 ring-[#07866b]")}><span className={cn("grid size-6 shrink-0 place-items-center rounded-full border border-[#d9ddd5] text-transparent", active && "border-[#07866b] bg-[#07866b] text-white")}><Check className="size-3.5" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-extrabold text-[#303d36]">{room.number}</span><span className="mt-0.5 block truncate text-[9px] text-[#959b94]">{room.roomTypeName} · {room.floor} {kk ? "қабат" : "этаж"}</span></span><span className="text-[10px] font-extrabold text-[#38453e]">{formatMoney(total)}</span></button>; })}</div></section>
        <section><label className="sh-mobile-section-title mb-2 block" htmlFor="mobile-booking-source">{kk ? "Дереккөз" : "Источник"}</label><select id="mobile-booking-source" value={source} onChange={(event) => setSource(event.target.value)} className="sh-mobile-card h-12 w-full px-3 text-xs font-bold text-[#3f4a44]"><option value="direct">{kk ? "Тікелей бронь" : "Прямая бронь"}</option><option value="booking">Booking.com</option><option value="ostrovok">Ostrovok</option><option value="krisha">Krisha.kz</option></select></section>
      </div> : null}

      {step === 2 ? <section className="space-y-4"><div><label className="sh-mobile-section-title mb-2 block" htmlFor="mobile-guest">{kk ? "Қонақты таңдаңыз" : "Выберите гостя"}</label><select id="mobile-guest" value={guestId} onChange={(event) => setGuestId(event.target.value)} className="sh-mobile-card h-12 w-full px-3 text-xs font-bold"><option value="new">{kk ? "+ Жаңа қонақ" : "+ Новый гость"}</option>{guests.map((guest) => <option key={guest.id} value={guest.id}>{guest.fullName}</option>)}</select></div>{guestId === "new" ? <div className="space-y-3"><label className="block text-xs font-bold text-[#4b5650]">{kk ? "Аты-жөні" : "Имя и фамилия"}<input value={guestName} onChange={(event) => setGuestName(event.target.value)} className="sh-mobile-card mt-1.5 h-12 w-full px-3 font-normal" placeholder={kk ? "Қонақтың аты" : "Имя гостя"} /></label><label className="block text-xs font-bold text-[#4b5650]">{kk ? "Телефон" : "Телефон"}<input value={guestPhone} onChange={(event) => setGuestPhone(event.target.value)} className="sh-mobile-card mt-1.5 h-12 w-full px-3 font-normal" placeholder="+7 700 000 00 00" inputMode="tel" /></label></div> : <div className="sh-mobile-card p-4 text-xs text-[#737b74]">{kk ? "Қонақтың сақталған байланыс деректері пайдаланылады." : "Будут использованы сохранённые контактные данные гостя."}</div>}</section> : null}

      {step === 3 ? <section className="space-y-3"><div className="sh-mobile-card p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-[#939991]">{kk ? "Тұру" : "Проживание"}</p><p className="mt-2 text-sm font-extrabold text-[#2d3a33]">{selectedRoom?.number} · {selectedRoom?.roomTypeName}</p><p className="mt-1 text-xs text-[#858c85]">{checkIn} → {checkOut} · {nights} {kk ? "түн" : "ноч."}</p></div><div className="sh-mobile-card p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-[#939991]">{kk ? "Қонақ" : "Гость"}</p><p className="mt-2 text-sm font-extrabold text-[#2d3a33]">{guestId === "new" ? guestName : guests.find((guest) => guest.id === guestId)?.fullName}</p><p className="mt-1 text-xs text-[#858c85]">{adults} {kk ? "ересек" : "взрослых"} · {children} {kk ? "бала" : "детей"}</p></div><div className="rounded-2xl bg-[#e4f3ee] p-4"><p className="text-[10px] font-bold text-[#568276]">{kk ? "Болжалды сома" : "Расчётная стоимость"}</p><p className="mt-1 text-xl font-extrabold text-[#08745f]">{formatMoney(estimate)}</p></div></section> : null}

      <button type="button" disabled={pending || (step === 1 ? !canContinue : step === 2 ? !canCreate : false)} onClick={() => step < 3 ? setStep((value) => value + 1) : submit()} className="sh-mobile-primary flex w-full items-center justify-center gap-2 disabled:opacity-50">{pending ? <Loader2 className="size-4 animate-spin" /> : null}{step < 3 ? (kk ? "Жалғастыру" : "Продолжить") : (kk ? "Бронь жасау" : "Создать бронь")}</button>
    </div>
  );
}

function DateField({ label, value, min, onChange }: { label: string; value: string; min: string; onChange: (value: string) => void }) {
  return <label className="sh-mobile-card block p-3 text-[9px] font-bold text-[#959b94]">{label}<span className="mt-1 flex items-center gap-2"><CalendarDays className="size-4 text-[#087f68]" /><input type="date" min={min} value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[11px] font-extrabold text-[#354139] outline-none" /></span></label>;
}

function Counter({ value, min, onChange }: { value: number; min: number; onChange: (value: number) => void }) {
  return <span className="flex items-center gap-1"><button type="button" aria-label="Уменьшить" onClick={() => onChange(Math.max(min, value - 1))} className="grid size-7 place-items-center rounded-full text-[#07866b]"><Minus className="size-3.5" /></button><b className="w-4 text-center text-xs">{value}</b><button type="button" aria-label="Увеличить" onClick={() => onChange(value + 1)} className="grid size-7 place-items-center rounded-full text-[#07866b]"><Plus className="size-3.5" /></button></span>;
}

function shiftDate(iso: string, days: number) { const date = new Date(`${iso}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function daysBetween(from: string, to: string) { return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000); }
