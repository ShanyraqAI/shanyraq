import { BarChart3, CalendarCheck2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatShortDate, weekdayShort } from "@/lib/dates";
import type { DashboardDayPoint } from "@/lib/stats";
import { cn } from "@/lib/utils";

export function OccupancyChart({ points }: { points: DashboardDayPoint[] }) {
  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className="flex-row items-center justify-between border-b pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="size-4 text-primary" /> Загрузка номеров</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Фактическая загрузка за последние 14 дней</p>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">14 дней</span>
      </CardHeader>
      <CardContent className="pt-5">
        {points.some((point) => point.total > 0) ? (
          <div className="flex h-44 items-end gap-1.5 sm:gap-2" aria-label="График загрузки номеров">
            {points.map((point, index) => {
              const percent = Math.round(point.value * 100);
              return (
                <div key={point.date.toISOString()} className="group flex h-full min-w-0 flex-1 flex-col justify-end">
                  <div className="relative flex flex-1 items-end rounded-md bg-secondary/55">
                    <div
                      className={cn("w-full rounded-md bg-primary/30 transition-colors group-hover:bg-primary/45", index === points.length - 1 && "bg-primary/80 group-hover:bg-primary")}
                      style={{ height: `${Math.max(percent, point.count ? 7 : 2)}%` }}
                    />
                    <div className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[10px] text-background shadow-lg group-hover:block">
                      {percent}% · {point.count} из {point.total}
                    </div>
                  </div>
                  <span className={cn("mt-2 truncate text-center text-[10px] text-muted-foreground", index === points.length - 1 && "font-semibold text-foreground")}>
                    {point.date.getUTCDate()}
                  </span>
                </div>
              );
            })}
          </div>
        ) : <ChartEmpty text="Добавьте номера, чтобы видеть загрузку по дням." />}
      </CardContent>
    </Card>
  );
}

export function BookingChart({ points }: { points: DashboardDayPoint[] }) {
  const max = Math.max(1, ...points.map((point) => point.count));
  const total = points.reduce((sum, point) => sum + point.count, 0);
  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className="flex-row items-center justify-between border-b pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><CalendarCheck2 className="size-4 text-primary" /> Новые бронирования</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Создано за последние 14 дней</p>
        </div>
        <span className="text-2xl font-semibold tabular-nums">{total}</span>
      </CardHeader>
      <CardContent className="pt-5">
        {total > 0 ? (
          <div className="flex h-44 items-end gap-1.5 sm:gap-2" aria-label="График новых бронирований">
            {points.map((point, index) => (
              <div key={point.date.toISOString()} className="group flex h-full min-w-0 flex-1 flex-col justify-end">
                <div className="relative flex flex-1 items-end rounded-md bg-secondary/45">
                  <div className={cn("w-full rounded-md bg-chart-2/55 transition-colors group-hover:bg-chart-2/75", index === points.length - 1 && "bg-chart-2")} style={{ height: `${Math.max((point.count / max) * 100, point.count ? 8 : 2)}%` }} />
                  <div className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[10px] text-background shadow-lg group-hover:block">
                    {formatShortDate(point.date)} · {point.count}
                  </div>
                </div>
                <span className={cn("mt-2 truncate text-center text-[10px] text-muted-foreground", index === points.length - 1 && "font-semibold text-foreground")}>{point.date.getUTCDate()}</span>
              </div>
            ))}
          </div>
        ) : <ChartEmpty text="За этот период новых бронирований пока нет." />}
      </CardContent>
    </Card>
  );
}

export function OccupancyForecast({ points }: { points: DashboardDayPoint[] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-base">Прогноз на 7 дней</CardTitle>
        <p className="text-xs text-muted-foreground">На основе подтверждённых и активных броней</p>
      </CardHeader>
      <CardContent className="space-y-3 pt-5">
        {points.map((point) => {
          const percent = Math.round(point.value * 100);
          return (
            <div key={point.date.toISOString()} className="grid grid-cols-[76px_1fr_42px] items-center gap-3 text-xs">
              <span className="text-muted-foreground">{weekdayShort(point.date)}, {formatShortDate(point.date)}</span>
              <div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary/75" style={{ width: `${percent}%` }} /></div>
              <span className="text-right font-medium tabular-nums">{percent}%</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ChartEmpty({ text }: { text: string }) {
  return <div className="flex h-44 items-center justify-center rounded-lg border border-dashed bg-secondary/25 px-6 text-center text-sm text-muted-foreground">{text}</div>;
}
