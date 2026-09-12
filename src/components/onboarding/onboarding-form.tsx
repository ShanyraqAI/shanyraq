"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BedDouble, Building2, CalendarCheck2, Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MAX_NIGHTLY_PRICE, MIN_NIGHTLY_PRICE } from "@/lib/pricing";
import { addDays, parseISODate, toISODate } from "@/lib/dates";
import { createReservationAction } from "@/server/actions/reservations";
import { upsertRoomAction } from "@/server/actions/rooms";

const PROPERTY_TYPES = ["Отель", "Апарт-отель", "Апартаменты", "Хостел", "Гостевой дом", "Другое"] as const;
const COUNTRIES = ["Казахстан", "Россия", "Узбекистан", "Киргизия", "Другое"];
const CURRENCIES = ["KZT", "USD", "EUR"] as const;
const TIMEZONES = ["Asia/Almaty", "Asia/Aqtobe", "Asia/Aqtau", "Asia/Oral", "Asia/Tashkent", "Asia/Bishkek", "Europe/Moscow", "Europe/Istanbul", "Europe/London", "UTC"];

const STEPS = [
  { title: "Расскажите об объекте", description: "Основные данные для календаря и документов", icon: Building2 },
  { title: "Добавьте первый номер", description: "Он сразу появится в календаре", icon: BedDouble },
  { title: "Создайте первую бронь", description: "Попробуйте основной рабочий сценарий", icon: CalendarCheck2 },
] as const;

type HotelDraft = {
  name: string;
  city: string;
  country: string;
  propertyType: (typeof PROPERTY_TYPES)[number] | "";
  language: "ru" | "kk" | "en";
  currency: (typeof CURRENCIES)[number];
  timezone: string;
};

type RoomDraft = {
  id?: string;
  number: string;
  floor: string;
  roomTypeName: string;
  capacity: string;
  basePrice: string;
};

export interface OnboardingFormProps {
  initialStep: number;
  todayIso: string;
  hasReservation: boolean;
  hotel: HotelDraft;
  room: RoomDraft | null;
}

