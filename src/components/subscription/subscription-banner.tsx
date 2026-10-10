import { MessageCircle } from "lucide-react";
import { daysLeft, WHATSAPP_DISPLAY, whatsappRenewUrl, type SubscriptionStatus } from "@/lib/subscription/access";

const dateFormat = new Intl.DateTimeFormat("ru-KZ", { dateStyle: "long", timeZone: "Asia/Almaty" });

export function SubscriptionBanner({ status, endsAt, organizationName }: { status: SubscriptionStatus; endsAt: Date; organizationName: string }) {
  if (status !== "EXPIRING" && status !== "EXPIRED") return null;
  const expired = status === "EXPIRED";
  const left = daysLeft(endsAt);
  return (
    <aside role="status" className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm ${expired ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
      <div>
        <p className="font-medium">{expired ? "Подписка закончилась" : `Подписка заканчивается через ${left} дн.`}</p>
        <p className="mt-1">{expired ? `Срок истёк ${dateFormat.format(endsAt)}.` : `Действует до ${dateFormat.format(endsAt)}.`} Напишите нам в WhatsApp {WHATSAPP_DISPLAY}, чтобы продлить.</p>
      </div>
      <a href={whatsappRenewUrl(organizationName)} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700">
        <MessageCircle className="size-4" />Продлить в WhatsApp
      </a>
    </aside>
  );
}
