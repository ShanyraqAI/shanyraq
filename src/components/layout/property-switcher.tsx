"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchHotelAction } from "@/server/actions/settings";
import type { AppLocale } from "@/lib/locale";

export function PropertySwitcher({ hotels, activeHotelId, hotelName, locale }: { hotels: { id: string; name: string }[]; activeHotelId: string; hotelName: string; locale: AppLocale }) {
  const id = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const kk = locale === "kk";
  return <div className="min-w-0 flex-1">
    <label htmlFor={id} className="sr-only">{kk ? "Ағымдағы нысан" : "Текущий объект"}</label>
    <select id={id} value={activeHotelId} disabled={pending || hotels.length < 2} aria-busy={pending} onChange={(event) => {
      const hotelId = event.target.value;
      setError("");
      startTransition(async () => {
        try {
          const result = await switchHotelAction(hotelId);
          if (!result.ok) { setError(result.error ?? (kk ? "Нысан ауыстырылмады" : "Не удалось сменить объект")); return; }
          // Clear mounted tenant data and history-dependent cached client state.
          router.refresh();
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload clears previous tenant client state
          window.location.assign("/dashboard");
        } catch { setError(kk ? "Желіні тексеріп, қайталаңыз" : "Проверьте соединение и повторите попытку"); }
      });
    }} className="min-h-11 w-full min-w-0 rounded-lg border bg-background px-2 text-sm font-semibold disabled:opacity-100">{hotels.length ? hotels.map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>) : <option value={activeHotelId}>{hotelName}</option>}</select>
    {pending ? <p role="status" className="text-xs">{kk ? "Ауыстырылуда…" : "Переключаем…"}</p> : null}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
  </div>;
}
