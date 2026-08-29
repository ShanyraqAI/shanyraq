"use client";

import { FormEvent, useState } from "react";
import { Mail, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AccessLevel = "overview" | "calendar" | "full";
type Member = { id: number; name: string; email: string; access: AccessLevel; status: "Активен" | "Приглашён" };

const ACCESS_LABELS: Record<AccessLevel, string> = {
  overview: "Только обзор",
  calendar: "Обзор и календарь",
  full: "Полный доступ",
};

const INITIAL_MEMBERS: Member[] = [
  { id: 1, name: "Иманали Сагимбаев", email: "manager@shanyraq.kz", access: "full", status: "Активен" },
];

export function AccessManagement() {
  const [members, setMembers] = useState(INITIAL_MEMBERS);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [access, setAccess] = useState<AccessLevel>("overview");

  function invite(event: FormEvent) {
    event.preventDefault();
    const member: Member = { id: Date.now(), name: name.trim(), email: email.trim(), access, status: "Приглашён" };
    setMembers((current) => [...current, member]);
    setName("");
    setEmail("");
    setAccess("overview");
    setOpen(false);
    toast.success(`Приглашение для ${member.email} создано`);
  }

  return (
    <section className="max-w-3xl rounded-xl border bg-card shadow-sm">
      <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><Users className="size-4 text-primary" /> Пользователи отеля</h2>
          <p className="mt-1 text-sm text-muted-foreground">Добавляйте сотрудников и определяйте, какие разделы им доступны.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Добавить пользователя</Button>
      </div>
      <div className="divide-y">
        {members.map((member) => (
          <div key={member.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Mail className="size-4" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{member.name}</p><Badge variant={member.status === "Активен" ? "secondary" : "outline"}>{member.status}</Badge></div>
              <p className="truncate text-sm text-muted-foreground">{member.email}</p>
            </div>
            <Select value={member.access} onValueChange={(value: AccessLevel) => setMembers((current) => current.map((item) => item.id === member.id ? { ...item, access: value } : item))}>
              <SelectTrigger className="w-full sm:w-52"><ShieldCheck className="size-4 text-muted-foreground" /><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(ACCESS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
            {member.id !== 1 ? <Button variant="ghost" size="icon" aria-label={`Удалить ${member.name}`} onClick={() => setMembers((current) => current.filter((item) => item.id !== member.id))}><Trash2 className="size-4 text-muted-foreground" /></Button> : null}
          </div>
        ))}
      </div>
      <div className="border-t bg-secondary/30 px-5 py-3 text-xs text-muted-foreground">Демо: приглашения и права сохраняются до перезагрузки страницы.</div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={invite} className="contents">
            <DialogHeader><DialogTitle>Новый пользователь</DialogTitle><DialogDescription>Укажите сотрудника и выберите начальный уровень доступа.</DialogDescription></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label htmlFor="member-name">Имя и фамилия</Label><Input id="member-name" value={name} onChange={(event) => setName(event.target.value)} required placeholder="Алия Нурланова" /></div>
              <div className="space-y-2"><Label htmlFor="member-email">Email</Label><Input id="member-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="aliya@hotel.kz" /></div>
              <div className="space-y-2"><Label htmlFor="member-access">Доступ</Label><Select value={access} onValueChange={(value: AccessLevel) => setAccess(value)}><SelectTrigger id="member-access" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ACCESS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Отмена</Button><Button type="submit">Создать приглашение</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
