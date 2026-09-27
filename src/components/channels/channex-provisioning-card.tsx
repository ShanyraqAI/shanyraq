"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, CircleAlert, CloudCog, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { provisionChannexStagingAction } from "@/server/actions/channex";

export interface ChannexProvisioningVM {
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

const statusLabels = {
  NOT_STARTED: "Не подключено",
  IN_PROGRESS: "Настраивается",
  READY: "Готово",
  FAILED: "Нужна проверка",
} as const;

export function ChannexProvisioningCard({ value }: { value: ChannexProvisioningVM }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);
  const disabled = pending || value.status === "IN_PROGRESS" || !value.apiConfigured || value.prerequisites.length > 0;
  const buttonLabel = value.complete
    ? "Обновить структуру"
    : value.status === "FAILED" || value.propertyId
      ? "Продолжить настройку"
      : "Подключить к Channex staging";

  function provision() {
    if (inFlight.current) return;
    inFlight.current = true;
    startTransition(async () => {
      try {
        const result = await provisionChannexStagingAction(value.rentalPropertyId);
        if (!result.ok) toast.error(result.error ?? "Не удалось настроить Channex.");
        else toast.success(result.message ?? "Channex настроен.");
      } catch {
        toast.error("Не удалось настроить Channex. Повторите попытку.");
      } finally {
        inFlight.current = false;
        router.refresh();
      }
    });
  }

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardHeader className="gap-3 bg-primary/[0.03] sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-base">
            <CloudCog className="size-5 text-primary" />
            {value.propertyName} · Channex staging
          </CardTitle>
          <CardDescription>
            Создаёт структуру объекта и включает синхронизацию остатков, цен, ограничений и бронирований в тестовой среде.
          </CardDescription>
        </div>
        <Badge variant={value.complete ? "default" : value.status === "FAILED" ? "destructive" : "secondary"}>
          {value.complete ? "Готово" : statusLabels[value.status]}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="text-muted-foreground">Типы размещения</div>
            <div className="mt-1 font-medium">{value.roomTypes.ready} из {value.roomTypes.total} готовы</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-muted-foreground">Тарифы</div>
            <div className="mt-1 font-medium">{value.ratePlans.ready} из {value.ratePlans.total} готовы</div>
          </div>
        </div>

        {!value.apiConfigured && (
          <p className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
            Серверный ключ тестовой среды Channex ещё не настроен.
          </p>
        )}
        {value.prerequisites.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <div className="mb-1 font-medium">Перед подключением:</div>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {value.prerequisites.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}
        {value.lastError && (
          <p className="flex gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            {value.lastError}
          </p>
        )}
        {value.complete && (
          <p className="flex gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            Объект готов: изменения отправляются пакетами, а бронирования принимаются через защищённый feed.
          </p>
        )}
        <Button onClick={provision} disabled={disabled} className="w-full sm:w-auto">
          {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CloudCog className="mr-2 size-4" />}
          {pending ? "Настраиваем…" : buttonLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
