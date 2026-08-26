import { getDemoHotel } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { DesktopSidebar } from "@/components/layout/app-sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, hotel] = await Promise.all([requireUser(), getDemoHotel()]);
  const hotelName = hotel.name;
  const userName = user.fullName;

  return (
    <div className="min-h-screen bg-background">
      <DesktopSidebar
        hotelName={hotelName}
        userName={userName}
        userAvatarUrl={user.avatarUrl}
      />
      <div className="lg:pl-64">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
          <MobileNav
            hotelName={hotelName}
            userName={userName}
            userAvatarUrl={user.avatarUrl}
          />
          <span className="text-[15px] font-semibold tracking-tight">Shanyraq AI</span>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
