"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, LogOut, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileAction, signOutAction } from "@/server/actions/auth";
import { t } from "@/lib/i18n";

export interface AccountValues {
  fullName: string;
  avatarUrl: string;
  email: string | null;
  phone: string | null;
}

/** Minimal profile personalization: display name + avatar URL. */
export function AccountForm({ initial }: { initial: AccountValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await updateProfileAction({
        fullName: values.fullName,
        avatarUrl: values.avatarUrl,
      });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="max-w-2xl space-y-4 rounded-xl border bg-card p-6 shadow-sm">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="account-name">{t.account.fullName}</Label>
          <Input
            id="account-name"
            value={values.fullName}
            onChange={(e) => setValues((v) => ({ ...v, fullName: e.target.value }))}
            required
            minLength={2}
            maxLength={160}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="account-email">{t.account.email}</Label>
          <Input id="account-email" value={values.email ?? t.account.notSet} disabled />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="account-phone">{t.account.phone}</Label>
          <Input id="account-phone" value={values.phone ?? t.account.notSet} disabled />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="account-avatar">{t.account.avatarUrl}</Label>
          <Input
            id="account-avatar"
            type="url"
            placeholder="https://…"
            value={values.avatarUrl}
            onChange={(e) => setValues((v) => ({ ...v, avatarUrl: e.target.value }))}
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground">{t.account.avatarHint}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
        <Button type="submit" formAction={signOutAction} variant="outline">
          <LogOut className="mr-2 size-4" />
          {t.account.signOut}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
          {t.account.save}
        </Button>
      </div>
    </form>
  );
}
