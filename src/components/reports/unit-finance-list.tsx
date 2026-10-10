import { formatReportMoney } from "@/lib/reports/format";
import type { UnitFinanceRow } from "@/lib/reports/units";
import { formatPercent } from "@/lib/utils";

/** Cards on phones, a RealtyCalendar-style table from the sm breakpoint. */
export function UnitFinanceList({ rows, currency, locale }: { rows: UnitFinanceRow[]; currency: string; locale: "ru" | "kk" }) {
  const kk = locale === "kk";
  const money = (value: number) => formatReportMoney(value, currency);
  const total = (pick: (row: UnitFinanceRow) => number) => rows.reduce((sum, row) => sum + pick(row), 0);
  const profitClass = (value: number) => (value < 0 ? "text-[#b13d33]" : "text-[#0a7a62]");
  if (rows.length === 0) return <p className="sh-mobile-card p-6 text-center text-sm text-[#8b9189]">{kk ? "Пәтерлер жоқ" : "Квартир пока нет"}</p>;
  const heads = kk ? ["Пәтер", "Табыс", "Шығын", "Комиссия", "Пайда", "Жүктеме", "ADR", "RevPAR"] : ["Квартира", "Доход", "Расход", "Комиссия", "Прибыль", "Загрузка", "ADR", "RevPAR"];
  return (
    <>
      <ul className="space-y-3 sm:hidden">
        {rows.map((row) => (
          <li key={row.roomId} className="sh-mobile-card p-4">
            <div className="flex items-center justify-between gap-3"><b className="text-base text-[#26342d]">{row.number}</b><span className={`text-lg font-extrabold tabular-nums ${profitClass(row.profit)}`}>{money(row.profit)}</span></div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#9aa199]">{heads[4]}</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              {[[heads[1], money(row.revenue)], [heads[2], money(row.expenses)], [heads[3], money(row.commission)], [heads[5], formatPercent(row.occupancy)], ["ADR", money(row.adr)], ["RevPAR", money(row.revpar)]].map(([label, value]) => <div key={label}><dt className="text-[#8b9189]">{label}</dt><dd className="mt-0.5 font-bold tabular-nums text-[#2f3b35]">{value}</dd></div>)}
            </dl>
          </li>
        ))}
        {rows.length > 1 ? <li className="sh-mobile-card flex items-center justify-between p-4"><b>{kk ? "Барлығы" : "Итого"}</b><b className={`tabular-nums ${profitClass(total((row) => row.profit))}`}>{money(total((row) => row.profit))}</b></li> : null}
      </ul>
      <div className="sh-mobile-card hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[#eceee6] text-left text-xs text-[#7b847d]">{heads.map((title, index) => <th key={title} className={`px-4 py-3 font-bold ${index ? "text-right" : ""}`}>{title}</th>)}</tr></thead>
          <tbody className="divide-y divide-[#f0f1ea]">
            {rows.map((row) => <tr key={row.roomId}><td className="px-4 py-3 font-extrabold">{row.number}</td><td className="px-4 py-3 text-right tabular-nums">{money(row.revenue)}</td><td className="px-4 py-3 text-right tabular-nums">{money(row.expenses)}</td><td className="px-4 py-3 text-right tabular-nums">{money(row.commission)}</td><td className={`px-4 py-3 text-right font-extrabold tabular-nums ${profitClass(row.profit)}`}>{money(row.profit)}</td><td className="px-4 py-3 text-right tabular-nums">{formatPercent(row.occupancy)}</td><td className="px-4 py-3 text-right tabular-nums">{money(row.adr)}</td><td className="px-4 py-3 text-right tabular-nums">{money(row.revpar)}</td></tr>)}
          </tbody>
          {rows.length > 1 ? <tfoot><tr className="border-t-2 border-[#e1e4da] bg-[#f7f9f5] font-extrabold"><td className="px-4 py-3">{kk ? "Барлығы" : "Итого"}</td><td className="px-4 py-3 text-right tabular-nums">{money(total((row) => row.revenue))}</td><td className="px-4 py-3 text-right tabular-nums">{money(total((row) => row.expenses))}</td><td className="px-4 py-3 text-right tabular-nums">{money(total((row) => row.commission))}</td><td className={`px-4 py-3 text-right tabular-nums ${profitClass(total((row) => row.profit))}`}>{money(total((row) => row.profit))}</td><td colSpan={3} /></tr></tfoot> : null}
        </table>
      </div>
    </>
  );
}
