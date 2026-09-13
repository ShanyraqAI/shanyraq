import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { LandingHeader } from "@/components/landing/landing-header";
import { FaqSection, SecuritySection } from "@/components/landing/landing-sections";
import { LaptopHero } from "@/components/landing/laptop-hero";
import { HotelFinalCta, ProductStory } from "@/components/landing/product-story";
import { PricingSection } from "@/components/landing/pricing-section";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingMotion } from "@/components/landing/landing-motion";
import { SupportChatWidget } from "@/components/support/support-chat-widget";
import { BetaInvite } from "@/components/landing/beta-invite";
import s from "@/components/landing/landing.module.css";

const manrope = localFont({ src: "../assets/fonts/manrope-variable.ttf", display: "swap", weight: "200 800" });

export const metadata: Metadata = {
  title: "Shanyraq AI — управляйте отелем из одного окна",
  description: "Бронирования, номера, гости и оплаты в единой системе. Управляйте гостиницей, апарт-отелем и посуточными квартирами с Shanyraq AI. Бесплатно на время бета-теста.",
  openGraph: { title: "Shanyraq AI — управляйте отелем из одного окна", description: "Вся работа вашего объекта — в одном пространстве.", locale: "ru_KZ", type: "website" },
};

export const viewport: Viewport = {
  colorScheme: "only light",
  themeColor: "#faf9f6",
};

export default function Home() {
  return (
    <BetaInvite className={manrope.className}><LandingMotion className={`${s.landing} ${manrope.className}`}>
      <a href="#main" className={s.skipLink}>Перейти к содержимому</a>
      <LandingHeader />
      <main id="main">
        <LaptopHero />
        <ProductStory />
        <SecuritySection />
        <PricingSection />
        <FaqSection />
        <HotelFinalCta />
      </main>
      <LandingFooter />
      <SupportChatWidget source="LANDING" />
    </LandingMotion></BetaInvite>
  );
}
