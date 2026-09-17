import { Activity, CalendarCheck2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InteractiveTrendChart } from "@/components/charts/interactive-trend-chart";
import { formatShortDate, weekdayShort } from "@/lib/dates";
import type { DashboardDayPoint } from "@/lib/stats";

export function OccupancyChart({ points }: { points: DashboardDayPoint[] }) {
  const values = points.map((point) => Math.round(point.value * 100));
  const average = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  return (
    <TrendCard
      icon={Activity}
      title="Загрузка номеров"
      description="Фактическая загрузка за последние 14 дней"
      stat={`${average}%`}
      statLabel="в среднем"
      points={points}
      values={values}
      maxValue={Math.max(20, ...values)}
      stroke="var(--primary)"
      ariaLabel="Динамика загрузки номеров за последние 14 дней"
      formatValue={(value, point) => `${value}% · ${point.count} из ${point.total}`}
    />
  );
}

export function BookingChart({ points }: { points: DashboardDayPoint[] }) {
  const values = points.map((point) => point.count);
  const total = values.reduce((sum, value) => sum + value, 0);
  return (
    <TrendCard
      icon={CalendarCheck2}
      title="Новые бронирования"
      description="Создано за последние 14 дней"
      stat={String(total)}
      statLabel="за период"
      points={points}
      values={values}
      maxValue={Math.max(1, ...values)}
      stroke="var(--chart-1)"
      ariaLabel="Динамика новых бронирований за последние 14 дней"
      formatValue={(value) => `${value} новых броней`}
    />
  );
}

function TrendCard({
  icon: Icon,
  title,
  description,
  stat,
  statLabel,
  points,
  values,
  maxValue,
  stroke,
  ariaLabel,
  formatValue,
}: {
  icon: typeof Activity;
  title: string;
  description: string;
  stat: string;
  statLabel: string;
  points: DashboardDayPoint[];
  values: number[];
  maxValue: number;
  stroke: string;
  ariaLabel: string;
  formatValue: (value: number, point: DashboardDayPoint) => string;
}) {
  const chartPoints = points.map((point, index) => ({
    key: point.date.toISOString(),
    label: formatShortDate(point.date),
    value: values[index],
    valueLabel: formatValue(values[index], point),
  }));

  return (
    <Card className="overflow-hidden bg-gradient-to-b from-card to-secondary/10 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Icon className="size-4 text-primary" /> {title}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="text-right"><div className="text-2xl font-semibold tabular-nums">{stat}</div><div className="text-[10px] text-muted-foreground">{statLabel}</div></div>
      </CardHeader>
      <CardContent className="pt-5">
        <InteractiveTrendChart points={chartPoints} maxValue={maxValue} stroke={stroke} ariaLabel={ariaLabel} />
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
