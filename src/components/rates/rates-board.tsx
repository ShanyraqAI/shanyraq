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
  prices: Record<string, (number | null)[]>; // planId → price per date
  roomTypes: { id: string; name: string }[];
}

export function RatesBoard({ plans, dates, prices, roomTypes }: RatesBoardProps) {
  const router = useRouter();
  const [planForUpdate, setPlanForUpdate] = useState<RatePlanVM | null>(null);
  const [from, setFrom] = useState(dates[0] ?? "");
  const [to, setTo] = useState(dates[Math.min(6, dates.length - 1)] ?? "");
  const [price, setPrice] = useState("");
  const [weekendsOnly, setWeekendsOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newPlanRoomTypeId, setNewPlanRoomTypeId] = useState(roomTypes[0]?.id ?? "");
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanPrice, setNewPlanPrice] = useState("");
  const [newPlanRefundable, setNewPlanRefundable] = useState(true);
  const [newPlanBreakfast, setNewPlanBreakfast] = useState(false);
  const [creating, setCreating] = useState(false);

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
              <DialogDescription>Создайте тариф для категории номера. Базовая цена будет использоваться по умолчанию при бронировании.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Категория номера</Label>
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
                        {formatCompactNightlyPrice(p)}
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
              min={MIN_NIGHTLY_PRICE}
              max={MAX_NIGHTLY_PRICE}
              step={500}
              placeholder="25000"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">От 1 000 до 999 000 ₸</p>
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
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Новый тариф</DialogTitle>
            <DialogDescription>Создайте тариф для категории номера. Базовая цена будет использоваться по умолчанию при бронировании.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Категория номера</Label>
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
