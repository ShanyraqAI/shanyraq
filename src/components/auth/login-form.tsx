"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GoogleButton } from "@/components/auth/google-button";
import { loginAction } from "@/server/actions/auth";
import { t } from "@/lib/i18n";

export function LoginForm({
  googleEnabled,
  googleFailed,
}: {
  googleEnabled: boolean;
  googleFailed: boolean;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (googleFailed) toast.error(t.auth.errors.googleFailed);
  }, [googleFailed]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await loginAction({ identifier, password });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Tabs value={method} onValueChange={(v) => setMethod(v as "email" | "phone")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="email">{t.auth.emailTab}</TabsTrigger>
          <TabsTrigger value="phone">{t.auth.phoneTab}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-1.5">
        <Label htmlFor="login-identifier">
          {method === "email" ? t.auth.email : t.auth.phone}
        </Label>
        <Input
          id="login-identifier"
          type={method === "email" ? "email" : "tel"}
          autoComplete={method === "email" ? "username" : "tel"}
          placeholder={method === "email" ? t.auth.emailPlaceholder : t.auth.phonePlaceholder}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="login-password">{t.auth.password}</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
        {loading ? t.auth.signingIn : t.auth.signIn}
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
        {t.auth.noAccount}{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          {t.auth.toRegister}
        </Link>
      </p>
    </form>
  );
}
