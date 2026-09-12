"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgePercent, BedDouble, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, LayoutDashboard, LifeBuoy, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { markProductTourAction } from "@/server/actions/product-experience";
import type { HotelPermission } from "@/lib/access";

const FULL_TOUR = [
  { id: "overview", title: "Обзор", location: "Первый пункт меню", description: "Здесь собраны занятость, ближайшие заезды и выезды, выручка и последние бронирования.", icon: LayoutDashboard },
  { id: "calendar", title: "Календарь", location: "Второй пункт меню", description: "Главный рабочий экран: смотрите загрузку по номерам, меняйте диапазон дат и открывайте бронь одним нажатием.", icon: CalendarDays },
  { id: "reservations", title: "Бронирования", location: "Раздел под календарём", description: "Полный список броней с поиском, статусами, редактированием и импортом из таблицы.", icon: ClipboardList },
  { id: "rooms", title: "Номера", location: "Раздел управления объектом", description: "Добавляйте номера и квартиры, назначайте тип, вместимость, базовую цену и текущий статус.", icon: BedDouble },
  { id: "guests", title: "Гости", location: "Рядом с разделом номеров", description: "Контакты и история гостей остаются привязаны только к вашему отелю.", icon: Users },
  { id: "rates", title: "Тарифы", location: "Последний пункт основного меню", description: "Настраивайте базовые тарифы и цены по датам. Изменения сразу используются в новых бронированиях.", icon: BadgePercent },
  { id: "help", title: "Помощь", location: "Внизу бокового меню", description: "Если что-то непонятно или не работает, напишите прямо из приложения — обращение увидит суперадминистратор.", icon: LifeBuoy },
] as const;

const TOUR_PERMISSION: Partial<Record<(typeof FULL_TOUR)[number]["id"], HotelPermission>> = {
  overview: "OVERVIEW",
  calendar: "CALENDAR",
  reservations: "RESERVATIONS",
  rooms: "ROOMS",
  guests: "GUESTS",
  rates: "RATES",
};

export function ProductTour({ permissions }: { permissions: HotelPermission[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const [pending, startTransition] = useTransition();
  const steps = FULL_TOUR.filter((item) => {
    const permission = TOUR_PERMISSION[item.id];
    return !permission || permissions.includes(permission);
  });
  const step = steps[stepIndex] ?? steps[0];

  function finish(outcome: "completed" | "skipped") {
    if (pending) return;
    startTransition(async () => {
      const result = await markProductTourAction(outcome);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) finish("skipped"); }}>
      <DialogContent className="overflow-hidden border-0 p-0 sm:max-w-3xl" showCloseButton={false}>
        <div className="grid min-h-[430px] md:grid-cols-[220px_1fr]">
          <aside className="hidden bg-primary p-5 text-primary-foreground md:block">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/65">Быстрый тур</p>
            <div className="mt-5 space-y-1.5">
              {steps.map((item, index) => (
                <div key={item.id} className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors", index === stepIndex ? "bg-white/15 font-medium" : "text-primary-foreground/60")}>
                  <item.icon className="size-4" />
                  {item.title}
                </div>
              ))}
            </div>
          </aside>
          <div className="flex min-w-0 flex-col p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Знакомство с Shanyraq</span>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{stepIndex + 1} / {steps.length}</span>
            </div>
            <div key={step.id} className="flex flex-1 animate-in flex-col justify-center fade-in slide-in-from-right-2 duration-300">
              <div className="mb-5 grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
                <step.icon className="size-8" />
              </div>
              <DialogHeader className="text-left">
                <DialogTitle className="text-2xl">{step.title}</DialogTitle>
                <DialogDescription className="max-w-xl text-base leading-7">{step.description}</DialogDescription>
              </DialogHeader>
              <div className="mt-6 rounded-xl border bg-muted/35 p-4 text-sm">
                <span className="font-medium">Где найти:</span> <span className="text-muted-foreground">{step.location}</span>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
              <Button variant="ghost" onClick={() => finish("skipped")} disabled={pending}>Пропустить тур</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStepIndex((value) => Math.max(0, value - 1))} disabled={stepIndex === 0 || pending} aria-label="Предыдущая подсказка"><ChevronLeft className="size-4" /></Button>
                <Button onClick={() => stepIndex === steps.length - 1 ? finish("completed") : setStepIndex((value) => value + 1)} disabled={pending}>
                  {stepIndex === steps.length - 1 ? "Начать работу" : "Далее"}
                  {stepIndex === steps.length - 1 ? null : <ChevronRight className="size-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
