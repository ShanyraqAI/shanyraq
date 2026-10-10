import Link from "next/link";
import { cn } from "@/lib/utils";

export const REPORT_TABS = ["overview", "units", "expenses", "payments"] as const;
export type ReportTab = (typeof REPORT_TABS)[number];

const LABELS: Record<"ru" | "kk", Record<ReportTab, string>> = {
  ru: { overview: "Обзор", units: "Квартиры", expenses: "Расходы", payments: "Платежи" },
  kk: { overview: "Шолу", units: "Пәтерлер", expenses: "Шығындар", payments: "Төлемдер" },
};

export function parseReportTab(value: unknown): ReportTab {
  return REPORT_TABS.find((tab) => tab === value) ?? "overview";
}

/** Tabs keep the selected period and channel so switching sections never resets the filter. */
export function ReportTabs({ active, query, locale }: { active: ReportTab; query: Record<string, string>; locale: "ru" | "kk" }) {
  return (
    <nav aria-label={locale === "kk" ? "Есеп бөлімдері" : "Разделы отчёта"} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2 sm:w-auto">
        {REPORT_TABS.map((tab) => {
          const params = new URLSearchParams(query);
          if (tab !== "overview") params.set("tab", tab);
          const href = `/dashboard/reports${params.size ? `?${params}` : ""}`;
          return (
            <li key={tab}>
              <Link href={href} replace scroll={false} aria-current={tab === active ? "page" : undefined}
                className={cn("inline-flex min-h-10 items-center rounded-full px-4 text-sm font-bold ring-1 transition-colors", tab === active ? "bg-[#07866b] text-white ring-[#07866b]" : "bg-white text-[#4f5b54] ring-[#e5e8df] hover:bg-[#f1f6f3]")}>
                {LABELS[locale][tab]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
