"use client";

import { useRouter } from "next/navigation";

type Option = { value: string; label: string };

/** Month and channel apply immediately; the active tab is preserved. */
export function PeriodFilter({ month, months, source, sources, tab, locale }: { month: string; months: Option[]; source: string; sources: Option[]; tab: string; locale: "ru" | "kk" }) {
  const router = useRouter();
  const kk = locale === "kk";
  function go(next: { month?: string; source?: string }) {
    const params = new URLSearchParams({ month: next.month ?? month });
    const nextSource = next.source ?? source;
    if (nextSource !== "all") params.set("source", nextSource);
    if (tab !== "overview") params.set("tab", tab);
    router.replace(`/dashboard/reports?${params}`, { scroll: false });
  }
  const field = "h-11 w-full min-w-0 rounded-xl border border-[#e5e8df] bg-white px-3 text-sm font-semibold text-[#34413a] shadow-sm";
  return (
    <div className="grid grid-cols-2 gap-2 sm:max-w-xl">
      <label className="min-w-0 space-y-1 text-[11px] font-bold text-[#7b847d]">{kk ? "Кезең" : "Период"}
        <select className={field} value={month} onChange={(event) => go({ month: event.target.value })}>{months.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      </label>
      <label className="min-w-0 space-y-1 text-[11px] font-bold text-[#7b847d]">{kk ? "Арна" : "Источник"}
        <select className={field} value={source} onChange={(event) => go({ source: event.target.value })}>
          <option value="all">{kk ? "Барлығы" : "Все источники"}</option>
          {sources.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
    </div>
  );
}
