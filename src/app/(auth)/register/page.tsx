import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { googleOAuthConfigured } from "@/lib/auth/google";
import { getSessionUser } from "@/lib/auth/session";
import { t } from "@/lib/i18n";

export const metadata = { title: "Регистрация — Shanyraq AI" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) {
    redirect(user.onboardingCompleted ? "/dashboard" : "/onboarding");
  }

  return (
    <AuthShell
      title={t.auth.registerTitle}
      subtitle={t.auth.registerSubtitle}
      mode="register"
    >
      <RegisterForm googleEnabled={googleOAuthConfigured()} />
    </AuthShell>
  );
}
