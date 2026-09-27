"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PencilLine, Tag } from "lucide-react";
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
import { bulkUpdateRatesAction, createRatePlanAction } from "@/server/actions/rates";
import type { RatePlanVM } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { WEEKDAYS_SHORT } from "@/lib/dates";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCompactNightlyPrice, MAX_NIGHTLY_PRICE, MIN_NIGHTLY_PRICE } from "@/lib/pricing";
import { ratePlanDisplayId } from "@/lib/types";

export interface RatesBoardProps {
  plans: (RatePlanVM & { availableToday: number | null })[];
  dates: string[]; // ISO dates for columns
  dailyRates: Record<string, DailyRateVM[]>;
  roomTypes: { id: string; name: string }[];
}

export interface DailyRateVM {
  price: number | null;
  minStay: number;
  minStayType: "ARRIVAL" | "THROUGH";
  maxStay: number | null;
  stopSell: boolean;
  closedToArrival: boolean;
  closedToDeparture: boolean;
}

const DEFAULT_RESTRICTIONS: Omit<DailyRateVM, "price"> = {
  minStay: 1,
  minStayType: "ARRIVAL",
  maxStay: null,
  stopSell: false,
  closedToArrival: false,
  closedToDeparture: false,
};

export function RatesBoard({ plans, dates, dailyRates, roomTypes }: RatesBoardProps) {
  const router = useRouter();
  const [planForUpdate, setPlanForUpdate] = useState<RatePlanVM | null>(null);
  const [from, setFrom] = useState(dates[0] ?? "");
  const [to, setTo] = useState(dates[Math.min(6, dates.length - 1)] ?? "");
  const [price, setPrice] = useState("");
  const [minStay, setMinStay] = useState("1");
  const [minStayType, setMinStayType] = useState<"ARRIVAL" | "THROUGH">("ARRIVAL");
  const [maxStay, setMaxStay] = useState("");
  const [stopSell, setStopSell] = useState(false);
  const [closedToArrival, setClosedToArrival] = useState(false);
  const [closedToDeparture, setClosedToDeparture] = useState(false);
  const [weekendsOnly, setWeekendsOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newPlanRoomTypeId, setNewPlanRoomTypeId] = useState(roomTypes[0]?.id ?? "");
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanPrice, setNewPlanPrice] = useState("");
  const [newPlanRefundable, setNewPlanRefundable] = useState(true);
  const [newPlanBreakfast, setNewPlanBreakfast] = useState(false);
  const [creating, setCreating] = useState(false);

  function openRateEditor(plan: RatePlanVM, dateIndex = 0) {
    const rate = dailyRates[plan.id]?.[dateIndex];
    setPlanForUpdate(plan);
    setFrom(dates[dateIndex] ?? dates[0] ?? "");
    setTo(dates[Math.min(dateIndex + 6, dates.length - 1)] ?? dates[dateIndex] ?? "");
    setPrice(String(rate?.price ?? plan.basePrice));
    setMinStay(String(rate?.minStay ?? DEFAULT_RESTRICTIONS.minStay));
    setMinStayType(rate?.minStayType ?? DEFAULT_RESTRICTIONS.minStayType);
    setMaxStay(rate?.maxStay ? String(rate.maxStay) : "");
    setStopSell(rate?.stopSell ?? false);
    setClosedToArrival(rate?.closedToArrival ?? false);
    setClosedToDeparture(rate?.closedToDeparture ?? false);
    setWeekendsOnly(false);
  }

  async function saveBulk() {
    if (!planForUpdate) return;
    setSaving(true);
    try {
      const result = await bulkUpdateRatesAction({
        ratePlanId: planForUpdate.id,
        from,
        to,
        price: Number(price),
        minStay: Number(minStay),
        minStayType,
        maxStay: maxStay ? Number(maxStay) : null,
        stopSell,
        closedToArrival,
        closedToDeparture,
        weekendsOnly,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setPlanForUpdate(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleCreatePlan() {
    if (!newPlanRoomTypeId || !newPlanName.trim() || !newPlanPrice) {
      toast.error("Заполните все поля");
      return;
    }
    setCreating(true);
    try {
      const result = await createRatePlanAction({
        roomTypeId: newPlanRoomTypeId,
        name: newPlanName.trim(),
        basePrice: Number(newPlanPrice),
        refundable: newPlanRefundable,
        breakfastIncluded: newPlanBreakfast,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setCreateOpen(false);
      setNewPlanName("");
      setNewPlanPrice("");
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  if (plans.length === 0) {
    return (
      <>
        <EmptyState
          icon={Tag}
          title={t.rates.emptyTitle}
          description={t.rates.emptyDescription}
          action={
            <Button onClick={() => setCreateOpen(true)} disabled={roomTypes.length === 0}>
              <Tag className="mr-2 size-4" /> Создать тариф
            </Button>
          }
        />
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Новый тариф</DialogTitle>
              <DialogDescription>Создайте тариф для типа размещения. Базовая цена будет использоваться по умолчанию при бронировании.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Тип размещения</Label>
                <Select value={newPlanRoomTypeId} onValueChange={setNewPlanRoomTypeId}>
                  <SelectTrigger><SelectValue placeholder="Выберите категорию" /></SelectTrigger>
                  <SelectContent>{roomTypes.map((rt) => <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Название тарифа</Label><Input value={newPlanName} onChange={(e) => setNewPlanName(e.target.value)} placeholder="Например, Базовый" /></div>
              <div className="space-y-1.5"><Label>Базовая цена за ночь</Label><Input type="number" min={MIN_NIGHTLY_PRICE} max={MAX_NIGHTLY_PRICE} step="500" value={newPlanPrice} onChange={(e) => setNewPlanPrice(e.target.value)} placeholder="35000" /><p className="text-xs text-muted-foreground">От 1 000 до 999 000 ₸</p></div>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={newPlanRefundable} onCheckedChange={(v) => setNewPlanRefundable(v === true)} /> Возвратный</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={newPlanBreakfast} onCheckedChange={(v) => setNewPlanBreakfast(v === true)} /> Завтрак включен</label>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Отмена</Button><Button onClick={handleCreatePlan} disabled={creating}>{creating ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Создать</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreateOpen(true)} variant="outline" size="sm" disabled={roomTypes.length === 0}>
          <Tag className="mr-2 size-4" /> Создать тариф
        </Button>
      </div>
      <div className="space-y-2 sm:hidden">
        {plans.map((plan) => {
          const rate = dailyRates[plan.id]?.[0];
          return (
            <div key={plan.id} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{plan.name}</p>
                <p className="truncate text-xs text-muted-foreground">{plan.roomTypeName}{plan.availableToday !== null ? ` · ${plan.availableToday} свободно` : ""}</p>
                {rate && (rate.stopSell || rate.closedToArrival || rate.closedToDeparture || rate.minStay > 1 || rate.maxStay) ? (
                  <p className="mt-1 text-[11px] text-amber-700">Есть ограничения на сегодня</p>
                ) : null}
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">{formatCompactNightlyPrice(rate?.price ?? plan.basePrice)}</p>
                <p className="text-[10px] text-muted-foreground">за ночь</p>
              </div>
              <Button variant="ghost" size="icon" aria-label={t.rates.editPricesAria(plan.name)} onClick={() => openRateEditor(plan)}>
                <PencilLine className="size-4" />
              </Button>
            </div>
          );
        })}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border bg-card shadow-sm sm:block">
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
                      <div className="font-mono text-[11px] text-muted-foreground">Тариф {ratePlanDisplayId(plan.sequenceNumber)}</div>
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
                      onClick={() => openRateEditor(plan)}
                    >
                      <PencilLine className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
                {(dailyRates[plan.id] ?? []).map((rate, i) => (
                  <TableCell key={`${plan.id}-${dates[i]}`} className="text-center tabular-nums">
                    {rate.price === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Badge
                        variant="outline"
                        className={
                          rate.price > plan.basePrice
                            ? "border-transparent bg-orange-50 font-medium text-orange-700"
                            : "border-transparent bg-emerald-50 font-medium text-emerald-700"
                        }
                      >
                        {formatCompactNightlyPrice(rate.price)}
                      </Badge>
                    )}
                    <div className="mt-1 flex min-h-4 flex-wrap justify-center gap-0.5 text-[9px] font-medium">
                      {rate.minStay > 1 ? <span className="text-sky-700">мин {rate.minStay}</span> : null}
                      {rate.maxStay ? <span className="text-violet-700">макс {rate.maxStay}</span> : null}
                      {rate.stopSell ? <span className="text-destructive">закрыто</span> : null}
                      {rate.closedToArrival ? <span className="text-amber-700">без заезда</span> : null}
                      {rate.closedToDeparture ? <span className="text-amber-700">без выезда</span> : null}
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Bulk update dialog */}
      <Dialog open={Boolean(planForUpdate)} onOpenChange={(o) => !o && setPlanForUpdate(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
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
              min={MIN_NIGHTLY_PRICE}
              max={MAX_NIGHTLY_PRICE}
              step={500}
              placeholder="25000"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">От 1 000 до 999 000 ₸</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bulk-min-stay">Минимум ночей</Label>
              <Input
                id="bulk-min-stay"
                type="number"
                min={1}
                max={730}
                value={minStay}
                onChange={(event) => setMinStay(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-max-stay">Максимум ночей</Label>
              <Input
                id="bulk-max-stay"
                type="number"
                min={1}
                max={730}
                placeholder="Без ограничения"
                value={maxStay}
                onChange={(event) => setMaxStay(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Как применять минимум</Label>
            <Select value={minStayType} onValueChange={(value) => setMinStayType(value as "ARRIVAL" | "THROUGH")}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ARRIVAL">По дате заезда</SelectItem>
                <SelectItem value="THROUGH">На весь период проживания</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              «По дате заезда» проверяет только день прибытия, «на весь период» — каждую ночь проживания.
            </p>
          </div>
          <div className="space-y-2 rounded-lg border p-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={stopSell} onCheckedChange={(value) => setStopSell(value === true)} />
              Закрыть продажи
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={closedToArrival} onCheckedChange={(value) => setClosedToArrival(value === true)} />
              Запретить заезд
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={closedToDeparture} onCheckedChange={(value) => setClosedToDeparture(value === true)} />
              Запретить выезд
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={weekendsOnly} onCheckedChange={(v) => setWeekendsOnly(v === true)} />
            {t.rates.bulkDialog.weekendsOnly}
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanForUpdate(null)}>
              {t.common.cancel}
            </Button>
            <Button onClick={saveBulk} disabled={saving || !price || !minStay || !from || !to}>
              {t.rates.bulkDialog.apply}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Новый тариф</DialogTitle>
            <DialogDescription>Создайте тариф для типа размещения. Базовая цена будет использоваться по умолчанию при бронировании.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Тип размещения</Label>
              <Select value={newPlanRoomTypeId} onValueChange={setNewPlanRoomTypeId}>
                <SelectTrigger><SelectValue placeholder="Выберите категорию" /></SelectTrigger>
                <SelectContent>{roomTypes.map((rt) => <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Название тарифа</Label><Input value={newPlanName} onChange={(e) => setNewPlanName(e.target.value)} placeholder="Например, Базовый" /></div>
            <div className="space-y-1.5"><Label>Базовая цена за ночь</Label><Input type="number" min={MIN_NIGHTLY_PRICE} max={MAX_NIGHTLY_PRICE} step="500" value={newPlanPrice} onChange={(e) => setNewPlanPrice(e.target.value)} placeholder="35000" /><p className="text-xs text-muted-foreground">От 1 000 до 999 000 ₸</p></div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={newPlanRefundable} onCheckedChange={(v) => setNewPlanRefundable(v === true)} /> Возвратный</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={newPlanBreakfast} onCheckedChange={(v) => setNewPlanBreakfast(v === true)} /> Завтрак включен</label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Отмена</Button><Button onClick={handleCreatePlan} disabled={creating}>{creating ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Создать</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
