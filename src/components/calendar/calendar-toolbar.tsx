"use client";

import { useState, type ReactNode } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ListFilter, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { CalendarFilters } from "./types";
import {
  CALENDAR_RANGE_OPTIONS,
  formatCalendarRange,
  type CalendarRangeDays,
} from "@/lib/reservations/calendar-range";
import { channelLabel, t } from "@/lib/i18n";

interface CalendarToolbarProps {
  anchorISO: string;
  rangeDays: CalendarRangeDays;
  todayISO: string;
  filters: CalendarFilters;
  roomTypeOptions: Array<[string, string]>;
  navigating: boolean;
  onNavigate: (anchorISO: string, rangeDays?: CalendarRangeDays) => void;
  onShift: (direction: 1 | -1) => void;
  onFiltersChange: (filters: CalendarFilters) => void;
  onCreate: () => void;
}

const EMPTY_FILTERS: CalendarFilters = {
  roomTypeId: "all",
  channelId: "all",
  statusId: "all",
};

const CHANNEL_OPTIONS = ["booking", "ostrovok", "krisha", "direct"];
const STATUS_OPTIONS = ["PENDING", "CONFIRMED", "CHECKED_IN"] as const;

export function CalendarToolbar(props: CalendarToolbarProps) {
  const rangeLabel = formatCalendarRange(props.anchorISO, props.rangeDays);
  const activeFilterCount = Object.values(props.filters).filter((value) => value !== "all").length;

  return (
    <div className="space-y-2">
      <div className="hidden flex-wrap items-center gap-2 2xl:flex">
        <Button variant="outline" size="sm" onClick={() => props.onNavigate(props.todayISO)} disabled={props.navigating}>
          {t.common.today}
        </Button>
        <Button variant="outline" size="icon" onClick={() => props.onShift(-1)} disabled={props.navigating} aria-label="Предыдущий диапазон">
          <ChevronLeft className="size-4" />
        </Button>
        <DateJumpButton {...props} label={rangeLabel} id="calendar-date-desktop" />
        <Button variant="outline" size="icon" onClick={() => props.onShift(1)} disabled={props.navigating} aria-label="Следующий диапазон">
          <ChevronRight className="size-4" />
        </Button>
        <RangeSelector {...props} />

        <div className="ml-auto flex items-center gap-2">
          <DesktopFilters {...props} />
          <Button size="sm" onClick={props.onCreate}>
            <Plus className="mr-1.5 size-4" /> {t.calendar.newReservation}
          </Button>
        </div>
      </div>

      <div className="grid gap-2 2xl:hidden">
        <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem_auto] items-center gap-1.5">
          <Button variant="outline" size="icon" className="size-10" onClick={() => props.onShift(-1)} disabled={props.navigating} aria-label="Предыдущий диапазон">
            <ChevronLeft className="size-4" />
          </Button>
          <DateJumpButton {...props} label={rangeLabel} id="calendar-date-mobile" compact />
          <Button variant="outline" size="icon" className="size-10" onClick={() => props.onShift(1)} disabled={props.navigating} aria-label="Следующий диапазон">
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" className="px-2" onClick={() => props.onNavigate(props.todayISO)} disabled={props.navigating}>
            {t.common.today}
          </Button>
        </div>
        <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] gap-2">
          <RangeSelector {...props} />
          <MobileFilters
            filters={props.filters}
            activeCount={activeFilterCount}
            roomTypeOptions={props.roomTypeOptions}
            onApply={props.onFiltersChange}
          />
          <Button size="sm" className="min-w-0" onClick={props.onCreate}>
            <Plus className="size-4 sm:mr-1.5" /> <span className="hidden sm:inline">{t.calendar.newReservation}</span><span className="sm:hidden">Бронь</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

