import Link from "next/link";
import { BarChart3, CreditCard, ExternalLink, LogOut, ShieldCheck } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/superadmin/auth";
import { signOutAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePlatformAdmin();
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-[1500px] items-center justify-between gap-4 px-4 py-3 md:px-8">
          <Link href="/superadmin" className="flex items-center gap-3 font-semibold">
            <span className="grid size-9 place-items-center rounded-xl bg-emerald-400 text-slate-950"><ShieldCheck className="size-5" /></span>
            <span>Shanyraq Control</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-slate-400 sm:inline">{user.fullName}</span>
            {user.hotelId && (
              <Button asChild variant="ghost" size="sm" className="text-slate-300 hover:bg-white/10 hover:text-white">
                <Link href="/dashboard">Отель <ExternalLink className="size-4" /></Link>
              </Button>
            )}
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="icon-sm" className="text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Выйти">
                <LogOut className="size-4" />
              </Button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1500px] px-4 py-8 md:px-8">
        <nav className="mb-7 flex items-center gap-2 text-sm text-slate-400">
          <BarChart3 className="size-4" />
          <Link href="/superadmin" className="hover:text-white">Обзор закрытой беты</Link>
          <CreditCard className="ml-4 size-4" />
          <Link href="/superadmin/subscriptions" className="hover:text-white">Подписки</Link>
        </nav>
        {children}
      </div>
    </div>
  );
}
