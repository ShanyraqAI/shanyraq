"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BILLING_PLANS } from "@/lib/billing/policy";
import { checkPaymentAction, createCheckoutAction } from "@/server/actions/billing";

export function BillingCheckout({ enabled, testMode, roomCount, currentPlan }: { enabled: boolean; testMode: boolean; roomCount: number; currentPlan: string | null }) {
  const [planId, setPlanId] = useState(currentPlan ?? BILLING_PLANS.find((plan) => plan.rooms >= roomCount)?.id ?? "business");
  const [months, setMonths] = useState(1);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const plan = BILLING_PLANS.find((item) => item.id === planId)!;
  const amount = new Intl.NumberFormat("ru-KZ").format(plan.monthlyKzt * (months === 12 ? 10 : 1));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !enabled) return;
    setBusy(true);
    try {
      const result = await createCheckoutAction({ planId, months, consent });
      if (!result.ok) { toast.error(result.error); return; }
      window.location.assign(result.url);
    } catch {
      toast.error("Не удалось открыть оплату. Обновите страницу и попробуйте снова.");
    } finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="space-y-5 rounded-xl border bg-card p-6">
    <div><h2 className="font-semibold">Оплатить доступ</h2><p className="mt-1 text-sm text-muted-foreground">Один тариф для всей организации. Сейчас номеров: {roomCount}.</p></div>
    {testMode && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Тестовый режим Freedom Pay. Тестовая оплата не продлевает реальный доступ.</p>}
    <fieldset disabled={busy || !enabled} className="space-y-4 disabled:opacity-60">
      <legend className="sr-only">Тариф и период</legend>
      <div className="grid gap-3 sm:grid-cols-3">{BILLING_PLANS.map((item) => <label key={item.id} className={`cursor-pointer rounded-lg border p-4 ${planId === item.id ? "border-primary bg-accent" : "bg-background"}`}>
        <input type="radio" name="billing-plan" value={item.id} checked={planId === item.id} onChange={() => { setPlanId(item.id); setConsent(false); }} disabled={item.rooms < roomCount || Boolean(currentPlan && currentPlan !== item.id)} className="mr-2 accent-primary" />
        <span className="font-medium">{item.name}</span><span className="mt-2 block text-sm text-muted-foreground">До {item.rooms} номеров</span>
        <span className="mt-1 block text-sm">{new Intl.NumberFormat("ru-KZ").format(item.monthlyKzt)} ₸ / месяц</span>
      </label>)}</div>
      <label className="block space-y-2 text-sm"><span>Период оплаты</span><select className="h-10 w-full rounded-md border bg-background px-3" value={months} onChange={(event) => { setMonths(Number(event.target.value)); setConsent(false); }}>
        <option value={1}>Месяц</option><option value={12}>Год — по цене 10 месяцев</option>
      </select></label>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required className="mt-1 accent-primary" />
        <span>Подтверждаю разовую оплату {amount} ₸ за {months === 12 ? "год" : "месяц"} доступа по тарифу {plan.name}. Автоматических списаний и привязки карты нет.</span>
      </label>
      <Button type="submit" disabled={!consent || roomCount > plan.rooms} className="w-full sm:w-auto">{busy && <Loader2 className="mr-2 size-4 animate-spin" />}{testMode ? "Открыть тестовую оплату" : `Оплатить ${amount} ₸`}</Button>
    </fieldset>
    <p className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 shrink-0" />Карта вводится только на защищённой странице Freedom Pay. Доступ продлевается после подтверждения платежа; оставшиеся бесплатные дни сохраняются.</p>
  </form>;
}

export function PaymentStatusCheck({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function check() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await checkPaymentAction(paymentId);
      if (result.ok) { toast.success(result.message); router.refresh(); }
      else toast.error(result.error);
    } catch { toast.error("Не удалось проверить платёж. Попробуйте позже."); }
    finally { setBusy(false); }
  }
  return <Button type="button" variant="outline" size="sm" onClick={check} disabled={busy}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Проверить оплату</Button>;
}
