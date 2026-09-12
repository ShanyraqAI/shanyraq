import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = { title: "Восстановление доступа — Shanyraq AI" };
export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const user = await getSessionUser();
  if (user) redirect(user.onboardingCompleted ? "/dashboard" : "/onboarding");
  return (
    <AuthShell title="Восстановление доступа" subtitle="Подтвердите почту кодом и задайте новый пароль">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
