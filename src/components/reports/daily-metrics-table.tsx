"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface DailyMetricRow {
  key: string;
  date: string;
  occupied: string;
  occupancy: string;
  revenue: string;
  adr: string;
  revpar: string;
}

export function DailyMetricsTable({ rows }: { rows: DailyMetricRow[] }) {
  const [basePeriod, setBasePeriod] = useState<7 | 14>(7);
  const [visibleCount, setVisibleCount] = useState(7);
  const visibleRows = rows.slice(0, visibleCount);

  function selectPeriod(period: 7 | 14) {
    setBasePeriod(period);
    setVisibleCount(period);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-primary/15 bg-primary/[0.05] p-1" aria-label="Количество дней в таблице">
          {([7, 14] as const).map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => selectPeriod(period)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${basePeriod === period ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-card/70 hover:text-foreground"}`}
            >
              {period} дней
            </button>
          ))}
        </div>
        <span className="rounded-full bg-secondary/70 px-3 py-1 text-xs text-muted-foreground">Показано {visibleRows.length} из {rows.length}</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-primary/10 bg-card/75">
        <Table>
          <TableHeader><TableRow className="bg-primary/[0.035] hover:bg-primary/[0.035]"><TableHead>Дата</TableHead><TableHead className="text-right">Занято</TableHead><TableHead className="text-right">Загрузка</TableHead><TableHead className="text-right">Выручка</TableHead><TableHead className="text-right">ADR</TableHead><TableHead className="text-right">RevPAR</TableHead></TableRow></TableHeader>
          <TableBody>{visibleRows.map((row) => (
            <TableRow key={row.key}><TableCell className="font-medium">{row.date}</TableCell><TableCell className="text-right tabular-nums">{row.occupied}</TableCell><TableCell className="text-right tabular-nums">{row.occupancy}</TableCell><TableCell className="text-right tabular-nums">{row.revenue}</TableCell><TableCell className="text-right tabular-nums">{row.adr}</TableCell><TableCell className="text-right tabular-nums">{row.revpar}</TableCell></TableRow>
          ))}</TableBody>
        </Table>
      </div>

      {visibleCount < rows.length ? (
        <div className="flex justify-center pt-4">
          <Button type="button" variant="outline" size="sm" className="border-primary/20 text-primary hover:bg-primary/5 hover:text-primary" onClick={() => setVisibleCount((count) => Math.min(rows.length, count + 14))}>Показать ещё 14 дней</Button>
        </div>
      ) : null}
    </>
  );
}
