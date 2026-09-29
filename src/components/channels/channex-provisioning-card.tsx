"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, CircleAlert, Loader2, RadioTower, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createIntegrationManagerSessionAction } from "@/server/actions/channex";

export interface ChannexProvisioningVM {
  locale: "ru" | "kk";
  rentalPropertyId: string;
  propertyName: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "READY" | "FAILED";
  complete: boolean;
  propertyId: string | null;
  roomTypes: { ready: number; total: number };
  ratePlans: { ready: number; total: number };
  lastError: string | null;
  apiConfigured: boolean;
  prerequisites: string[];
}

const providers = [
  { name: "Booking.com", tone: "bg-[#eaf1ff] text-[#2463b5]" },
  { name: "Airbnb", tone: "bg-[#fff0f1] text-[#d64e58]" },
  { name: "Ostrovok", tone: "bg-[#fff3dd] text-[#9c6714]" },
];

export function ChannexProvisioningCard({ value }: { value: ChannexProvisioningVM }) {
  const kk = value.locale === "kk";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [managerUrl, setManagerUrl] = useState<string | null>(null);
  const inFlight = useRef(false);
  const disabled = pending || value.status === "IN_PROGRESS" || !value.apiConfigured || value.prerequisites.length > 0;

  function openManager() {
    if (inFlight.current) return;
    inFlight.current = true;
    startTransition(async () => {
      try {
        const result = await createIntegrationManagerSessionAction(value.rentalPropertyId);
        if (!result.ok || !result.data?.url) {
          toast.error(result.error ?? (kk ? "Арналарды қосу терезесі ашылмады." : "Не удалось открыть подключение каналов."));
          return;
        }
        setManagerUrl(result.data.url);
        router.refresh();
      } catch {
        toast.error(kk ? "Арналарды қосу терезесі ашылмады. Қайталап көріңіз." : "Не удалось открыть подключение каналов. Повторите попытку.");
      } finally {
        inFlight.current = false;
      }
    });
  }

  return (
    <>
      <Card className="overflow-hidden border-primary/20">
        <CardHeader className="gap-3 bg-primary/[0.03] sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-base"><RadioTower className="size-5 text-primary" />{value.propertyName}</CardTitle>
            <CardDescription>{kk ? "Сату арналарын қосып, санаттарды сәйкестендіріп, бір терезеде басқарыңыз." : "Подключите каналы продаж, сопоставьте категории и управляйте ими в одном окне."}</CardDescription>
          </div>
          <Badge variant={value.complete ? "default" : value.status === "FAILED" ? "destructive" : "secondary"}>
            {value.complete ? (kk ? "Арналарға дайын" : "Готов к каналам") : value.status === "IN_PROGRESS" ? (kk ? "Дайындалуда" : "Подготавливаем") : value.status === "FAILED" ? (kk ? "Тексеру керек" : "Нужна проверка") : (kk ? "Бапталмаған" : "Не настроено")}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="flex flex-wrap gap-2">{providers.map((provider) => <span key={provider.name} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${provider.tone}`}>{provider.name}</span>)}</div>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl border bg-secondary/20 p-3"><div className="text-muted-foreground">{kk ? "Орналастыру санаттары" : "Категории размещения"}</div><div className="mt-1 font-semibold">{kk ? `${value.roomTypes.total} ішінен ${value.roomTypes.ready} дайын` : `${value.roomTypes.ready} из ${value.roomTypes.total} готовы`}</div></div>
            <div className="rounded-xl border bg-secondary/20 p-3"><div className="text-muted-foreground">{kk ? "Тарифтер" : "Тарифы"}</div><div className="mt-1 font-semibold">{kk ? `${value.ratePlans.total} ішінен ${value.ratePlans.ready} дайын` : `${value.ratePlans.ready} из ${value.ratePlans.total} готовы`}</div></div>
          </div>
          {!value.apiConfigured ? <Notice>{kk ? "Интеграциялар қызметін әкімші әлі баптамаған." : "Сервис интеграций ещё не настроен администратором."}</Notice> : null}
          {value.prerequisites.length > 0 ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm"><div className="mb-1 font-semibold">{kk ? "Қосу алдында:" : "Перед подключением:"}</div><ul className="list-disc space-y-1 pl-5 text-muted-foreground">{value.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
          {value.lastError ? <Notice>{value.lastError}</Notice> : null}
          {value.complete ? <p className="flex gap-2 text-sm text-muted-foreground"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />{kk ? "Нысан дайын. Арналарды қосып, баптауға болады." : "Объект подготовлен. Можно подключать и настраивать каналы."}</p> : null}
          <Button onClick={openManager} disabled={disabled} className="w-full sm:w-auto">
            {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RadioTower className="mr-2 size-4" />}
            {pending ? (kk ? "Ашылуда…" : "Открываем…") : value.complete ? (kk ? "Интеграцияларды басқару" : "Управлять интеграциями") : (kk ? "Интеграцияларды баптау" : "Настроить интеграции")}
            {!pending ? <ArrowRight className="ml-2 size-4" /> : null}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={Boolean(managerUrl)} onOpenChange={(open) => { if (!open) setManagerUrl(null); }}>
        <DialogContent className="flex h-[96dvh] w-[98vw] max-w-[1180px] flex-col gap-0 overflow-hidden p-0 max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:w-screen max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none">
          <DialogHeader className="flex-row items-center justify-between border-b px-4 py-3 text-left">
            <div><DialogTitle>{kk ? "Интеграциялар" : "Интеграции"} · {value.propertyName}</DialogTitle><DialogDescription>{kk ? "Арнаны таңдап, тексеріп, санаттарды сәйкестендіріңіз." : "Выберите канал, выполните проверку и сопоставьте категории."}</DialogDescription></div>
            <Button type="button" variant="ghost" size="icon" onClick={() => setManagerUrl(null)} aria-label={kk ? "Жабу" : "Закрыть"}><X className="size-5" /></Button>
          </DialogHeader>
          {managerUrl ? <iframe title={`Интеграции ${value.propertyName}`} src={managerUrl} className="min-h-0 w-full flex-1 border-0 bg-white" allow="clipboard-write" /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm"><CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />{children}</p>;
}
