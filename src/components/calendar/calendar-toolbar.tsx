"use client";

import { useState, type ReactNode } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ListFilter, Plus, Search, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { CalendarFilters, CalendarPreferences } from "./types";
import { CALENDAR_RANGE_OPTIONS, formatCalendarRange, type CalendarRangeDays } from "@/lib/reservations/calendar-range";
import { channelLabel, t } from "@/lib/i18n";

interface CalendarToolbarProps {
  anchorISO: string;
  rangeDays: CalendarRangeDays;
  todayISO: string;
  filters: CalendarFilters;
  preferences: CalendarPreferences;
  roomTypeOptions: Array<[string, string]>;
  navigating: boolean;
  savingPreferences: boolean;
  searchQuery: string;
  searchResultCount: number;
  onSearchChange: (query: string) => void;
  onNavigate: (anchorISO: string, rangeDays?: CalendarRangeDays) => void;
  onShift: (direction: 1 | -1) => void;
  onFiltersChange: (filters: CalendarFilters) => void;
  onPreferencesChange: (preferences: CalendarPreferences) => void;
  onCreate: () => void;
}

const EMPTY_FILTERS: CalendarFilters = { roomTypeId: "all", channelId: "all", statusId: "all" };
const CHANNEL_OPTIONS = ["booking", "ostrovok", "krisha", "direct"];
const STATUS_OPTIONS = ["PENDING", "CONFIRMED", "CHECKED_IN"] as const;
const DENSITY_OPTIONS = [["COMFORTABLE", "Комфортный"], ["STANDARD", "Стандартный"], ["COMPACT", "Компактный"]] as const;
const CURRENCY_OPTIONS = [["SYMBOL", "Символ"], ["CODE", "Код"], ["HIDDEN", "Скрыть"]] as const;
const VIEW_FIELDS = [
  { key: "showGuestName", label: "Имя гостя", description: "Главная подпись бронирования" },
  { key: "showGuestCount", label: "Количество гостей", description: "Компактно рядом с именем" },
  { key: "showChannel", label: "Канал", description: "Небольшой значок источника" },
  { key: "showAmount", label: "Сумма", description: "Показывается только на достаточно длинной брони" },
  { key: "showReservationId", label: "Номер брони", description: "Внутренний последовательный ID" },
  { key: "showNotes", label: "Заметка", description: "Иконка, если заметка существует" },
] as const;

