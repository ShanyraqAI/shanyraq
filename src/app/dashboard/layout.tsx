import { BrandLogo } from "@/components/shared/brand-logo";
import { requireOnboardingComplete } from "@/lib/auth/session";
import { getCurrentHotel } from "@/lib/tenant";
import { DesktopSidebar } from "@/components/layout/app-sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { db } from "@/lib/db";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOnboardingComplete();
  const hotel = await getCurrentHotel();
  
  if (!hotel) {
    return <div className="min-h-screen flex items-center justify-center">Отель не найден</div>;
  }
  
  const hotelName = hotel.name;
  const userName = user.fullName;
  const hotels = await db.membership.findMany({
    where: { userId: user.id, hotelId: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { hotel: { select: { id: true, name: true } } },
  });
  const hotelOptions = hotels.flatMap((item) => item.hotel ? [item.hotel] : []);

  return (
    <div data-dashboard-theme className="min-h-screen bg-background">
      <DesktopSidebar
        hotelName={hotelName}
        userName={userName}
        userAvatarUrl={user.avatarUrl}
        hotels={hotelOptions}
        activeHotelId={hotel.id}
        accessLevel={user.accessLevel ?? "FULL"}
        canManageHotels={user.role === "OWNER"}
      />
      <div className="lg:pl-64">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
          <MobileNav
            hotelName={hotelName}
            userName={userName}
            userAvatarUrl={user.avatarUrl}
            hotels={hotelOptions}
            activeHotelId={hotel.id}
            accessLevel={user.accessLevel ?? "FULL"}
            canManageHotels={user.role === "OWNER"}
          />
          <BrandLogo className="h-6 w-auto" />
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
