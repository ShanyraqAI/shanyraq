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
  title: "Shanyraq AI — программа для посуточной аренды в Казахстане",
  description: "Брони, квартиры, гости и оплаты в одной системе. Для посуточников в Казахстана: управляйте квартирами, домами и апарт-отелями с телефона. Бесплатно на время бета-теста.",
  openGraph: { title: "Shanyraq AI — программа для посуточной аренды в Казахстане", description: "Всё для посуточной аренды в Казахстане — в одном окне.", locale: "ru_KZ", type: "website" },
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
