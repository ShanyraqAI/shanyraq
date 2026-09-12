"use client";

import { useState, useTransition } from "react";
import { CalendarDays, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BETA_HOTEL_STATUSES,
  BETA_HOTEL_STATUS_LABELS,
  betaStatusNeedsReason,
  type BetaHotelStatus,
} from "@/lib/superadmin/beta";
import { updateBetaHotelAction } from "@/server/actions/superadmin-beta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  hotelId: string;
  currentAdminId: string;
  profile: {
    status: string;
    assignedAdmin: { id: string; fullName: string } | null;
    startedAt: string | null;
    lastContactAt: string | null;
    internalNote: string | null;
    statusReason: string | null;
  } | null;
};

function inputDate(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

export function BetaHotelManagement({ hotelId, currentAdminId, profile }: Props) {
  const router = useRouter();
  const initialStatus = BETA_HOTEL_STATUSES.includes(profile?.status as BetaHotelStatus)
    ? profile?.status as BetaHotelStatus
    : "NOT_ENROLLED";
  const [status, setStatus] = useState<BetaHotelStatus>(initialStatus);
  const [assignment, setAssignment] = useState<"SELF" | "UNASSIGNED" | "UNCHANGED">("UNCHANGED");
  const [startedAt, setStartedAt] = useState(inputDate(profile?.startedAt ?? null));
  const [lastContactAt, setLastContactAt] = useState(inputDate(profile?.lastContactAt ?? null));
  const [internalNote, setInternalNote] = useState(profile?.internalNote ?? "");
  const [statusReason, setStatusReason] = useState(profile?.statusReason ?? "");
  const [pending, startTransition] = useTransition();

  const displayedAssignee = assignment === "SELF"
    ? "Вы"
    : assignment === "UNASSIGNED"
      ? null
      : profile?.assignedAdmin?.fullName ?? null;

  function save() {
    startTransition(async () => {
      const result = await updateBetaHotelAction({
        hotelId,
        status,
        assignment,
        startedAt,
        lastContactAt,
        internalNote,
        statusReason,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось обновить участие в бете");
        return;
      }
      toast.success(result.message ?? "Участие в бете обновлено");
      setAssignment("UNCHANGED");
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2"><CalendarDays className="size-5 text-emerald-400" /><h2 className="font-semibold">Участие в закрытой бете</h2></div>
          <p className="mt-1 text-xs text-slate-500">Внутренняя карточка пилота. Клиенты эти данные не видят.</p>
        </div>
        <BetaStatusBadge status={status} />
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="beta-status">Статус участия</Label>
          <select id="beta-status" value={status} onChange={(event) => setStatus(event.target.value as BetaHotelStatus)} className="flex h-10 w-full rounded-md border bg-background px-3 text-sm">
            {BETA_HOTEL_STATUSES.map((value) => <option key={value} value={value}>{BETA_HOTEL_STATUS_LABELS[value]}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Ответственный администратор</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={assignment === "SELF" ? "default" : "outline"} onClick={() => setAssignment("SELF")}><UserCheck className="size-4" /> Назначить на меня</Button>
            {displayedAssignee ? <Button type="button" size="sm" variant={assignment === "UNASSIGNED" ? "default" : "outline"} onClick={() => setAssignment("UNASSIGNED")}>Снять</Button> : null}
          </div>
          <p className="text-xs text-slate-500">{displayedAssignee ? `Сейчас: ${displayedAssignee}${profile?.assignedAdmin?.id === currentAdminId && assignment === "UNCHANGED" ? " (вы)" : ""}` : "Ответственный не назначен"}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="beta-started-at">Дата начала</Label>
          <Input id="beta-started-at" type="date" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} />
          <p className="text-xs text-slate-500">При переходе в активную бету заполнится автоматически, если оставить пустой.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="beta-last-contact-at">Последний контакт</Label>
          <Input id="beta-last-contact-at" type="date" value={lastContactAt} onChange={(event) => setLastContactAt(event.target.value)} />
        </div>
      </div>

      {betaStatusNeedsReason(status) ? (
        <div className="mt-5 space-y-2">
          <Label htmlFor="beta-status-reason">Причина {status === "PAUSED" ? "паузы" : "выхода"}</Label>
          <Textarea id="beta-status-reason" value={statusReason} onChange={(event) => setStatusReason(event.target.value)} maxLength={1000} rows={3} placeholder="Коротко зафиксируйте причину и следующий шаг" />
          <p className="text-right text-xs text-slate-500">{statusReason.length}/1000</p>
        </div>
      ) : null}

      <div className="mt-5 space-y-2">
        <Label htmlFor="beta-internal-note">Внутренняя заметка</Label>
        <Textarea id="beta-internal-note" value={internalNote} onChange={(event) => setInternalNote(event.target.value)} maxLength={2000} rows={4} placeholder="Контекст пилота, договорённости, следующий контакт" />
        <p className="text-right text-xs text-slate-500">{internalNote.length}/2000</p>
      </div>

      <div className="mt-5 flex justify-end"><Button type="button" disabled={pending} onClick={save}>{pending ? "Сохранение..." : "Сохранить карточку беты"}</Button></div>
    </section>
  );
}

export function BetaStatusBadge({ status }: { status: BetaHotelStatus }) {
  const className = status === "ACTIVE"
    ? "bg-emerald-400/15 text-emerald-300"
    : status === "PAUSED" || status === "LEFT"
      ? "bg-amber-400/15 text-amber-200"
      : status === "NOT_ENROLLED"
        ? "bg-white/10 text-slate-300"
        : "bg-sky-400/15 text-sky-200";
  return <Badge className={className}>{BETA_HOTEL_STATUS_LABELS[status]}</Badge>;
}