async function postProgress(body: Record<string, unknown>) {
  const response = await fetch("/api/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json() as { ok?: boolean; error?: string };
  if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось сохранить шаг");
}

export function OnboardingForm({ initialStep, todayIso, hasReservation, hotel: initialHotel, room: initialRoom }: OnboardingFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(3, Math.max(1, initialStep)));
  const [pending, startTransition] = useTransition();
  const [hotel, setHotel] = useState(initialHotel);
  const [room, setRoom] = useState<RoomDraft>(initialRoom ?? { number: "101", floor: "1", roomTypeName: "Стандарт", capacity: "2", basePrice: "25000" });
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [checkIn, setCheckIn] = useState(todayIso);
  const [checkOut, setCheckOut] = useState(toISODate(addDays(parseISODate(todayIso), 2)));
  const [adults, setAdults] = useState("2");
  const [notes, setNotes] = useState("");

  function saveHotel() {
    if (!hotel.name.trim() || !hotel.city.trim() || !hotel.propertyType) {
      toast.error("Заполните название, город и тип объекта");
      return;
    }
    startTransition(async () => {
      try {
        await postProgress({
          action: "save-hotel",
          hotelName: hotel.name,
          city: hotel.city,
          country: hotel.country,
          propertyType: hotel.propertyType,
          language: hotel.language,
          currency: hotel.currency,
          timezone: hotel.timezone,
        });
        setStep(2);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Не удалось сохранить отель");
      }
    });
  }

  function saveRoom() {
    startTransition(async () => {
      const result = await upsertRoomAction({ ...room, status: "AVAILABLE" });
      if (!result.ok || !result.data) {
        toast.error(result.error ?? "Не удалось добавить номер");
        return;
      }
      try {
        await postProgress({ action: "room-created" });
        setRoom((current) => ({ ...current, id: result.data!.id }));
        setStep(3);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Не удалось сохранить прогресс");
      }
    });
  }

  function finish(skipReservation: boolean) {
    startTransition(async () => {
      try {
        await postProgress({ action: "complete", skipReservation });
        toast.success(skipReservation ? "Настройку можно продолжить позже" : "Первая бронь создана");
        router.push("/dashboard");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Не удалось завершить настройку");
      }
    });
  }

  function saveReservation() {
    if (hasReservation) {
      finish(false);
      return;
    }
    if (!room.id) {
      toast.error("Сначала добавьте номер");
      setStep(2);
      return;
    }
    startTransition(async () => {
      const result = await createReservationAction({
        guestName,
        guestEmail,
        roomId: room.id,
        checkIn,
        checkOut,
        adults: Number(adults),
        children: 0,
        sourceChannel: "direct",
        notes: notes || undefined,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось создать бронь");
        return;
      }
      try {
        await postProgress({ action: "complete", skipReservation: false });
        toast.success("Готово — ваш отель настроен");
        router.push("/dashboard");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Бронь создана, но не удалось завершить настройку");
      }
    });
  }

  const currentStep = STEPS[step - 1];
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,var(--color-primary)/0.08,transparent_34%),var(--color-background)] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-7 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Быстрый старт</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Настроим Shanyraq за несколько минут</h1>
          <p className="mt-2 text-sm text-muted-foreground">Только необходимое для первой рабочей брони.</p>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-4" aria-label={`Шаг ${step} из 3`}>
          {STEPS.map((item, index) => {
            const number = index + 1;
            const complete = number < step;
            return (
              <div key={item.title} className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold", number <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    {complete ? <Check className="size-4" /> : number}
                  </span>
                  <span className={cn("hidden truncate text-sm font-medium sm:block", number === step ? "text-foreground" : "text-muted-foreground")}>{item.title}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full bg-primary transition-all duration-500", number <= step ? "w-full" : "w-0")} /></div>
              </div>
            );
          })}
        </div>

        <Card className="overflow-hidden shadow-xl shadow-primary/5">
          <CardHeader className="border-b bg-muted/20">
            <div className="mb-2 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><currentStep.icon className="size-5" /></div>
            <CardTitle>{currentStep.title}</CardTitle>
            <CardDescription>{currentStep.description} · шаг {step} из 3</CardDescription>
          </CardHeader>
          <CardContent className="p-5 sm:p-7">
            {step === 1 ? <HotelStep value={hotel} onChange={setHotel} /> : null}
            {step === 2 ? <RoomStep value={room} onChange={setRoom} currency={hotel.currency} /> : null}
            {step === 3 ? (
              hasReservation ? (
                <div className="rounded-xl border bg-primary/5 p-6 text-center"><Check className="mx-auto size-8 text-primary" /><h2 className="mt-3 font-semibold">Первая бронь уже готова</h2><p className="mt-1 text-sm text-muted-foreground">Перейдите в рабочий кабинет и познакомьтесь с основными разделами.</p></div>
              ) : <ReservationStep guestName={guestName} setGuestName={setGuestName} guestEmail={guestEmail} setGuestEmail={setGuestEmail} checkIn={checkIn} setCheckIn={setCheckIn} checkOut={checkOut} setCheckOut={setCheckOut} adults={adults} setAdults={setAdults} notes={notes} setNotes={setNotes} roomNumber={room.number} />
            ) : null}
          </CardContent>
        </Card>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" onClick={() => setStep((value) => Math.max(1, value - 1))} disabled={step === 1 || pending}><ChevronLeft className="size-4" />Назад</Button>
          <div className="flex items-center gap-2">
            {step === 3 && !hasReservation ? <Button variant="ghost" onClick={() => finish(true)} disabled={pending}>Сделать позже</Button> : null}
            <Button onClick={step === 1 ? saveHotel : step === 2 ? saveRoom : saveReservation} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              {step === 1 ? "Сохранить и продолжить" : step === 2 ? "Добавить номер" : hasReservation ? "Перейти в кабинет" : "Создать бронь и продолжить"}
              {!pending && step < 3 ? <ChevronRight className="size-4" /> : null}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

