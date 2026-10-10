"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BILLING_PLANS } from "@/lib/billing/policy";
import { GRANT_MONTHS } from "@/lib/subscription/access";
import { endSubscriptionAction, grantSubscriptionAction } from "@/server/actions/superadmin-subscriptions";
import { Button } from "@/components/ui/button";

const selectClass = "h-9 rounded-md border border-white/15 bg-slate-900 px-2 text-sm text-slate-100";

export function GrantSubscriptionForm({ organizationId, defaultPlan, canEnd }: { organizationId: string; defaultPlan: string | null; canEnd: boolean }) {
  const router = useRouter();
  const [planId, setPlanId] = useState(defaultPlan ?? BILLING_PLANS[0].id);
  const [months, setMonths] = useState<number>(1);
  const [pending, startTransition] = useTransition();

  function run(action: () => ReturnType<typeof grantSubscriptionAction>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return void toast.error(result.error ?? "Не удалось сохранить");
      toast.success(result.message ?? "Готово");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Тариф" className={selectClass} value={planId} onChange={(event) => setPlanId(event.target.value)}>
        {BILLING_PLANS.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
      </select>
      <select aria-label="Срок" className={selectClass} value={months} onChange={(event) => setMonths(Number(event.target.value))}>
        {GRANT_MONTHS.map((value) => <option key={value} value={value}>{value} мес.</option>)}
      </select>
      <Button type="button" size="sm" disabled={pending} onClick={() => run(() => grantSubscriptionAction({ organizationId, planId, months }))}>Выдать / продлить</Button>
      {canEnd ? <Button type="button" size="sm" variant="ghost" className="text-red-300 hover:text-red-200" disabled={pending} onClick={() => { if (confirm("Завершить подписку сейчас?")) run(() => endSubscriptionAction({ organizationId })); }}>Завершить</Button> : null}
    </div>
  );
}
