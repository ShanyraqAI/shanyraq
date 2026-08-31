"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function BillingBanner({ endsAt, paid, initiallyExpired }: { endsAt: string; paid: boolean; initiallyExpired: boolean }) {
  const [expired, setExpired] = useState(initiallyExpired);
  useEffect(() => {
    const update = () => setExpired(Date.now() >= new Date(endsAt).getTime());
    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, [endsAt]);
  const deadline = new Intl.DateTimeFormat("ru-KZ", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Almaty" }).format(new Date(endsAt));
  return <aside role="status" className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm ${expired ? "border-amber-200 bg-amber-50 text-amber-900" : "bg-accent text-accent-foreground"}`}>
    <div><p className="font-medium">{expired ? "Период доступа завершён" : paid ? "Подписка активна" : "Бесплатный период — карта не нужна"}</p>
      <p className="mt-1">{expired ? "Просмотр данных и синхронизация подключённых каналов доступны. Для сохранения изменений оплатите подписку." : `Доступ до ${deadline} (время Казахстана). Автоматических списаний нет.`}</p></div>
    <Link href="/dashboard/billing" className="shrink-0 font-medium underline underline-offset-4">{expired ? "Оплатить доступ" : "Подписка и оплата"}</Link>
  </aside>;
}
