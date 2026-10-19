import { AccountForm } from "@/components/account/account-form";
import { requireUser } from "@/lib/auth/session";
import { isManagedAvatar } from "@/lib/avatar";
import { getRequestLocale } from "@/lib/locale-server";

export const dynamic = "force-dynamic";
export default async function ProfilePage() {
  const [user, locale] = await Promise.all([requireUser(), getRequestLocale()]);
  return <section className="mx-auto max-w-3xl space-y-4"><h1 className="text-2xl font-bold">{locale === "kk" ? "Жеке профиль" : "Мой профиль"}</h1><AccountForm locale={locale} initial={{ firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone, avatarUrl: isManagedAvatar(user.avatarUrl) ? `/api/avatar/${user.id}` : user.avatarUrl ?? "" }} /></section>;
}