function DateJumpButton({
  anchorISO,
  rangeDays,
  navigating,
  onNavigate,
  label,
  id,
  compact = false,
}: CalendarToolbarProps & { label: string; id: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={compact ? "h-10 min-w-0 justify-center px-2" : "min-w-64 justify-center"}
          disabled={navigating}
          aria-label={`Текущий диапазон: ${label}. Выбрать дату`}
        >
          <CalendarDays className="mr-1.5 size-4 shrink-0 text-primary" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-72 p-4">
        <div className="space-y-2">
          <Label htmlFor={id}>Перейти к дате</Label>
          <Input
            id={id}
            type="date"
            value={anchorISO}
            onChange={(event) => {
              if (!event.target.value) return;
              onNavigate(event.target.value, rangeDays);
              setOpen(false);
            }}
          />
          <p className="text-xs text-muted-foreground">Выбранная дата станет первым днём временной шкалы.</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RangeSelector({ rangeDays, navigating, onNavigate, anchorISO }: CalendarToolbarProps) {
  return (
    <Select
      value={String(rangeDays)}
      onValueChange={(value) => onNavigate(anchorISO, Number(value) as CalendarRangeDays)}
      disabled={navigating}
    >
      <SelectTrigger size="sm" className="w-[112px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CALENDAR_RANGE_OPTIONS.map((days) => (
          <SelectItem key={days} value={String(days)}>{days} дней</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DesktopFilters({ filters, roomTypeOptions, onFiltersChange }: CalendarToolbarProps) {
  return (
    <>
      <Select value={filters.roomTypeId} onValueChange={(roomTypeId) => onFiltersChange({ ...filters, roomTypeId })}>
        <SelectTrigger size="sm" className="w-[140px]"><SelectValue placeholder={t.filters.roomType} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t.filters.allTypes}</SelectItem>
          {roomTypeOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.channelId} onValueChange={(channelId) => onFiltersChange({ ...filters, channelId })}>
        <SelectTrigger size="sm" className="w-[150px]"><SelectValue placeholder={t.filters.channel} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t.filters.allChannels}</SelectItem>
          {CHANNEL_OPTIONS.map((channel) => <SelectItem key={channel} value={channel}>{channelLabel(channel)}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.statusId} onValueChange={(statusId) => onFiltersChange({ ...filters, statusId })}>
        <SelectTrigger size="sm" className="w-[150px]"><SelectValue placeholder={t.filters.status} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t.filters.allStatuses}</SelectItem>
          {STATUS_OPTIONS.map((status) => <SelectItem key={status} value={status}>{t.statuses.reservation[status]}</SelectItem>)}
        </SelectContent>
      </Select>
    </>
  );
}

function MobileFilters({
  filters,
  activeCount,
  roomTypeOptions,
  onApply,
}: {
  filters: CalendarFilters;
  activeCount: number;
  roomTypeOptions: Array<[string, string]>;
  onApply: (filters: CalendarFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setDraft(filters);
        setOpen(nextOpen);
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <ListFilter className="mr-1.5 size-4" /> Фильтры{activeCount ? ` · ${activeCount}` : ""}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>Фильтры календаря</SheetTitle>
          <SheetDescription>Ограничьте временную шкалу категорией, каналом или статусом.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4">
          <FilterField label="Категория номера">
            <Select value={draft.roomTypeId} onValueChange={(roomTypeId) => setDraft({ ...draft, roomTypeId })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.filters.allTypes}</SelectItem>
                {roomTypeOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Канал">
            <Select value={draft.channelId} onValueChange={(channelId) => setDraft({ ...draft, channelId })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.filters.allChannels}</SelectItem>
                {CHANNEL_OPTIONS.map((channel) => <SelectItem key={channel} value={channel}>{channelLabel(channel)}</SelectItem>)}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Статус">
            <Select value={draft.statusId} onValueChange={(statusId) => setDraft({ ...draft, statusId })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.filters.allStatuses}</SelectItem>
                {STATUS_OPTIONS.map((status) => <SelectItem key={status} value={status}>{t.statuses.reservation[status]}</SelectItem>)}
              </SelectContent>
            </Select>
          </FilterField>
        </div>
        <SheetFooter className="grid grid-cols-2">
          <Button variant="outline" onClick={() => setDraft(EMPTY_FILTERS)}>Сбросить</Button>
          <Button onClick={() => { onApply(draft); setOpen(false); }}>Применить</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
