"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Clock3, History, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { updateSupportRequestAction } from "@/server/actions/superadmin-support";
import {
  SUPPORT_REQUEST_STATUSES,
  SUPPORT_STATUS_LABELS,
  type SupportRequestStatus,
} from "@/lib/support/workflow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Activity = {
  id: string;
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  createdAt: string;
  actorName: string | null;
};

type Props = {
  requestId: string;
  status: string;
  assignedTo: { id: string; fullName: string } | null;
  currentAdminId: string;
  activities: Activity[];
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" });

export function SupportRequestWorkflow({ requestId, status, assignedTo, currentAdminId, activities }: Props) {
  const normalizedStatus = SUPPORT_REQUEST_STATUSES.includes(status as SupportRequestStatus)
    ? status as SupportRequestStatus
    : "OPEN";
  const [open, setOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<SupportRequestStatus>(normalizedStatus);
  const [assignment, setAssignment] = useState<"SELF" | "UNASSIGNED" | "UNCHANGED">("UNCHANGED");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updateSupportRequestAction({
        requestId,
        status: selectedStatus,
        assignment,
        note,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось обновить обращение");
        return;
      }
      toast.success(result.message ?? "Обращение обновлено");
      setNote("");
      setAssignment("UNCHANGED");
      setOpen(false);
    });
  }

  return (
    <div className="flex min-w-44 flex-col items-start gap-2">
      <SupportStatusBadge status={normalizedStatus} />
      <span className="text-xs text-slate-500">
        {assignedTo ? `Ответственный: ${assignedTo.fullName}` : "Не назначено"}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="border-white/15 bg-white/[0.04] text-slate-200 hover:bg-white/10 hover:text-white">
            Обработать
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Обработка обращения</DialogTitle>
            <DialogDescription>Статус, ответственный и заметки доступны только администраторам платформы.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor={`status-${requestId}`}>Статус</Label>
              <select
                id={`status-${requestId}`}
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value as SupportRequestStatus)}
                className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {SUPPORT_REQUEST_STATUSES.map((value) => <option key={value} value={value}>{SUPPORT_STATUS_LABELS[value]}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Ответственный</Label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant={assignment === "SELF" ? "default" : "outline"} onClick={() => setAssignment("SELF")}>
                  <UserCheck className="size-4" /> Назначить на меня
                </Button>
                {assignedTo ? (
                  <Button type="button" size="sm" variant={assignment === "UNASSIGNED" ? "default" : "outline"} onClick={() => setAssignment("UNASSIGNED")}>
                    Снять назначение
                  </Button>
                ) : null}
              </div>
              {assignedTo?.id === currentAdminId && assignment === "UNCHANGED" ? <p className="text-xs text-muted-foreground">Обращение назначено на вас.</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`note-${requestId}`}>Внутренняя заметка</Label>
              <Textarea
                id={`note-${requestId}`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={2000}
                rows={4}
                placeholder="Например: связались с отелем, ожидаем ответ"
              />
              <p className="text-right text-xs text-muted-foreground">{note.length}/2000</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium"><History className="size-4" /> История</div>
              {activities.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Действий пока не было.</p>
              ) : (
                <ol className="space-y-3">
                  {activities.map((activity) => (
                    <li key={activity.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="font-medium">{activityLabel(activity)}</span>
                        <time className="text-xs text-muted-foreground">{dateFormatter.format(new Date(activity.createdAt))}</time>
                      </div>
                      {activity.note ? <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{activity.note}</p> : null}
                      <p className="mt-2 text-xs text-muted-foreground">{activity.actorName ?? "Удалённый администратор"}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
            <Button type="button" disabled={pending} onClick={save}>{pending ? "Сохранение..." : "Сохранить"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SupportStatusBadge({ status }: { status: SupportRequestStatus }) {
  const Icon = status === "RESOLVED" ? CheckCircle2 : Clock3;
  const className = status === "RESOLVED"
    ? "bg-emerald-400/15 text-emerald-300"
    : status === "REVIEWING"
      ? "bg-amber-400/15 text-amber-200"
      : "bg-sky-400/15 text-sky-200";
  return <Badge className={className}><Icon className="mr-1 size-3" />{SUPPORT_STATUS_LABELS[status]}</Badge>;
}

function activityLabel(activity: Activity): string {
  if (activity.type === "STATUS_CHANGE") {
    const next = activity.toStatus && SUPPORT_REQUEST_STATUSES.includes(activity.toStatus as SupportRequestStatus)
      ? SUPPORT_STATUS_LABELS[activity.toStatus as SupportRequestStatus]
      : activity.toStatus;
    return `Статус изменён на «${next ?? "неизвестно"}»`;
  }
  if (activity.type === "ASSIGNMENT") return "Изменён ответственный";
  return "Добавлена заметка";
}
