import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export const metadata = { title: "Предпросмотр онбординга — Shanyraq" };

export default function OnboardingPreviewPage() {
  return (
    <OnboardingForm
      initialStep={1}
      hotel={{ name: "Abay Apartments", city: "Астана", language: "ru" }}
      apartment={{ number: "101", floor: "1", capacity: "2", basePrice: "25000" }}
      apartmentCount={2}
      trialDaysRemaining={14}
      previewMode
    />
  );
}
