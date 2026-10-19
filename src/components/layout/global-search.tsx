"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BedDouble, CalendarCheck2, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { AppLocale } from "@/lib/locale";

export interface GlobalSearchItem { id: string; type: "reservation" | "guest" | "room"; title: string; subtitle: string; href: string }
const icons = { reservation: CalendarCheck2, guest: Users, room: BedDouble } as const;
export function GlobalSearch({ items, locale = "ru" }: { items: GlobalSearchItem[]; locale?: AppLocale }) {
  const router = useRouter();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const kk = locale === "kk";
  const labels = kk ? { reservation: "Броньдар", guest: "Қонақтар", room: "Пәтерлер" } : { reservation: "Брони", guest: "Гости", room: "Квартиры" };
  useEffect(() => {
    const handle = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && inputRef.current?.getClientRects().length) { event.preventDefault(); inputRef.current.focus(); } };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    return needle ? items.filter((item) => `${item.title} ${item.subtitle}`.toLocaleLowerCase(locale).includes(needle)).slice(0, 12) : [];
  }, [items, query, locale]);
  const open = focused && Boolean(query.trim());
  function choose(item: GlobalSearchItem) { router.push(item.href); setQuery(""); setFocused(false); inputRef.current?.blur(); }
  return <div className="relative shrink-0" onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}>
    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    <Input ref={inputRef} type="search" role="combobox" value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} onKeyDown={(event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setFocused(true); setActive((current) => results.length ? (current + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length : 0); }
      if (event.key === "Enter" && results[active]) { event.preventDefault(); choose(results[active]); }
      if (event.key === "Escape") { setQuery(""); inputRef.current?.blur(); }
    }} placeholder={kk ? "Бронь, қонақ, пәтер…" : "Бронь, гость, квартира…"} aria-label={kk ? "Ағымдағы нысанда іздеу" : "Поиск по текущему объекту"} aria-expanded={open} aria-controls={open ? `${id}-list` : undefined} aria-activedescendant={open && results[active] ? `${id}-${active}` : undefined} aria-autocomplete="list" className="h-11 w-11 pl-10 pr-0 placeholder:text-transparent max-lg:focus:fixed max-lg:focus:inset-x-4 max-lg:focus:top-3 max-lg:focus:z-[60] max-lg:focus:w-[calc(100%-2rem)] max-lg:focus:pl-3 max-lg:focus:pr-3 max-lg:focus:placeholder:text-muted-foreground lg:w-72 lg:pr-3 lg:placeholder:text-muted-foreground" />
    {open ? <div className="fixed inset-x-4 top-20 z-50 max-h-[70dvh] overflow-y-auto rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg lg:absolute lg:inset-x-auto lg:right-0 lg:top-full lg:mt-2 lg:w-[32rem]">
      <p className="px-3 py-2 text-sm text-muted-foreground">{kk ? "Соңғы жүктелген жазбалар бойынша іздеу. Толық тізім тиісті бөлімде." : "Поиск по последним загруженным записям. Полный список — в нужном разделе."}</p>
      <ul id={`${id}-list`} role="listbox" aria-label={kk ? "Іздеу нәтижелері" : "Результаты поиска"}>{results.map((item, index) => { const Icon = icons[item.type]; return <li key={item.id} id={`${id}-${index}`} role="option" aria-selected={active === index} onMouseDown={(event) => event.preventDefault()} onMouseMove={() => setActive(index)} onClick={() => choose(item)} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-lg px-3 py-3 ${active === index ? "bg-accent text-accent-foreground" : ""}`}><Icon className="size-5 shrink-0" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.title}</span><span className="block truncate text-sm">{item.subtitle}</span></span><span className="text-sm">{labels[item.type]}</span></li>; })}</ul>
      {!results.length ? <p role="status" className="px-3 py-6 text-sm">{kk ? "Жүктелген жазбалардан табылмады." : "Среди загруженных записей ничего не найдено."}</p> : null}
    </div> : null}
  </div>;
}
