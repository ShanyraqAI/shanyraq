"use client";

import { useRouter } from "next/navigation";

export function MonthSelector({ value, options, source, locale }: { value: string; options: Array<{ value: string; label: string }>; source: string; locale: "ru" | "kk" }) {
  const router = useRouter();
  return <label className="flex min-w-0 items-center gap-2 rounded-xl border border-[#e7e9e0] bg-white px-3 py-2 text-xs font-bold text-[#39463f] shadow-sm">
    <span className="shrink-0 text-[#828a82]">{locale === "kk" ? "Ай" : "Месяц"}</span>
    <select aria-label={locale === "kk" ? "Есеп айы" : "Месяц отчёта"} value={value} onChange={(event) => { const params = new URLSearchParams({ month: event.target.value }); if (source !== "all") params.set("source", source); router.push(`/dashboard/reports?${params.toString()}`); }} className="min-w-0 flex-1 bg-transparent py-1 font-extrabold text-[#27342e] outline-none">
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}
