import { BillingBanner } from "@/components/billing/billing-banner";
import { getSubscription } from "@/lib/billing/service";
import { accessUntil, isExpired } from "@/lib/billing/policy";
import { BrandLogo } from "@/components/shared/brand-logo";
import { requireOnboardingComplete } from "@/lib/auth/session";
import { getCurrentHotel } from "@/lib/tenant";
import { DesktopSidebar } from "@/components/layout/app-sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { db } from "@/lib/db";
import { avatarDisplayUrl } from "@/lib/avatar";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { ProductTour } from "@/components/onboarding/product-tour";
import { PRODUCT_AVAILABILITY } from "@/lib/product-availability";
import { resolveHotelPermissions } from "@/lib/access";
import { SupportChatWidget } from "@/components/support/support-chat-widget";
import { ContextualFeedbackPrompt } from "@/components/feedback/contextual-feedback-prompt";
import { shouldShowFirstReservationFeedback } from "@/lib/support/feedback";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOnboardingComplete();
  const hotel = await getCurrentHotel();
  
  if (!hotel) {
    return <div className="min-h-screen flex items-center justify-center">Отель не найден</div>;
  }
  
  const hotelName = hotel.name;
  const userName = user.fullName;
  const permissions = resolveHotelPermissions(user);
  const [subscription, hotels, productExperience, reservationCount] = await Promise.all([
    PRODUCT_AVAILABILITY.billing && user.organizationId ? getSubscription(user.organizationId) : Promise.resolve(null),
    db.membership.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { hotel: { select: { id: true, name: true } } },
    }),
    db.productExperience.findUnique({
      where: { userId_hotelId: { userId: user.id, hotelId: hotel.id } },
      select: { tourCompletedAt: true, tourSkippedAt: true, feedbackSubmittedAt: true, feedbackDismissedAt: true },
    }),
    db.reservation.count({ where: { hotelId: hotel.id } }),
  ]);
  const hotelOptions = hotels.map((item) => item.hotel);

  return (
    <div data-dashboard-theme className="min-h-screen bg-background">
      <DesktopSidebar
        hotelName={hotelName}
        userName={userName}
        userAvatarUrl={avatarDisplayUrl(user.id, user.avatarUrl)}
        hotels={hotelOptions}
        activeHotelId={hotel.id}
        accessLevel={user.accessLevel ?? "FULL"}
        permissions={permissions}
        canManageHotels={user.role === "OWNER"}
      />
      <div className="lg:pl-64">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
          <MobileNav
            hotelName={hotelName}
            userName={userName}
            userAvatarUrl={avatarDisplayUrl(user.id, user.avatarUrl)}
            hotels={hotelOptions}
            activeHotelId={hotel.id}
            accessLevel={user.accessLevel ?? "FULL"}
            permissions={permissions}
            canManageHotels={user.role === "OWNER"}
          />
          <BrandLogo className="h-6 w-auto" />
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 md:py-8">
          {user.platformRole === "SUPER_ADMIN" && (
            <Link href="/superadmin" className="mb-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 transition-colors hover:bg-emerald-100">
              <span className="flex items-center gap-2"><ShieldCheck className="size-4" />Открыть панель суперадминистратора</span>
              <span aria-hidden>→</span>
            </Link>
          )}
          {subscription && <BillingBanner endsAt={accessUntil(subscription).toISOString()} paid={Boolean(subscription.paidUntil)} initiallyExpired={isExpired(subscription)} />}
          {children}
        </main>
      </div>
      {!productExperience?.tourCompletedAt && !productExperience?.tourSkippedAt ? (
        <ProductTour permissions={permissions} />
      ) : null}
      {shouldShowFirstReservationFeedback({
        reservationCount,
        tourCompleted: Boolean(productExperience?.tourCompletedAt || productExperience?.tourSkippedAt),
        submitted: Boolean(productExperience?.feedbackSubmittedAt),
        dismissed: Boolean(productExperience?.feedbackDismissedAt),
      }) ? <ContextualFeedbackPrompt /> : null}
      <SupportChatWidget
        source="DASHBOARD"
        defaultName={user.fullName}
        defaultContact={user.email ?? user.phone ?? ""}
      />
    </div>
  );
}
