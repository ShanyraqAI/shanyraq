"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EXPENSE_CATEGORIES } from "@/lib/reports/expenses";
import { formatReportMoney } from "@/lib/reports/format";
import { createExpenseAction, deleteExpenseAction } from "@/server/actions/finance";

type Props = {
  currency: string;
  today: string;
  rooms: Array<{ id: string; number: string }>;
  expenses: Array<{ id: string; date: string; amount: number; category: string; comment: string | null; roomLabel: string }>;
  categories: Array<{ category: string; value: number }>;
  total: number;
  filteredBySource: boolean;
};

const input = "h-11 w-full rounded-xl border border-[#e5e8df] bg-white px-3 text-sm";

export function ExpensePanel({ currency, today, rooms, expenses, categories, total, filteredBySource }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [custom, setCustom] = useState("");
  const [comment, setComment] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const money = (value: number) => formatReportMoney(value, currency);

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createExpenseAction({ date, amount: Number(amount), category: category === "__custom" ? custom : category, comment, roomIds: selected });
      if (!result.ok) return void toast.error(result.error ?? "Не удалось сохранить расход");
      toast.success(result.message ?? "Расход добавлен");
      setAmount("");
      setComment("");
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("Удалить расход?")) return;
    startTransition(async () => {
      const result = await deleteExpenseAction(id);
      if (!result.ok) return void toast.error(result.error ?? "Не удалось удалить");
      toast.success(result.message ?? "Расход удалён");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <form onSubmit={submit} className="sh-mobile-card space-y-3 p-4 lg:self-start">
        <h2 className="sh-mobile-section-title">Добавить расход</h2>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-[11px] font-bold text-[#7b847d]">Сумма, {currency}<input required inputMode="decimal" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className={input} placeholder="0" /></label>
          <label className="space-y-1 text-[11px] font-bold text-[#7b847d]">Дата<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className={input} /></label>
        </div>
        <label className="block space-y-1 text-[11px] font-bold text-[#7b847d]">Статья
          <select value={category} onChange={(event) => setCategory(event.target.value)} className={input}>
            {EXPENSE_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
            <option value="__custom">Своя статья…</option>
          </select>
        </label>
        {category === "__custom" ? <input required maxLength={40} value={custom} onChange={(event) => setCustom(event.target.value)} className={input} placeholder="Название статьи" aria-label="Название статьи" /> : null}
        <fieldset className="space-y-2">
          <legend className="text-[11px] font-bold text-[#7b847d]">Квартиры</legend>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSelected([])} aria-pressed={selected.length === 0} className={chip(selected.length === 0)}>Все квартиры</button>
            {rooms.map((room) => <button key={room.id} type="button" onClick={() => toggle(room.id)} aria-pressed={selected.includes(room.id)} className={chip(selected.includes(room.id))}>{room.number}</button>)}
          </div>
          <p className="text-[11px] text-[#8b9189]">{selected.length > 1 ? `Сумма поровну: ${money((Number(amount) || 0) / selected.length)} на квартиру.` : selected.length === 0 && rooms.length > 1 ? `Сумма поровну на все квартиры: ${money((Number(amount) || 0) / rooms.length)} на каждую.` : "Расход попадёт в прибыль выбранной квартиры."}</p>
        </fieldset>
        <label className="block space-y-1 text-[11px] font-bold text-[#7b847d]">Комментарий<input maxLength={240} value={comment} onChange={(event) => setComment(event.target.value)} className={input} placeholder="Необязательно" /></label>
        <button type="submit" disabled={pending || !amount} className="sh-mobile-primary flex w-full items-center justify-center disabled:opacity-60">{pending ? "Сохраняем…" : "Добавить расход"}</button>
      </form>

      <div className="space-y-4">
        <section className="sh-mobile-card p-4">
          <div className="flex items-baseline justify-between gap-3"><h2 className="sh-mobile-section-title">Расходы за период</h2><b className="text-lg tabular-nums text-[#26342d]">{money(total)}</b></div>
          {filteredBySource ? <p className="mt-2 text-xs text-[#a06a1d]">Выбран один источник: общие расходы объекта не показываются. Верните «Все источники».</p> : null}
          {categories.length ? <ul className="mt-3 space-y-2">{categories.map((row) => <li key={row.category} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-xs"><span className="font-bold text-[#39463f]">{row.category}</span><span className="tabular-nums font-bold">{money(row.value)}</span><span className="w-9 text-right text-[#737b74]">{Math.round(row.value / Math.max(1, total) * 100)}%</span></li>)}</ul> : null}
        </section>
        <section className="sh-mobile-card divide-y divide-[#eceee6]">
          {expenses.length === 0 ? <p className="p-6 text-center text-sm text-[#8b9189]">{filteredBySource ? "Нет данных для выбранного источника." : "За этот период расходов нет. Добавьте первый слева."}</p> : expenses.map((row) => (
            <div key={row.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-[#2c3932]">{row.category}</p><p className="truncate text-[11px] text-[#8b9189]">{row.date} · {row.roomLabel}{row.comment ? ` · ${row.comment}` : ""}</p></div>
              <b className="shrink-0 text-sm tabular-nums">{money(row.amount)}</b>
              <button type="button" disabled={pending} onClick={() => remove(row.id)} aria-label="Удалить расход" className="grid size-9 shrink-0 place-items-center rounded-full text-[#9a4b43] hover:bg-[#fbeeec]"><Trash2 className="size-4" /></button>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function chip(active: boolean) {
  return `min-h-9 rounded-full px-3 text-xs font-bold ring-1 transition-colors ${active ? "bg-[#07866b] text-white ring-[#07866b]" : "bg-white text-[#4f5b54] ring-[#e5e8df]"}`;
}