function HotelStep({ value, onChange }: { value: HotelDraft; onChange: (value: HotelDraft) => void }) {
  return <div className="grid gap-5 sm:grid-cols-2">
    <Field label="Название объекта" id="hotel-name"><Input id="hotel-name" value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} placeholder="Например, Almaty City Hotel" autoFocus /></Field>
    <Field label="Город" id="hotel-city"><Input id="hotel-city" value={value.city} onChange={(event) => onChange({ ...value, city: event.target.value })} placeholder="Алматы" /></Field>
    <Field label="Тип объекта" id="property-type"><Select value={value.propertyType} onValueChange={(propertyType: HotelDraft["propertyType"]) => onChange({ ...value, propertyType })}><SelectTrigger id="property-type" className="w-full"><SelectValue placeholder="Выберите тип" /></SelectTrigger><SelectContent>{PROPERTY_TYPES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
    <Field label="Страна" id="hotel-country"><Select value={value.country} onValueChange={(country) => onChange({ ...value, country })}><SelectTrigger id="hotel-country" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{COUNTRIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
    <Field label="Валюта" id="hotel-currency"><Select value={value.currency} onValueChange={(currency: HotelDraft["currency"]) => onChange({ ...value, currency })}><SelectTrigger id="hotel-currency" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{CURRENCIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
    <Field label="Часовой пояс" id="hotel-timezone"><Select value={value.timezone} onValueChange={(timezone) => onChange({ ...value, timezone })}><SelectTrigger id="hotel-timezone" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{TIMEZONES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
  </div>;
}

function RoomStep({ value, onChange, currency }: { value: RoomDraft; onChange: (value: RoomDraft) => void; currency: string }) {
  return <div className="grid gap-5 sm:grid-cols-2">
    <Field label="Название или номер" id="room-number"><Input id="room-number" value={value.number} onChange={(event) => onChange({ ...value, number: event.target.value })} placeholder="101 или Апартаменты A" autoFocus /></Field>
    <Field label="Тип номера" id="room-type"><Input id="room-type" value={value.roomTypeName} onChange={(event) => onChange({ ...value, roomTypeName: event.target.value })} placeholder="Стандарт" /></Field>
    <Field label="Вместимость" id="room-capacity"><Input id="room-capacity" type="number" min="1" max="100" value={value.capacity} onChange={(event) => onChange({ ...value, capacity: event.target.value })} /></Field>
    <Field label={`Базовая цена, ${currency}`} id="room-price">
      <Input id="room-price" type="number" min={MIN_NIGHTLY_PRICE} max={MAX_NIGHTLY_PRICE} step="500" value={value.basePrice} onChange={(event) => onChange({ ...value, basePrice: event.target.value })} />
      <p className="text-xs text-muted-foreground">От 1 000 до 999 000 ₸ за ночь</p>
    </Field>
    <Field label="Этаж" id="room-floor"><Input id="room-floor" type="number" min="-20" max="300" value={value.floor} onChange={(event) => onChange({ ...value, floor: event.target.value })} /></Field>
  </div>;
}

function ReservationStep(props: { guestName: string; setGuestName: (value: string) => void; guestEmail: string; setGuestEmail: (value: string) => void; checkIn: string; setCheckIn: (value: string) => void; checkOut: string; setCheckOut: (value: string) => void; adults: string; setAdults: (value: string) => void; notes: string; setNotes: (value: string) => void; roomNumber: string }) {
  return <div className="grid gap-5 sm:grid-cols-2">
    <div className="sm:col-span-2 rounded-xl border bg-muted/25 px-4 py-3 text-sm"><span className="text-muted-foreground">Номер:</span> <span className="font-medium">{props.roomNumber}</span></div>
    <Field label="Имя гостя" id="guest-name"><Input id="guest-name" value={props.guestName} onChange={(event) => props.setGuestName(event.target.value)} placeholder="Алия Садыкова" autoFocus /></Field>
    <Field label="Email гостя (необязательно)" id="guest-email"><Input id="guest-email" type="email" value={props.guestEmail} onChange={(event) => props.setGuestEmail(event.target.value)} placeholder="guest@example.com" /></Field>
    <Field label="Заезд" id="check-in"><Input id="check-in" type="date" value={props.checkIn} onChange={(event) => props.setCheckIn(event.target.value)} /></Field>
    <Field label="Выезд" id="check-out"><Input id="check-out" type="date" value={props.checkOut} onChange={(event) => props.setCheckOut(event.target.value)} /></Field>
    <Field label="Гостей" id="guest-count"><Select value={props.adults} onValueChange={props.setAdults}><SelectTrigger id="guest-count" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4].map((item) => <SelectItem key={item} value={String(item)}>{item}</SelectItem>)}</SelectContent></Select></Field>
    <div className="sm:col-span-2"><Field label="Комментарий (необязательно)" id="reservation-notes"><Textarea id="reservation-notes" value={props.notes} onChange={(event) => props.setNotes(event.target.value)} placeholder="Например, поздний заезд" maxLength={2000} /></Field></div>
  </div>;
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>;
}
