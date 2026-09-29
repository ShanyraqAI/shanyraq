"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Loader2, LogOut, Mail, Phone, Save, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { updateProfileAction, signOutAction, uploadAvatarAction } from "@/server/actions/auth";
import type { AppLocale } from "@/lib/locale";

export interface AccountValues {
  firstName: string;
  lastName: string;
  avatarUrl: string;
  email: string | null;
  phone: string | null;
}

export function AccountForm({ initial, locale = "ru" }: { initial: AccountValues; locale?: AppLocale }) {
  const router = useRouter();
  const kk = locale === "kk";
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await updateProfileAction({ firstName: values.firstName, lastName: values.lastName });
      if (!result.ok) toast.error(result.error);
      else { toast.success(kk ? "Профиль сақталды" : "Профиль сохранён"); router.refresh(); }
    } finally { setSaving(false); }
  }

  async function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.size || file.size > 1024 * 1024) { toast.error(kk ? "1 МБ дейінгі суретті таңдаңыз" : "Выберите изображение размером до 1 МБ"); return; }
    const formData = new FormData();
    formData.set("avatar", file);
    setUploading(true);
    try {
      const result = await uploadAvatarAction(formData);
      if (!result.ok || !result.data) { toast.error(result.error); return; }
      setValues((current) => ({ ...current, avatarUrl: result.data! }));
      toast.success(kk ? "Фото сақталды" : "Фото сохранено");
      router.refresh();
    } finally { setUploading(false); }
  }

  const initials = `${values.firstName?.[0] ?? ""}${values.lastName?.[0] ?? ""}`.toUpperCase() || "SH";

  return (
    <div className="max-w-4xl space-y-4">
      <form onSubmit={save} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="relative bg-gradient-to-br from-[#0c876d] to-[#075e4e] px-5 py-6 text-white sm:px-7">
          <div className="absolute -right-8 -top-16 size-44 rounded-full border-[18px] border-white/10" />
          <div className="relative flex items-center gap-4">
            <div className="relative">
              <Avatar className="size-20 border-4 border-white/25 bg-white/15 shadow-lg"><AvatarImage src={values.avatarUrl} alt={`${values.firstName} ${values.lastName}`} /><AvatarFallback className="bg-white/15 text-xl font-extrabold text-white">{initials}</AvatarFallback></Avatar>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-white text-[#087a64] shadow-md" aria-label={kk ? "Фотоны өзгерту" : "Изменить фото"}>{uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}</button>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseAvatar} className="sr-only" />
            </div>
            <div className="min-w-0"><p className="text-lg font-extrabold">{values.firstName} {values.lastName}</p><p className="mt-1 text-xs text-white/70">{kk ? "Жеке профиль · сурет 1 МБ дейін" : "Личный профиль · фото до 1 МБ"}</p></div>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="account-first-name">{kk ? "Аты" : "Имя"}</Label><Input id="account-first-name" autoComplete="given-name" value={values.firstName} onChange={(event) => setValues((current) => ({ ...current, firstName: event.target.value }))} required maxLength={80} /></div>
            <div className="space-y-1.5"><Label htmlFor="account-last-name">{kk ? "Тегі" : "Фамилия"}</Label><Input id="account-last-name" autoComplete="family-name" value={values.lastName} onChange={(event) => setValues((current) => ({ ...current, lastName: event.target.value }))} maxLength={80} /></div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ContactCard icon={Mail} label="Email" value={values.email} empty={kk ? "Көрсетілмеген" : "Не указан"} />
            <ContactCard icon={Phone} label={kk ? "Телефон" : "Телефон"} value={values.phone} empty={kk ? "Көрсетілмеген" : "Не указан"} />
          </div>

          <div className="flex justify-end border-t pt-4"><Button type="submit" disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{kk ? "Өзгерістерді сақтау" : "Сохранить изменения"}</Button></div>
        </div>
      </form>

      <div className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-4 shadow-sm"><div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground"><UserRound className="size-5" /></span><div><p className="text-sm font-semibold">{kk ? "Аккаунт қауіпсіздігі" : "Безопасность аккаунта"}</p><p className="text-xs text-muted-foreground">{kk ? "Осы құрылғыдағы сессияны аяқтау" : "Завершить текущую сессию на этом устройстве"}</p></div></div><form action={signOutAction}><Button type="submit" variant="outline" className="text-destructive"><LogOut className="size-4" /><span className="hidden sm:inline">{kk ? "Шығу" : "Выйти"}</span></Button></form></div>
    </div>
  );
}

function ContactCard({ icon: Icon, label, value, empty }: { icon: typeof Mail; label: string; value: string | null; empty: string }) {
  return <div className="flex min-w-0 items-center gap-3 rounded-xl border bg-secondary/25 p-3.5"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span><div className="min-w-0"><p className="text-[11px] font-semibold text-muted-foreground">{label}</p><p className="truncate text-sm font-semibold">{value ?? empty}</p></div></div>;
}
