"use client";

import { FormEvent, useState, useTransition } from "react";
import { AlertTriangle, Check, Mail, PencilLine, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { HOTEL_PERMISSIONS, HOTEL_PERMISSION_LABELS, type HotelPermission } from "@/lib/access";
import { addHotelMemberAction, cancelHotelInvitationAction, removeHotelMemberAction, updateHotelMemberAccessAction } from "@/server/actions/settings";

type Member = { id: string; name: string; email: string; permissions: HotelPermission[]; role: string };
type PendingInvitation = { id: string; email: string; permissions: HotelPermission[]; expiresAt: string };

const DEFAULT_PERMISSIONS: HotelPermission[] = ["OVERVIEW"];

function permissionSummary(permissions: readonly HotelPermission[]): string {
  if (permissions.length === HOTEL_PERMISSIONS.length) return "Полный доступ";
  return permissions.map((permission) => HOTEL_PERMISSION_LABELS[permission]).join(", ");
}

export function AccessManagement({ initialMembers, pendingInvitations, canManage }: { initialMembers: Member[]; pendingInvitations: PendingInvitation[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [invitePermissions, setInvitePermissions] = useState<HotelPermission[]>(DEFAULT_PERMISSIONS);
  const [editing, setEditing] = useState<Member | null>(null);
  const [editPermissions, setEditPermissions] = useState<HotelPermission[]>(DEFAULT_PERMISSIONS);

  function invite(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await addHotelMemberAction({ email, permissions: invitePermissions });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEmail("");
      setInvitePermissions(DEFAULT_PERMISSIONS);
      setInviteOpen(false);
      toast.success(result.message);
      router.refresh();
    });
  }

  function openEditor(member: Member) {
    setEditing(member);
    setEditPermissions(member.permissions);
  }

  function updateAccess() {
    if (!editing) return;
    startTransition(async () => {
      const result = await updateHotelMemberAccessAction({ membershipId: editing.id, permissions: editPermissions });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        setEditing(null);
        router.refresh();
      }
    });
  }

  function removeMember(membershipId: string) {
    startTransition(async () => {
      const result = await removeHotelMemberAction(membershipId);
      if (!result.ok) toast.error(result.error);
      else { toast.success(result.message); router.refresh(); }
    });
  }

  function cancelInvitation(invitationId: string) {
    startTransition(async () => {
      const result = await cancelHotelInvitationAction(invitationId);
      if (!result.ok) toast.error(result.error);
      else { toast.success(result.message); router.refresh(); }
    });
  }

  return (
    <section className="max-w-4xl rounded-xl border bg-card shadow-sm">
      <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><Users className="size-4 text-primary" /> Пользователи отеля</h2>
          <p className="mt-1 text-sm text-muted-foreground">Выдавайте доступ только к тем разделам, которые нужны сотруднику.</p>
        </div>
        {canManage ? <Button onClick={() => setInviteOpen(true)}><Plus className="size-4" /> Добавить пользователя</Button> : null}
      </div>
      <div className="divide-y">
        {initialMembers.map((member) => (
          <div key={member.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Mail className="size-4" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{member.name}</p><Badge variant={member.role === "OWNER" ? "secondary" : "outline"}>{member.role === "OWNER" ? "Владелец" : "Сотрудник"}</Badge></div>
              <p className="truncate text-sm text-muted-foreground">{member.email}</p>
              <p className="mt-1 text-xs text-muted-foreground">{member.role === "OWNER" ? "Полный доступ ко всем разделам" : permissionSummary(member.permissions)}</p>
            </div>
            {canManage && member.role !== "OWNER" ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pending} onClick={() => openEditor(member)}><PencilLine className="size-4" /> Настроить</Button>
                <Button variant="ghost" size="icon" disabled={pending} aria-label={`Удалить ${member.name}`} onClick={() => removeMember(member.id)}><Trash2 className="size-4 text-muted-foreground" /></Button>
              </div>
            ) : <Badge variant="secondary"><ShieldCheck className="size-3.5" /> Полный доступ</Badge>}
          </div>
        ))}
        {pendingInvitations.map((invitation) => (
          <div key={invitation.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-700"><Mail className="size-4" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><p className="font-medium">Ожидает регистрации</p><Badge variant="outline">Приглашение отправлено</Badge></div>
              <p className="truncate text-sm text-muted-foreground">{invitation.email} · до {new Date(invitation.expiresAt).toLocaleDateString("ru-RU")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{permissionSummary(invitation.permissions)}</p>
            </div>
            {canManage ? <Button variant="ghost" size="icon" disabled={pending} aria-label={`Отменить приглашение ${invitation.email}`} onClick={() => cancelInvitation(invitation.id)}><Trash2 className="size-4 text-muted-foreground" /></Button> : null}
          </div>
        ))}
      </div>
      <div className="border-t bg-secondary/30 px-5 py-3 text-xs text-muted-foreground">Права применяются только к текущему отелю. Сотрудник не сможет открыть скрытый раздел по прямой ссылке.</div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={invite} className="contents">
            <DialogHeader><DialogTitle>Новый пользователь</DialogTitle><DialogDescription>Укажите email и отметьте доступные разделы.</DialogDescription></DialogHeader>
            <div className="space-y-5">
              <div className="space-y-2"><Label htmlFor="member-email">Email</Label><Input id="member-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="aliya@hotel.kz" /></div>
              <PermissionPicker permissions={invitePermissions} onChange={setInvitePermissions} />
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>Отмена</Button><Button type="submit" disabled={pending || invitePermissions.length === 0}>Предоставить доступ</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Права пользователя</DialogTitle><DialogDescription>{editing ? `${editing.name} · ${editing.email}` : "Выберите доступные разделы"}</DialogDescription></DialogHeader>
          <PermissionPicker permissions={editPermissions} onChange={setEditPermissions} />
          <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Отмена</Button><Button onClick={updateAccess} disabled={pending || editPermissions.length === 0}>Сохранить права</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function PermissionPicker({ permissions, onChange }: { permissions: HotelPermission[]; onChange: (permissions: HotelPermission[]) => void }) {
  const full = permissions.length === HOTEL_PERMISSIONS.length;
  function toggle(permission: HotelPermission, checked: boolean) {
    onChange(HOTEL_PERMISSIONS.filter((item) => item === permission ? checked : permissions.includes(item)));
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label>Доступные разделы</Label>
        <Button type="button" variant={full ? "secondary" : "outline"} size="sm" onClick={() => onChange(full ? DEFAULT_PERMISSIONS : [...HOTEL_PERMISSIONS])}>
          {full ? <Check className="size-4" /> : <ShieldCheck className="size-4" />} {full ? "Полный доступ выбран" : "Выбрать всё"}
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {HOTEL_PERMISSIONS.map((permission) => (
          <label key={permission} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-secondary/50">
            <Checkbox checked={permissions.includes(permission)} onCheckedChange={(value) => toggle(permission, value === true)} />
            <span>{HOTEL_PERMISSION_LABELS[permission]}</span>
          </label>
        ))}
      </div>
      {full ? <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>Полный доступ позволяет сотруднику изменять бронирования, номера и тарифы. Выдавайте его только доверенным сотрудникам.</span></div> : null}
      {permissions.length === 0 ? <p className="text-sm text-destructive">Выберите хотя бы один раздел.</p> : null}
    </div>
  );
}
