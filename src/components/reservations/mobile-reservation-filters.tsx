"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, RotateCcw } from "lucide-react";
import type { AppLocale } from "@/lib/locale";
import { cn } from "@/lib/utils";

export function MobileReservationFilters({ locale, count }: { locale: AppLocale; count: number }) {
  const router = useRouter();
  const kk = locale === "kk";
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [debt, setDebt] = useState(false);

  function apply() {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (source !== "all") params.set("channel", source);
    if (debt) params.set("debt", "1");
    router.push(`/dashboard/reservations${params.size ? `?${params}` : ""}`);
  }

  return <div className="mx-auto max-w-md space-y-5">
    <header className="flex items-start gap-3"><button type="button" onClick={() => router.back()} className="mt-0.5 grid size-9 place-items-center rounded-full bg-white ring-1 ring-[#e7e9e1]"><ChevronLeft className="size-5" /></button><div className="flex-1"><h1 className="sh-mobile-title">{kk ? "Бронь сүзгілері" : "Фильтры броней"}</h1><p className="sh-mobile-eyebrow">{kk ? "Іріктеуді баптаңыз" : "Настройте выборку"}</p></div><button type="button" onClick={() => { setStatus("all"); setSource("all"); setDebt(false); }} className="mt-2 flex items-center gap-1 text-[10px] font-bold text-[#07866b]"><RotateCcw className="size-3" />{kk ? "Тазарту" : "Сбросить"}</button></header>
    <section><h2 className="sh-mobile-section-title mb-2">{kk ? "Мәртебе" : "Статус"}</h2><div className="flex flex-wrap gap-2">{[["all", kk ? "Барлығы" : "Все", "#eaf0ec", "#536159"], ["CONFIRMED", kk ? "Расталды" : "Подтверждена", "#def2e9", "#13765f"], ["PENDING", kk ? "Күтуде" : "Ожидает", "#fff1d7", "#a66b0a"], ["CHECKED_IN", kk ? "Келді" : "Заселён", "#dcecff", "#376bb0"], ["CHECKED_OUT", kk ? "Кетті" : "Выселен" , "#eee7fb", "#7253a5"], ["CANCELLED", kk ? "Бас тартылды" : "Отменена", "#fde5e2", "#b84b42"], ["NO_SHOW", kk ? "Келмеді" : "Не заехал", "#f0e6e2", "#855b4b"]].map(([value, label, bg, fg]) => <button key={value} type="button" onClick={() => setStatus(value)} aria-pressed={status === value} style={{ backgroundColor: bg, color: fg }} className={cn("rounded-full px-3 py-2 text-[11px] font-bold ring-1 ring-black/5 transition aria-pressed:ring-2 aria-pressed:ring-offset-1", status === value && "shadow-sm")}>{label}</button>)}</div></section>
    <section><h2 className="sh-mobile-section-title mb-2">{kk ? "Дереккөз" : "Источник"}</h2><div className="sh-mobile-card overflow-hidden">{[["all", kk ? "Барлық арналар" : "Все каналы", "#eef2ef", "#66716a"], ["direct", kk ? "Тікелей" : "Прямые", "#def2e9", "#13765f"], ["booking", "Booking.com", "#e2edff", "#3268ad"], ["ostrovok", "Ostrovok", "#eee7fb", "#7253a5"], ["krisha", "Krisha.kz", "#fff0db", "#a86c0b"]].map(([value, label, bg, fg]) => <button key={value} type="button" onClick={() => setSource(value)} style={{ backgroundColor: source === value ? bg : undefined, color: source === value ? fg : undefined }} className="flex min-h-12 w-full items-center gap-3 border-b border-[#edefe8] px-3.5 text-left text-xs font-bold last:border-0"><span className={cn("grid size-5 place-items-center rounded-full border border-[#cfd4cc] text-transparent", source === value && "border-current bg-current/10 text-current")}><Check className="size-3" /></span>{label}</button>)}</div></section>
    <section><h2 className="sh-mobile-section-title mb-2">{kk ? "Төлем" : "Оплата"}</h2><label className="sh-mobile-card flex min-h-13 items-center justify-between px-3.5 text-xs font-bold"><span>{kk ? "Қарызы бар" : "Есть задолженность"}</span><input type="checkbox" checked={debt} onChange={(event) => setDebt(event.target.checked)} className="size-5 accent-[#07866b]" /></label></section>
    <button type="button" onClick={apply} className="sh-mobile-primary w-full">{kk ? `${count} броньды көрсету` : `Показать ${count} броней`}</button>
  </div>;
}
