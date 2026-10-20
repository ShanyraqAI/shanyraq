"use client";

import Link from "next/link";
import { PRODUCT_AVAILABILITY } from "@/lib/product-availability";
import { whatsappRenewUrl } from "@/lib/subscription/access";
import { useEffect, useState } from "react";

export function BillingBanner({ endsAt, paid, manual = false, unrestricted = false, initiallyExpired }: { endsAt: string; paid: boolean; manual?: boolean; unrestricted?: boolean; initiallyExpired: boolean }) {
  const [expired, setExpired] = useState(initiallyExpired);
  useEffect(() => {
    const update = () => setExpired(Date.now() >= new Date(endsAt).getTime());
    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, [endsAt]);
  const deadline = new Intl.DateTimeFormat("ru-KZ", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Almaty" }).format(new Date(endsAt));
  return <aside role="status" className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm ${expired ? "border-amber-200 bg-amber-50 text-amber-900" : "bg-accent text-accent-foreground"}`}>
    <div><p className="font-medium">{expired ? unrestricted ? "Срок ручного гранта завершён" : "Период доступа завершён" : manual ? "Ручной доступ активен" : paid ? "Подписка активна" : "Бесплатный период — карта не нужна"}</p>
      <p className="mt-1">{expired ? unrestricted ? "Текущий доступ сохранён: ограничения оплаты пока не включены." : "Просмотр данных и синхронизация подключённых каналов доступны. Для сохранения изменений оплатите подписку." : `Доступ до ${deadline} (время Казахстана). Автоматических списаний нет.`}</p></div>
    <Link href={PRODUCT_AVAILABILITY.billing ? "/dashboard/billing" : whatsappRenewUrl()} className="shrink-0 font-medium underline underline-offset-4">{PRODUCT_AVAILABILITY.billing ? expired ? "Оплатить доступ" : "Подписка и оплата" : "Обратиться в поддержку"}</Link>
  </aside>;
}
