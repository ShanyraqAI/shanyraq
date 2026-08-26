"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PencilLine, Tag } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/shared/page-header";
import { bulkUpdateRatesAction } from "@/server/actions/rates";
import type { RatePlanVM } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { WEEKDAYS_SHORT } from "@/lib/dates";

export interface RatesBoardProps {
  plans: (RatePlanVM & { availableToday: number | null })[];
  dates: string[]; // ISO dates for columns
  prices: Record<string, (number | null)[]>; // planId → price per date
}

export function RatesBoard({ plans, dates, prices }: RatesBoardProps) {
  const router = useRouter();
  const [planForUpdate, setPlanForUpdate] = useState<RatePlanVM | null>(null);
  const [from, setFrom] = useState(dates[0] ?? "");
  const [to, setTo] = useState(dates[Math.min(6, dates.length - 1)] ?? "");
  const [price, setPrice] = useState("");
  const [weekendsOnly, setWeekendsOnly] = useState(false);
  const [saving, setSaving] = useState(false);

  async function saveBulk() {
    if (!planForUpdate) return;
    setSaving(true);
    try {
      const result = await bulkUpdateRatesAction({
        ratePlanId: planForUpdate.id,
        from,
        to,
        price: Number(price),
        weekendsOnly,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setPlanForUpdate(null);
      setPrice("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (plans.length === 0) {
    return <EmptyState icon={Tag} title={t.rates.emptyTitle} description={t.rates.emptyDescription} />;
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50 hover:bg-secondary/50">
              <TableHead className="sticky left-0 z-10 min-w-[220px] bg-secondary/95">{t.rates.planColumn}</TableHead>
              {dates.map((d) => {
                const date = new Date(`${d}T00:00:00Z`);
                const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
                return (
                  <TableHead key={d} className="min-w-[76px] text-center tabular-nums">
                    <div className="text-[11px] font-normal text-muted-foreground">{d.slice(8)}.{d.slice(5, 7)}</div>
                    <div className={weekend ? "text-primary" : ""}>
                      {WEEKDAYS_SHORT[(date.getUTCDay() + 6) % 7]}
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell className="sticky left-0 z-10 bg-card">
                  <div className="flex items-center justify-between gap-2">
                    <div className="leading-tight">
                      <div className="font-medium">{plan.name}</div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {plan.roomTypeName}
                        {plan.breakfastIncluded ? t.rates.meta.breakfast : ""}
                        {!plan.refundable ? t.rates.meta.nonRefundable : ""}
                        {plan.availableToday !== null ? t.rates.meta.avail(plan.availableToday) : ""}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      aria-label={t.rates.editPricesAria(plan.name)}
                      onClick={() => {
                        setPlanForUpdate(plan);
                        setFrom(dates[0]);
                        setTo(dates[Math.min(6, dates.length - 1)]);
                      }}
                    >
                      <PencilLine className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
                {(prices[plan.id] ?? []).map((p, i) => (
                  <TableCell key={`${plan.id}-${dates[i]}`} className="text-center tabular-nums">
                    {p === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Badge
                        variant="outline"
                        className={
                          p > plan.basePrice
                            ? "border-transparent bg-orange-50 font-medium text-orange-700"
                            : "border-transparent bg-emerald-50 font-medium text-emerald-700"
                        }
                      >
                        {Math.round(p / 1000)}k
                      </Badge>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Bulk update dialog */}
      <Dialog open={Boolean(planForUpdate)} onOpenChange={(o) => !o && setPlanForUpdate(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.rates.bulkDialog.title}</DialogTitle>
            <DialogDescription>
              {planForUpdate ? t.rates.bulkDialog.description(planForUpdate.name) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bulk-from">{t.rates.bulkDialog.from}</Label>
              <Input id="bulk-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-to">{t.rates.bulkDialog.to}</Label>
              <Input id="bulk-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bulk-price">
              {t.rates.bulkDialog.priceLabel(formatMoney(Number(price) || 0))}
            </Label>
            <Input
              id="bulk-price"
              type="number"
              min={1000}
              step={500}
              placeholder="25000"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={weekendsOnly} onCheckedChange={(v) => setWeekendsOnly(v === true)} />
            {t.rates.bulkDialog.weekendsOnly}
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanForUpdate(null)}>
              {t.common.cancel}
            </Button>
            <Button onClick={saveBulk} disabled={saving || !price || !from || !to}>
              {t.rates.bulkDialog.apply}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