export function CalendarToolbar(props: CalendarToolbarProps) {
  const rangeLabel = formatCalendarRange(props.anchorISO, props.rangeDays);
  const activeFilterCount = Object.values(props.filters).filter((value) => value !== "all").length;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 shadow-sm [&_button]:active:translate-y-0">
      <Button variant="outline" size="sm" onClick={() => props.onNavigate(props.todayISO)} disabled={props.navigating}>{t.common.today}</Button>
      <div className="flex items-center">
        <Button variant="ghost" size="icon-sm" onClick={() => props.onShift(-1)} disabled={props.navigating} aria-label="Предыдущий диапазон"><ChevronLeft className="size-4" /></Button>
        <DateJumpButton {...props} label={rangeLabel} id="calendar-date" />
        <Button variant="ghost" size="icon-sm" onClick={() => props.onShift(1)} disabled={props.navigating} aria-label="Следующий диапазон"><ChevronRight className="size-4" /></Button>
      </div>
      <RangeSelector {...props} />

      <div className="order-last flex min-w-full flex-1 items-center gap-2 lg:order-none lg:ml-auto lg:min-w-64 lg:max-w-sm">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={props.searchQuery} onChange={(event) => props.onSearchChange(event.target.value)} placeholder="Гость, телефон, номер или бронь" className="h-8 pl-8 pr-8 text-sm" aria-label="Поиск по шахматке" />
          {props.searchQuery ? (
            <button type="button" onClick={() => props.onSearchChange("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Очистить поиск"><X className="size-3.5" /></button>
          ) : null}
        </div>
        {props.searchQuery ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{props.searchResultCount}</span> : null}
      </div>

      <FilterPopover {...props} activeCount={activeFilterCount} />
      <ViewSettings {...props} />
      <Button size="sm" className="shadow-sm" onClick={props.onCreate}><Plus className="mr-1.5 size-4" /><span className="hidden sm:inline">{t.calendar.newReservation}</span><span className="sm:hidden">Бронь</span></Button>
    </div>
  );
}

function DateJumpButton({ anchorISO, rangeDays, navigating, onNavigate, label, id }: CalendarToolbarProps & { label: string; id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="min-w-44 justify-center px-2 font-semibold" disabled={navigating} aria-label={`Текущий диапазон: ${label}. Выбрать дату`}><CalendarDays className="mr-1.5 size-4 shrink-0 text-primary" /><span className="truncate">{label}</span></Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-4">
        <div className="space-y-2">
          <Label htmlFor={id}>Перейти к дате</Label>
          <Input id={id} type="date" value={anchorISO} onChange={(event) => { if (!event.target.value) return; onNavigate(event.target.value, rangeDays); setOpen(false); }} />
          <p className="text-xs text-muted-foreground">Выбранная дата станет первым днём шкалы.</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RangeSelector({ rangeDays, navigating, onNavigate, anchorISO }: CalendarToolbarProps) {
  return (
    <Select value={String(rangeDays)} onValueChange={(value) => onNavigate(anchorISO, Number(value) as CalendarRangeDays)} disabled={navigating}>
      <SelectTrigger size="sm" className="w-[104px] border-0 bg-secondary/60 shadow-none"><SelectValue>{rangeDays} дней</SelectValue></SelectTrigger>
      <SelectContent>{CALENDAR_RANGE_OPTIONS.map((days) => <SelectItem key={days} value={String(days)}>{days} дней</SelectItem>)}</SelectContent>
    </Select>
  );
}

function FilterPopover({ filters, roomTypeOptions, onFiltersChange, activeCount }: CalendarToolbarProps & { activeCount: number }) {
  return (
    <Popover>
      <PopoverTrigger asChild><Button variant="outline" size="sm"><ListFilter className="mr-1.5 size-4" />Фильтры{activeCount ? ` · ${activeCount}` : ""}</Button></PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div><div className="text-sm font-semibold">Фильтры</div><div className="text-xs text-muted-foreground">Только подходящие номера и брони.</div></div>
          {activeCount ? <Button variant="ghost" size="sm" onClick={() => onFiltersChange(EMPTY_FILTERS)}>Сбросить</Button> : null}
        </div>
        <div className="grid gap-3">
          <FilterField label="Категория номера"><Select value={filters.roomTypeId} onValueChange={(roomTypeId) => onFiltersChange({ ...filters, roomTypeId })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Все категории</SelectItem>{roomTypeOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select></FilterField>
          <FilterField label="Канал"><Select value={filters.channelId} onValueChange={(channelId) => onFiltersChange({ ...filters, channelId })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Все каналы</SelectItem>{CHANNEL_OPTIONS.map((channel) => <SelectItem key={channel} value={channel}>{channelLabel(channel)}</SelectItem>)}</SelectContent></Select></FilterField>
          <FilterField label="Статус брони"><Select value={filters.statusId} onValueChange={(statusId) => onFiltersChange({ ...filters, statusId })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Все статусы</SelectItem>{STATUS_OPTIONS.map((status) => <SelectItem key={status} value={status}>{t.statuses.reservation[status]}</SelectItem>)}</SelectContent></Select></FilterField>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ViewSettings({ preferences, onPreferencesChange, savingPreferences }: CalendarToolbarProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(preferences);
  return (
    <Sheet open={open} onOpenChange={(next) => { if (next) setDraft(preferences); setOpen(next); }}>
      <SheetTrigger asChild><Button variant="outline" size="sm"><Settings2 className="mr-1.5 size-4" /><span className="hidden xl:inline">Настроить вид</span><span className="xl:hidden">Вид</span></Button></SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader><SheetTitle>Настроить шахматку</SheetTitle><SheetDescription>Настройки сохраняются только для вашего профиля в этом отеле.</SheetDescription></SheetHeader>
        <div className="space-y-6 overflow-y-auto px-4">
          <div className="space-y-2">
            <Label>Плотность строк</Label>
            <div className="grid h-9 grid-cols-3 gap-1 rounded-lg bg-secondary p-1">{DENSITY_OPTIONS.map(([value, label]) => <button key={value} type="button" aria-pressed={draft.density === value} className="h-7 rounded-md px-2 text-xs font-medium transition-colors active:scale-100 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm" onClick={() => setDraft({ ...draft, density: value })}>{label}</button>)}</div>
          </div>
          <div className="space-y-2">
            <div><Label>Отображение валюты</Label><p className="text-xs text-muted-foreground">Для суммы на полосе бронирования.</p></div>
            <div className="grid h-9 grid-cols-3 gap-1 rounded-lg bg-secondary p-1">{CURRENCY_OPTIONS.map(([value, label]) => <button key={value} type="button" aria-pressed={draft.currencyDisplay === value} className="h-7 rounded-md px-2 text-xs font-medium transition-colors active:scale-100 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm" onClick={() => setDraft({ ...draft, currencyDisplay: value })}>{label}</button>)}</div>
          </div>
          <div className="space-y-3">
            <div><Label>Что показывать на брони</Label><p className="text-xs text-muted-foreground">Оставьте только информацию, нужную в ежедневной работе.</p></div>
            {VIEW_FIELDS.map((field) => (
              <label key={field.key} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-accent/40">
                <Checkbox checked={draft[field.key]} onCheckedChange={(checked) => setDraft({ ...draft, [field.key]: checked === true })} />
                <span className="min-w-0"><span className="block text-sm font-medium">{field.label}</span><span className="block text-xs text-muted-foreground">{field.description}</span></span>
              </label>
            ))}
          </div>
        </div>
        <SheetFooter><Button disabled={savingPreferences} onClick={() => { onPreferencesChange(draft); setOpen(false); }}>Сохранить вид</Button></SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
