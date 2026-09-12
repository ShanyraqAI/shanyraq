"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordResetAction, resetPasswordAction } from "@/server/actions/auth";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [requested, setRequested] = useState(false);
  const [loading, setLoading] = useState(false);

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await requestPasswordResetAction(email);
      if (!result.ok) return toast.error(result.error);
      toast.success(result.message);
      setRequested(true);
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await resetPasswordAction({ email, code, password });
      if (!result.ok) return toast.error(result.error);
      toast.success(result.message);
      router.replace("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (requested) {
    return (
      <form onSubmit={resetPassword} className="space-y-4">
        <p className="text-sm text-muted-foreground">Введите код из письма для {email} и задайте новый пароль.</p>
        <div className="space-y-1.5">
          <Label htmlFor="reset-code">Код подтверждения</Label>
          <Input
            id="reset-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            className="text-center text-xl tracking-[0.45em]"
            required
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">Новый пароль</Label>
          <Input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={64} value={password} onChange={(event) => setPassword(event.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={loading || code.length !== 6 || password.length < 8}>
          {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
          Сохранить новый пароль
        </Button>
        <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" disabled={loading} onClick={() => { setRequested(false); setCode(""); }}>
          Запросить код заново
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="recovery-email">Email аккаунта</Label>
        <Input id="recovery-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
        Получить код
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">Вернуться ко входу</Link>
      </p>
    </form>
  );
}
