import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/tenant";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { db } from "@/lib/db";
import { remainingTrialDays } from "@/lib/billing/policy";
import { getSubscription } from "@/lib/billing/service";

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
  const [hotel, experience, room, apartmentCount, subscription] = await Promise.all([
    db.hotel.findFirst({
      where: { id: user.hotelId, orgId: user.organizationId ?? undefined },
      select: { name: true, city: true, language: true },
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
    db.room.count({ where: { hotelId: user.hotelId } }),
    user.organizationId ? getSubscription(user.organizationId) : Promise.resolve(null),
  ]);
  if (!hotel) redirect("/login");

  const initialStep = apartmentCount > 0 ? 4 : experience?.setupStep && experience.setupStep >= 2 ? 3 : 1;
  const trialDaysRemaining = subscription ? remainingTrialDays(subscription.trialEndsAt) : 14;
  return (
    <OnboardingForm
      initialStep={initialStep}
      trialDaysRemaining={trialDaysRemaining}
      apartmentCount={apartmentCount}
      hotel={{
        name: hotel.name,
        city: hotel.city?.trim() || "Астана",
        language: (["ru", "kk", "en"].includes(hotel.language) ? hotel.language : "ru") as "ru" | "kk" | "en",
      }}
      apartment={room ? {
        number: room.number,
        floor: String(room.floor),
        capacity: String(room.roomType.capacity),
        basePrice: String(room.roomType.basePrice),
      } : null}
    />
  );
}
