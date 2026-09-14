"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BedDouble, CalendarCheck2, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface GlobalSearchItem {
  id: string;
  type: "reservation" | "guest" | "room";
  title: string;
  subtitle: string;
  href: string;
}

const typeLabels = { reservation: "Бронирования", guest: "Гости", room: "Номера" } as const;
const typeIcons = { reservation: CalendarCheck2, guest: Users, room: BedDouble } as const;

export function GlobalSearch({ items }: { items: GlobalSearchItem[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (inputRef.current?.getClientRects().length) inputRef.current.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru-RU");
    if (!normalized) return [];
    return items.filter((item) => `${item.title} ${item.subtitle}`.toLocaleLowerCase("ru-RU").includes(normalized)).slice(0, 12);
  }, [items, query]);

  const showResults = focused && Boolean(query.trim());

  return (
    <div
      className="relative"
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && results[0]) {
            event.preventDefault();
            router.push(results[0].href);
            setQuery("");
            setFocused(false);
          }
          if (event.key === "Escape") {
            setQuery("");
            inputRef.current?.blur();
          }
        }}
        placeholder="Бронь, гость или номер…"
        aria-label="Поиск по текущему отелю"
        aria-expanded={showResults}
        aria-autocomplete="list"
        role="combobox"
        className="h-9 w-9 bg-background pl-8 pr-0 shadow-none placeholder:text-transparent focus:w-44 focus:pr-3 focus:placeholder:text-muted-foreground sm:w-72 sm:pr-3 sm:placeholder:text-muted-foreground"
      />
      {showResults ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 max-h-[420px] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg">
          {results.length ? results.map((item) => {
            const Icon = typeIcons[item.type];
            return <Link key={item.id} href={item.href} onClick={() => { setFocused(false); setQuery(""); }} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-secondary/70"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><Icon className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.title}</span><span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span></span><span className="text-[10px] text-muted-foreground">{typeLabels[item.type]}</span></Link>;
          }) : <div className="px-6 py-10 text-center text-sm text-muted-foreground">{items.length ? "Ничего не найдено в текущем отеле." : "Данных для поиска пока нет."}</div>}
        </div>
      ) : null}
    </div>
  );
}
