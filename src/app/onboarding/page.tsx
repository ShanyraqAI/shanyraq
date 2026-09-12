import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/tenant";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { db } from "@/lib/db";
import { todayInTimeZone, toISODate } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Онбординг — Shanyraq AI",
};

export default async function OnboardingPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.onboardingCompleted) {
    redirect("/dashboard");
  }

  if (!user.hotelId) redirect("/login");
  const [hotel, experience, room, reservationCount] = await Promise.all([
    db.hotel.findFirst({
      where: { id: user.hotelId, orgId: user.organizationId ?? undefined },
      select: { name: true, city: true, country: true, propertyType: true, language: true, currency: true, timezone: true },
    }),
    db.productExperience.findUnique({
      where: { userId_hotelId: { userId: user.id, hotelId: user.hotelId } },
      select: { setupStep: true },
    }),
    db.room.findFirst({
      where: { hotelId: user.hotelId },
      orderBy: { number: "asc" },
      select: { id: true, number: true, floor: true, roomType: { select: { name: true, capacity: true, basePrice: true } } },
    }),
    db.reservation.count({ where: { hotelId: user.hotelId } }),
  ]);
  if (!hotel) redirect("/login");

  const initialStep = room ? 3 : Math.max(1, experience?.setupStep ?? 1);
  return (
    <OnboardingForm
      initialStep={initialStep}
      todayIso={toISODate(todayInTimeZone(hotel.timezone))}
      hasReservation={reservationCount > 0}
      hotel={{
        name: hotel.name,
        city: hotel.city ?? "",
        country: hotel.country ?? "Казахстан",
        propertyType: (hotel.propertyType ?? "") as "" | "Отель" | "Апарт-отель" | "Апартаменты" | "Хостел" | "Гостевой дом" | "Другое",
        language: (["ru", "kk", "en"].includes(hotel.language) ? hotel.language : "ru") as "ru" | "kk" | "en",
        currency: (["KZT", "USD", "EUR"].includes(hotel.currency) ? hotel.currency : "KZT") as "KZT" | "USD" | "EUR",
        timezone: hotel.timezone,
      }}
      room={room ? {
        id: room.id,
        number: room.number,
        floor: String(room.floor),
        roomTypeName: room.roomType.name,
        capacity: String(room.roomType.capacity),
        basePrice: String(room.roomType.basePrice),
      } : null}
    />
  );
}
