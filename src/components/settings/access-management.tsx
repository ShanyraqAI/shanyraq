"use client";

import { FormEvent, useState, useTransition } from "react";
import { Mail, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { addHotelMemberAction, removeHotelMemberAction, updateHotelMemberAccessAction } from "@/server/actions/settings";

type AccessLevel = "OVERVIEW" | "CALENDAR" | "FULL";
type Member = { id: string; name: string; email: string; access: AccessLevel; role: string };

const ACCESS_LABELS: Record<AccessLevel, string> = {
  OVERVIEW: "Только обзор",
  CALENDAR: "Обзор и календарь",
  FULL: "Полный доступ",
};

export function AccessManagement({ initialMembers, canManage }: { initialMembers: Member[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [access, setAccess] = useState<AccessLevel>("OVERVIEW");

  function invite(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await addHotelMemberAction({ email, accessLevel: access });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEmail("");
      setAccess("OVERVIEW");
      setOpen(false);
      toast.success(result.message);
      router.refresh();
    });
  }

  function updateAccess(membershipId: string, accessLevel: AccessLevel) {
    startTransition(async () => {
      const result = await updateHotelMemberAccessAction({ membershipId, accessLevel });
      if (!result.ok) toast.error(result.error);
      else { toast.success(result.message); router.refresh(); }
    });
  }

  function removeMember(membershipId: string) {
    startTransition(async () => {
      const result = await removeHotelMemberAction(membershipId);
      if (!result.ok) toast.error(result.error);
      else { toast.success(result.message); router.refresh(); }
    });
  }

  return (
    <section className="max-w-3xl rounded-xl border bg-card shadow-sm">
      <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><Users className="size-4 text-primary" /> Пользователи отеля</h2>
          <p className="mt-1 text-sm text-muted-foreground">Добавляйте сотрудников и определяйте, какие разделы им доступны.</p>
        </div>
        {canManage ? <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Добавить пользователя</Button> : null}
      </div>
      <div className="divide-y">
        {initialMembers.map((member) => (
          <div key={member.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Mail className="size-4" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{member.name}</p><Badge variant={member.role === "OWNER" ? "secondary" : "outline"}>{member.role === "OWNER" ? "Владелец" : "Сотрудник"}</Badge></div>
              <p className="truncate text-sm text-muted-foreground">{member.email}</p>
            </div>
            <Select value={member.access} disabled={!canManage || member.role === "OWNER" || pending} onValueChange={(value: AccessLevel) => updateAccess(member.id, value)}>
              <SelectTrigger className="w-full sm:w-52"><ShieldCheck className="size-4 text-muted-foreground" /><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(ACCESS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
            {canManage && member.role !== "OWNER" ? <Button variant="ghost" size="icon" disabled={pending} aria-label={`Удалить ${member.name}`} onClick={() => removeMember(member.id)}><Trash2 className="size-4 text-muted-foreground" /></Button> : null}
          </div>
        ))}
      </div>
      <div className="border-t bg-secondary/30 px-5 py-3 text-xs text-muted-foreground">Доступ применяется к текущему отелю. Добавить можно пользователя, который уже зарегистрирован в Shanyraq.</div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={invite} className="contents">
            <DialogHeader><DialogTitle>Новый пользователь</DialogTitle><DialogDescription>Укажите сотрудника и выберите начальный уровень доступа.</DialogDescription></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label htmlFor="member-email">Email</Label><Input id="member-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="aliya@hotel.kz" /></div>
              <div className="space-y-2"><Label htmlFor="member-access">Доступ</Label><Select value={access} onValueChange={(value: AccessLevel) => setAccess(value)}><SelectTrigger id="member-access" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ACCESS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Отмена</Button><Button type="submit" disabled={pending}>Предоставить доступ</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
