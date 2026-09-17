"use client";

import { useState, useTransition } from "react";
import { BellRing, Loader2, Mail, Save, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveNotificationPreferencesAction } from "@/server/actions/notifications";

export function NotificationPreferences({ initial, emailAvailable }: {
  initial: { newReservationEmail: boolean; dailyDigestEmail: boolean; digestHour: number };
  emailAvailable: boolean;
}) {
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();
  const save = () => startTransition(async () => {
    const result = await saveNotificationPreferencesAction(values);
    if (result.ok) toast.success(result.message);
    else toast.error(result.error);
  });

  return (
    <div className="max-w-4xl space-y-5 rounded-xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><BellRing className="size-5" /></span><div><h2 className="font-semibold">Как вас уведомлять</h2><p className="text-sm text-muted-foreground">Уведомления в приложении включены всегда. Email удобно получать прямо на телефоне.</p></div></div>
      {!emailAvailable ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Добавьте email в профиле, чтобы включить сообщения вне приложения.</div> : null}
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
        <Checkbox checked={values.newReservationEmail} disabled={!emailAvailable} onCheckedChange={(checked) => setValues((current) => ({ ...current, newReservationEmail: checked === true }))} />
        <span><span className="flex items-center gap-2 font-medium"><Mail className="size-4" /> Новое бронирование</span><span className="mt-1 block text-sm text-muted-foreground">Отправлять письмо сразу после брони из любого канала.</span></span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
        <Checkbox checked={values.dailyDigestEmail} disabled={!emailAvailable} onCheckedChange={(checked) => setValues((current) => ({ ...current, dailyDigestEmail: checked === true }))} />
        <span className="flex-1"><span className="flex items-center gap-2 font-medium"><Smartphone className="size-4" /> Утренняя сводка</span><span className="mt-1 block text-sm text-muted-foreground">Заезды и выезды на сегодня одним коротким письмом.</span></span>
      </label>
      <div className="flex items-center justify-between gap-4 rounded-lg bg-secondary/50 p-4">
        <Label htmlFor="digest-hour">Время по часовому поясу отеля</Label>
        <Select value={String(values.digestHour)} disabled={!values.dailyDigestEmail || !emailAvailable} onValueChange={(value) => setValues((current) => ({ ...current, digestHour: Number(value) }))}>
          <SelectTrigger id="digest-hour" className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{Array.from({ length: 9 }, (_, index) => index + 6).map((hour) => <SelectItem key={hour} value={String(hour)}>{String(hour).padStart(2, "0")}:00</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="flex justify-end"><Button onClick={save} disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Сохранить</Button></div>
    </div>
  );
}
