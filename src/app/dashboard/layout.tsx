import { BillingBanner } from "@/components/billing/billing-banner";
import { getSubscription } from "@/lib/billing/service";
import { accessUntil, isExpired } from "@/lib/billing/policy";
import { requireOnboardingComplete } from "@/lib/auth/session";
import { getCurrentHotel } from "@/lib/tenant";
import { DesktopSidebar } from "@/components/layout/app-sidebar";
import { MobileAppShell } from "@/components/layout/mobile-app-shell";
import { MobileContextBack } from "@/components/layout/mobile-context-back";
import { db } from "@/lib/db";
import { avatarDisplayUrl } from "@/lib/avatar";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { PRODUCT_AVAILABILITY } from "@/lib/product-availability";
import { resolveHotelPermissions } from "@/lib/access";
import { SupportChatWidget } from "@/components/support/support-chat-widget";
import { ContextualFeedbackPrompt } from "@/components/feedback/contextual-feedback-prompt";
import { shouldShowFirstReservationFeedback } from "@/lib/support/feedback";
import { getNotificationCenter } from "@/lib/notifications/service";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { GlobalSearch, type GlobalSearchItem } from "@/components/layout/global-search";
import { formatISODate, toISODate } from "@/lib/dates";
import { guestDisplayId, reservationDisplayId } from "@/lib/types";
import { getRequestLocale } from "@/lib/locale-server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOnboardingComplete();
  const hotel = await getCurrentHotel();
  
  if (!hotel) {
    return <div className="min-h-screen flex items-center justify-center">Отель не найден</div>;
  }
  
  const hotelName = hotel.name;
  const locale = await getRequestLocale();
  const userName = user.fullName;
  const permissions = resolveHotelPermissions(user);
  const [subscription, hotels, productExperience, reservationCount, notificationCenter, searchableData] = await Promise.all([
    PRODUCT_AVAILABILITY.billing && user.organizationId ? getSubscription(user.organizationId) : Promise.resolve(null),
    db.membership.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { hotel: { select: { id: true, name: true } } },
    }),
    db.productExperience.findUnique({
      where: { userId_hotelId: { userId: user.id, hotelId: hotel.id } },
      select: { feedbackSubmittedAt: true, feedbackDismissedAt: true },
    }),
    db.reservation.count({ where: { hotelId: hotel.id } }),
    getNotificationCenter(hotel.id, user.id),
    Promise.all([
      db.guest.findMany({ where: { hotelId: hotel.id }, orderBy: { sequenceNumber: "desc" }, take: 120, select: { id: true, sequenceNumber: true, fullName: true, email: true, phone: true } }),
      db.room.findMany({ where: { hotelId: hotel.id }, orderBy: { number: "asc" }, take: 120, select: { id: true, number: true, floor: true, roomType: { select: { name: true } } } }),
      db.reservation.findMany({ where: { hotelId: hotel.id }, orderBy: { createdAt: "desc" }, take: 120, select: { id: true, sequenceNumber: true, guest: { select: { fullName: true } }, room: { select: { number: true } }, checkIn: true, checkOut: true } }),
    ]),
  ]);
  const hotelOptions = hotels.map((item) => item.hotel);
  const [searchGuests, searchRooms, searchReservations] = searchableData;
  const searchItems: GlobalSearchItem[] = [
    ...(permissions.includes("GUESTS") ? searchGuests.map((guest) => ({ id: `guest-${guest.id}`, type: "guest" as const, title: guest.fullName, subtitle: `${guestDisplayId(guest.sequenceNumber)} · ${guest.email ?? guest.phone ?? "карточка гостя"}`, href: `/dashboard/guests?guest=${guest.id}` })) : []),
    ...(permissions.includes("ROOMS") ? searchRooms.map((room) => ({ id: `room-${room.id}`, type: "room" as const, title: `Номер ${room.number}`, subtitle: `${room.roomType.name} · ${room.floor} этаж`, href: "/dashboard/rooms" })) : []),
    ...(permissions.includes("RESERVATIONS") ? searchReservations.map((reservation) => ({ id: `reservation-${reservation.id}`, type: "reservation" as const, title: `${reservationDisplayId(reservation.sequenceNumber)} · ${reservation.guest.fullName}`, subtitle: `Номер ${reservation.room.number} · ${formatISODate(toISODate(reservation.checkIn))} — ${formatISODate(toISODate(reservation.checkOut))}`, href: `/dashboard/reservations?reservation=${reservation.id}` })) : []),
  ];

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
        <MobileAppShell locale={locale} />
        <header className="sticky top-0 z-30 hidden h-16 items-center border-b bg-background/95 px-8 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:flex">
          <div className="mx-auto flex w-full max-w-[1400px] items-center justify-end gap-2"><GlobalSearch items={searchItems} /><NotificationCenter initialUnreadCount={notificationCenter.unreadCount} initialItems={notificationCenter.items.map((item) => ({ ...item, readAt: item.readAt?.toISOString() ?? null, createdAt: item.createdAt.toISOString() }))} /></div>
        </header>
        <main className="sh-mobile-main mx-auto w-full max-w-[1400px] px-4 pb-[calc(5.25rem+env(safe-area-inset-bottom))] pt-4 md:px-6 md:pt-6 lg:px-8 lg:py-8">
          {user.platformRole === "SUPER_ADMIN" && (
            <Link href="/superadmin" className="mb-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 transition-colors hover:bg-emerald-100">
              <span className="flex items-center gap-2"><ShieldCheck className="size-4" />Открыть панель суперадминистратора</span>
              <span aria-hidden>→</span>
            </Link>
          )}
          {subscription && <BillingBanner endsAt={accessUntil(subscription).toISOString()} paid={Boolean(subscription.paidUntil)} initiallyExpired={isExpired(subscription)} />}
          <MobileContextBack locale={locale} />
          {children}
        </main>
      </div>
      {shouldShowFirstReservationFeedback({
        reservationCount,
        submitted: Boolean(productExperience?.feedbackSubmittedAt),
        dismissed: Boolean(productExperience?.feedbackDismissedAt),
      }) ? <ContextualFeedbackPrompt /> : null}
      <div className="hidden lg:block"><SupportChatWidget
        source="DASHBOARD"
        defaultName={user.fullName}
        defaultContact={user.email ?? user.phone ?? ""}
      /></div>
    </div>
  );
}
