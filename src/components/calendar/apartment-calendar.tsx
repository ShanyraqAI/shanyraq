"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AppLocale } from "@/lib/locale";
import type { DateRange } from "@/lib/reservations/date-range";
import { BookingDateCalendar } from "./booking-date-calendar";

export function ApartmentCalendar(props: {
  roomId: string;
  roomName: string;
  locale: AppLocale;
  scope: string;
  todayISO: string;
  checkInTime: string;
  checkOutTime: string;
  canBook: boolean;
}) {
  const router = useRouter();
  const [range, setRange] = useState<DateRange>({ checkIn: "", checkOut: "" });
  const kk = props.locale === "kk";
  return (
    <div className="mx-auto max-w-md space-y-4 pb-[max(env(safe-area-inset-bottom),16px)]">
      <Link
        href="/dashboard/rooms"
        className="inline-flex min-h-11 items-center text-sm font-bold text-[#07866b]"
      >
        ← {kk ? "Пәтерлер" : "Квартиры"}
      </Link>
      <header>
        <h1 className="sh-mobile-title break-words">{props.roomName}</h1>
        <p className="sh-mobile-eyebrow">
          {kk ? "Пәтер күнтізбесі" : "Календарь квартиры"}
        </p>
      </header>
      <BookingDateCalendar
        {...props}
        value={range}
        onChange={setRange}
        disabled={!props.canBook}
        onContinue={() =>
          router.push(
            `/dashboard/reservations/new?${new URLSearchParams({ roomId: props.roomId, ...range })}`,
          )
        }
        onOpenReservation={
          props.canBook
            ? (id) =>
                router.push(`/dashboard/reservations/${encodeURIComponent(id)}`)
            : undefined
        }
      />
      {!props.canBook ? (
        <p className="text-sm text-[#626f5b]">
          {kk
            ? "Бронь жасау үшін рұқсат қажет."
            : "Для создания и открытия брони нужны права на бронирования."}
        </p>
      ) : null}
    </div>
  );
}
