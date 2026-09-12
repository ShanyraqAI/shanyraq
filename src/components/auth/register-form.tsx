"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GoogleButton } from "@/components/auth/google-button";
import { registerAction, resendRegistrationCodeAction, verifyRegistrationCodeAction } from "@/server/actions/auth";
import { t } from "@/lib/i18n";

export function RegisterForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await registerAction({
        firstName,
        lastName,
        method,
        email: method === "email" ? contact : undefined,
        phone: method === "phone" ? contact : undefined,
        password,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.data?.verificationRequired && result.data.email) {
        setVerificationEmail(result.data.email);
        toast.success(result.message);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!verificationEmail) return;
    setLoading(true);
    try {
      const result = await verifyRegistrationCodeAction({ email: verificationEmail, code });
      if (!result.ok) return toast.error(result.error);
      toast.success(result.message);
      router.replace("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    if (!verificationEmail) return;
    setLoading(true);
    try {
      const result = await resendRegistrationCodeAction(verificationEmail);
      if (!result.ok) return toast.error(result.error);
      toast.success(result.message);
    } finally {
      setLoading(false);
    }
  }

  if (verificationEmail) {
    return (
      <form onSubmit={verifyCode} className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Подтвердите почту</h2>
          <p className="text-sm text-muted-foreground">
            Мы отправили шестизначный код на {verificationEmail}. Он действует 10 минут.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="registration-code">Код подтверждения</Label>
          <Input
            id="registration-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            className="text-center text-xl tracking-[0.45em]"
            required
            autoFocus
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
          {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
          Подтвердить и создать аккаунт
        </Button>
        <div className="flex items-center justify-between text-sm">
          <button type="button" className="text-primary hover:underline" onClick={resendCode} disabled={loading}>
            Отправить код повторно
          </button>
          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setVerificationEmail(null)} disabled={loading}>
            Изменить email
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="register-first-name">{t.auth.firstName}</Label>
          <Input id="register-first-name" autoComplete="given-name"
            value={firstName} onChange={(e) => setFirstName(e.target.value)}
            required maxLength={80} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="register-last-name">{t.auth.lastName}</Label>
          <Input id="register-last-name" autoComplete="family-name"
            value={lastName} onChange={(e) => setLastName(e.target.value)}
            maxLength={80} />
        </div>
      </div>

      <Tabs value={method} onValueChange={(v) => setMethod(v as "email" | "phone")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="email">{t.auth.emailTab}</TabsTrigger>
          <TabsTrigger value="phone">{t.auth.phoneTab}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-1.5">
        <Label htmlFor="register-contact">
          {method === "email" ? t.auth.email : t.auth.phone}
        </Label>
        <Input
          id="register-contact"
          type={method === "email" ? "email" : "tel"}
          autoComplete={method === "email" ? "username" : "tel"}
          placeholder={method === "email" ? t.auth.emailPlaceholder : t.auth.phonePlaceholder}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="register-password">{t.auth.password}</Label>
        <Input
          id="register-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          maxLength={64}
        />
        <p className="text-xs text-muted-foreground">{t.auth.passwordHint}</p>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
        {loading ? t.auth.creating : t.auth.signUp}
      </Button>

      {googleEnabled ? (
        <>
          <div className="relative py-1 text-center">
            <span className="relative z-10 bg-card px-3 text-xs uppercase tracking-wide text-muted-foreground">
              {t.auth.or}
            </span>
            <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
          </div>
          <GoogleButton label={t.auth.continueWithGoogle} />
        </>
      ) : null}

      <p className="pt-1 text-center text-sm text-muted-foreground">
        {t.auth.haveAccount}{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t.auth.toLogin}
        </Link>
      </p>
    </form>
  );
}
