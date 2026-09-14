"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BedDouble, CalendarCheck2, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru-RU");
    if (!normalized) return items.slice(0, 8);
    return items.filter((item) => `${item.title} ${item.subtitle}`.toLocaleLowerCase("ru-RU").includes(normalized)).slice(0, 12);
  }, [items, query]);

  return <>
    <Button variant="outline" className="h-9 w-9 justify-start bg-background px-2.5 text-muted-foreground shadow-none sm:w-72" onClick={() => setOpen(true)} aria-label="Быстрый поиск">
      <Search className="size-4 shrink-0" /><span className="hidden flex-1 text-left text-xs sm:inline">Бронь, гость или номер…</span><kbd className="hidden rounded border bg-secondary px-1.5 py-0.5 text-[10px] font-medium sm:inline">Ctrl K</kbd>
    </Button>
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="sr-only"><DialogTitle>Быстрый поиск</DialogTitle><DialogDescription>Поиск по данным текущего отеля</DialogDescription></DialogHeader>
        <div className="flex items-center gap-2 border-b px-4"><Search className="size-4 text-muted-foreground" /><Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Введите имя гостя, номер или код брони" className="h-12 border-0 px-0 shadow-none focus-visible:ring-0" /></div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          {results.length ? results.map((item) => {
            const Icon = typeIcons[item.type];
            return <Link key={item.id} href={item.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-secondary/70"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><Icon className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.title}</span><span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span></span><span className="text-[10px] text-muted-foreground">{typeLabels[item.type]}</span></Link>;
          }) : <div className="px-6 py-12 text-center text-sm text-muted-foreground">{items.length ? "Ничего не найдено в текущем отеле." : "Данных для поиска пока нет."}</div>}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
