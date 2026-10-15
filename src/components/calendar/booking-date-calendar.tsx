"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  addMonths,
  diffDays,
  formatISODate,
  parseISODate,
  startOfMonth,
  toISODate,
} from "@/lib/dates";
import type { AppLocale } from "@/lib/locale";
import {
  monthDays,
  selectRangeDay,
  staysConflict,
  validBookingRange,
  type DateRange,
} from "@/lib/reservations/date-range";
import { useBookingOptions } from "./use-booking-options";

interface Props {
  locale: AppLocale;
  scope: string;
  todayISO: string;
  roomId?: string;
  checkInTime: string;
  checkOutTime: string;
  value: DateRange;
  onChange: (range: DateRange) => void;
  onContinue: () => void;
  onOpenReservation?: (id: string) => void;
  disabled?: boolean;
  children?: React.ReactNode;
  continueLabel?: string;
}

export function BookingDateCalendar({
  locale,
  scope,
  todayISO,
  roomId,
  checkInTime,
  checkOutTime,
  value,
  onChange,
  onContinue,
  onOpenReservation,
  disabled,
  children,
  continueLabel,
}: Props) {
  const kk = locale === "kk";
  const [month, setMonth] = useState(() =>
    toISODate(startOfMonth(parseISODate(value.checkIn || todayISO))),
  );
  const first = parseISODate(month);
  const nextMonth = toISODate(addMonths(first, 1));
  const monthQuery = roomId
    ? new URLSearchParams({
        mode: "calendar",
        roomId,
        from: month,
        to: nextMonth,
      }).toString()
    : null;
  const monthRead = useBookingOptions(monthQuery, scope, kk);
  const complete = validBookingRange(value);
  const rangeQuery =
    roomId && complete
      ? new URLSearchParams({
          mode: "calendar",
          roomId,
          from: value.checkIn,
          to: value.checkOut,
        }).toString()
      : null;
  const rangeRead = useBookingOptions(rangeQuery, scope, kk);
  const stays = monthRead.data?.stays ?? [];
  const selectionConflict = Boolean(
    complete &&
    rangeRead.data?.stays.some((stay) =>
      staysConflict({ ...value, checkInTime, checkOutTime }, stay),
    ),
  );
  const loading = monthRead.loading || rangeRead.loading;
  const error = monthRead.error || rangeRead.error;
  const allowed =
    complete && !loading && !error && !selectionConflict && !disabled;
  const nights = complete
    ? diffDays(parseISODate(value.checkIn), parseISODate(value.checkOut))
    : 0;
  const weekdayNames = kk
    ? ["Дс", "Сс", "Ср", "Бс", "Жм", "Сб", "Жс"]
    : ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  function pick(day: string) {
    const candidate = selectRangeDay(value, day);
    if (
      candidate.checkOut &&
      (!validBookingRange(candidate) ||
        stays.some((stay) =>
          staysConflict({ ...candidate, checkInTime, checkOutTime }, stay),
        ))
    )
      return;
    onChange(candidate);
  }

  return (
    <section
      className="space-y-3"
      aria-label={kk ? "Тұру күнтізбесі" : "Календарь проживания"}
      data-clarity-mask="true"
    >
      <div className="sh-mobile-card rounded-2xl border bg-white p-2 sm:p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            className="grid size-11 shrink-0 place-items-center rounded-xl text-[#07866b] focus-visible:ring-2"
            aria-label={kk ? "Алдыңғы ай" : "Предыдущий месяц"}
            onClick={() => setMonth(toISODate(addMonths(first, -1)))}
          >
            <ChevronLeft className="size-5" />
          </button>
          <h2
            className="text-center text-sm font-bold text-[#26352f]"
            aria-live="polite"
          >
            {new Intl.DateTimeFormat(kk ? "kk-KZ" : "ru-RU", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }).format(first)}
          </h2>
          <button
            type="button"
            className="grid size-11 shrink-0 place-items-center rounded-xl text-[#07866b] focus-visible:ring-2"
            aria-label={kk ? "Келесі ай" : "Следующий месяц"}
            onClick={() => setMonth(nextMonth)}
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
        <div className="grid grid-cols-7">
          {weekdayNames.map((day) => (
            <span
              key={day}
              className="py-2 text-center text-xs font-semibold text-[#626f5b]"
            >
              {day}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7" aria-busy={monthRead.loading}>
          {monthDays(month).map((day, index) => {
            if (!day) return <span key={`blank-${index}`} />;
            const busy = stays.some(
              (stay) => stay.checkIn <= day && stay.checkOut > day,
            );
            const arrival = stays.some((stay) => stay.checkIn === day);
            const departure = stays.some((stay) => stay.checkOut === day);
            const candidate = selectRangeDay(value, day);
            const selectingEnd = Boolean(candidate.checkOut);
            const blocked =
              day < todayISO ||
              Boolean(roomId && (monthRead.loading || monthRead.error)) ||
              (selectingEnd
                ? !validBookingRange(candidate) ||
                  stays.some((stay) =>
                    staysConflict(
                      { ...candidate, checkInTime, checkOutTime },
                      stay,
                    ),
                  )
                : busy || stays.some((stay) => stay.checkOut === day && checkInTime < stay.checkOutTime));
            const endpoint = day === value.checkIn || day === value.checkOut;
            const between = Boolean(
              value.checkIn &&
              value.checkOut &&
              day > value.checkIn &&
              day < value.checkOut,
            );
            const label = `${formatISODate(day)} · ${day === todayISO ? (kk ? "бүгін · " : "сегодня · ") : ""}${day === value.checkIn ? (kk ? "келу" : "заезд") : day === value.checkOut ? (kk ? "кету" : "выезд") : departure && !busy ? (kk ? "кету · түстен кейін бос" : "выезд · свободно после выезда") : busy ? (kk ? "бос емес" : "занято") : roomId ? (kk ? "бос" : "свободно") : kk ? "күнді таңдау" : "выбрать дату"}${selectingEnd && !blocked ? (kk ? " · кетуді таңдау" : " · выбрать выезд") : ""}`;
            return (
              <button
                key={day}
                type="button"
                data-date={day}
                aria-label={label}
                aria-pressed={endpoint || between}
                aria-current={day === todayISO ? "date" : undefined}
                disabled={blocked}
                onClick={() => pick(day)}
                className={`relative min-h-11 min-w-0 rounded-lg text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#07866b] ${endpoint ? "text-[#075d4d]" : between ? "bg-[#e4f3ee] text-[#075d4d]" : busy ? "bg-[#f5ead2] text-[#755720]" : "text-[#26352f] hover:bg-[#eff8f4]"} ${day === todayISO && !endpoint ? "ring-1 ring-inset ring-[#07866b]" : ""} ${day < todayISO ? "opacity-40" : ""}`}
              >
                {endpoint ? <span aria-hidden="true" className="absolute inset-y-1 bg-[#e4f3ee]" style={{ left: day === value.checkIn ? "50%" : 0, right: day === value.checkOut ? "50%" : 0 }} /> : null}
                {!endpoint && !between && (busy || departure) ? <span aria-hidden="true" className="absolute inset-x-0 bottom-1 h-1.5 overflow-hidden rounded-full"><span className="absolute inset-y-0 bg-[#c79836]" style={{ left: arrival && !departure ? "50%" : "0", right: departure && !busy ? "50%" : "0" }} /></span> : null}
                <span className={`relative mx-auto grid size-8 place-items-center rounded-full ${endpoint ? "bg-[#07866b] text-white" : ""}`}>{Number(day.slice(8))}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t pt-3 text-xs text-[#626f5b]">
          <span>
            ○ {roomId ? (kk ? "Бос" : "Свободно") : kk ? "Күндер" : "Даты"}
          </span>
          {roomId ? <span>● {kk ? "Бос емес" : "Занято"}</span> : null}
          <span className="font-bold text-[#07866b]">
            ✓ {kk ? "Таңдалды" : "Выбрано"}
          </span>
        </div>
      </div>
      <div
        className="rounded-xl bg-[#e4f3ee] p-3 text-sm text-[#075d4d]"
        aria-live="polite"
      >
        <p className="font-bold">
          {value.checkIn
            ? `${formatISODate(value.checkIn)}, ${checkInTime}`
            : kk
              ? "Келу күнін таңдаңыз"
              : "Выберите день заезда"}
          {value.checkOut
            ? ` → ${formatISODate(value.checkOut)}, ${checkOutTime} · ${nights} ${kk ? "түн" : "ноч."}`
            : value.checkIn
              ? kk
                ? " · Енді кету күнін таңдаңыз"
                : " · Теперь выберите день выезда"
              : ""}
        </p>
        <p className="mt-1 text-xs">
          {kk
            ? "Келу — күннің екінші жартысы, кету — бірінші жартысы."
            : "Заезд — правая половина дня, выезд — левая. Оплата за ночи."}
        </p>
        {!roomId ? (
          <p className="mt-1 text-xs">
            {kk
              ? "Келесі қадамда бос пәтерлерді көрсетеміз."
              : "На следующем шаге покажем свободные квартиры."}
          </p>
        ) : null}
        <button
          type="button"
          className="mt-1 min-h-11 text-xs font-bold underline"
          onClick={() => onChange({ checkIn: "", checkOut: "" })}
        >
          {kk ? "Күндерді өзгерту" : "Изменить даты"}
        </button>
      </div>
      {loading ? (
        <p role="status" className="flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          {kk ? "Бос күндерді тексереміз…" : "Проверяем свободные даты…"}
        </p>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"
        >
          <p>{error}</p>
          <button
            type="button"
            className="min-h-11 font-bold underline"
            onClick={() => {
              monthRead.retry();
              rangeRead.retry();
            }}
          >
            {kk ? "Қайталау" : "Повторить"}
          </button>
        </div>
      ) : null}
      {selectionConflict ? (
        <p
          role="alert"
          className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
        >
          {kk
            ? "Бұл кезеңде басқа бронь бар. Күндерді өзгертіңіз."
            : "В выбранном периоде есть другая бронь. Измените даты."}
        </p>
      ) : null}
      {children}
      <button
        type="button"
        disabled={!allowed}
        onClick={onContinue}
        className="sh-mobile-primary min-h-12 w-full rounded-xl bg-[#07866b] px-4 font-bold text-white disabled:opacity-50"
      >
        {continueLabel ?? (kk ? "Жалғастыру" : "Продолжить")}
      </button>
      {onOpenReservation && stays.length ? (
        <details className="space-y-1">
          <summary className="min-h-11 cursor-pointer text-sm font-bold">
            {kk ? "Осы айдағы броньдар" : "Брони этого месяца"}
          </summary>
          {stays
            .filter((stay) => stay.checkIn < nextMonth && stay.checkOut > month)
            .map((stay) => (
              <button
                key={stay.id}
                type="button"
                onClick={() => onOpenReservation(stay.id)}
                className="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 text-left text-sm"
              >
                <span>
                  {formatISODate(stay.checkIn)} → {formatISODate(stay.checkOut)}
                </span>
                <span className="text-xs font-bold text-[#07866b]">
                  {kk ? "Ашу" : "Открыть"}
                </span>
              </button>
            ))}
        </details>
      ) : null}
    </section>
  );
}
