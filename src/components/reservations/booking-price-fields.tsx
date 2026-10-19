"use client";
import { useId, useState } from "react";
import { bookingPrice, type ManualBookingPrice } from "@/lib/reservations/manual-price";
import type { AppLocale } from "@/lib/locale";

export function BookingPriceFields({ value, onChange, nights, quotedTotal, currency, locale = "ru", allowReset = true }: { value: ManualBookingPrice; onChange: (value: ManualBookingPrice) => void; nights: number; quotedTotal: number; currency: string; locale?: AppLocale; allowReset?: boolean }) {
  const id = useId();
  const kk = locale === "kk";
  const [basis, setBasis] = useState<"night" | "stay">(value?.basis ?? "night");
  const selected = basis;
  const price = bookingPrice(value, nights, quotedTotal);
  const display = value && value.basis === basis ? value.amount : selected === "night" ? String(price.perNight) : String(price.total);
  const money = (amount: number) => new Intl.NumberFormat(kk ? "kk-KZ" : "ru-RU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  return <div className="space-y-3 rounded-xl border bg-card p-4">
    <div className="grid grid-cols-2 gap-2" role="group" aria-label={kk ? "Бағаны енгізу тәсілі" : "Как указать цену"}>
      {(["night", "stay"] as const).map((item) => <button key={item} type="button" aria-pressed={selected === item} className="min-h-11 rounded-lg border px-2 text-sm font-semibold aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:text-accent-foreground" onClick={() => {
        setBasis(item);
        // Switching modes only changes the displayed input; edits explicitly change the total.
      }}>{item === "night" ? (kk ? "Түнге баға" : "Цена за ночь") : (kk ? "Бүкіл мерзімге" : "За весь срок")}</button>)}
    </div>
    <label htmlFor={id} className="block text-sm font-semibold">{selected === "night" ? (kk ? "Бір түннің бағасы" : "Цена одной ночи") : (kk ? "Тұрудың жалпы құны" : "Стоимость проживания")} · {currency}</label>
    <input id={id} type="text" inputMode="decimal" autoComplete="off" value={display === "NaN" ? "" : display} onChange={(event) => onChange({ basis: selected, amount: event.target.value })} onFocus={(event) => event.target.select()} aria-invalid={!price.valid} aria-describedby={`${id}-hint${price.valid ? "" : ` ${id}-error`}`} className="min-h-12 w-full rounded-lg border border-input bg-background px-3 text-lg font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-primary" />
    <p id={`${id}-hint`} className="text-sm text-muted-foreground">{!value ? (kk ? "Тариф бойынша нақты сома. Түнге орташа баға көрсетілген; өңдеу бір түнге бірдей баға қояды." : "Точная сумма по тарифу. Цена за ночь — средняя; при её изменении задаётся единая цена всех ночей.") : selected === "night" ? (kk ? "Түнге баға × түн саны. Депозит бөлек есептеледі." : "Цена за ночь × количество ночей. Депозит считается отдельно.") : (kk ? "Тұрудың жалпы құны. Депозит бөлек." : "Общая стоимость проживания. Депозит отдельно.")}</p>
    {!price.valid ? <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{kk ? "Бағаны тексеріңіз: теріс емес сан, үтірден кейін 2 таңбаға дейін. Жалпы сома 1 млрд-тан аспайды." : "Проверьте цену: неотрицательное число, до 2 знаков после запятой. Итог — не более 1 млрд."}</p> : null}
    <div aria-live="polite" className="flex flex-wrap items-baseline justify-between gap-2 border-t pt-3"><span className="text-sm">{nights} {kk ? "түн · Барлығы" : "ноч. · Итого"}</span><strong className="text-xl tabular-nums">{price.valid ? money(price.total) : "—"}</strong></div>
    {allowReset && value ? <button type="button" className="min-h-11 text-sm font-semibold text-primary underline" onClick={() => onChange(null)}>{kk ? "Тарифке қайтару" : "Вернуть цену по тарифу"}</button> : null}
  </div>;
}
