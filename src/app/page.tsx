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
import { LandingStructuredData } from "@/components/landing/landing-structured-data";
import s from "@/components/landing/landing.module.css";

const manrope = localFont({ src: "../assets/fonts/manrope-variable.ttf", display: "swap", weight: "200 800" });

const title = "Shanyraq AI — программа для посуточной аренды и отелей в Казахстане";
const description =
  "Система управления посуточной арендой, гостиницами и апарт-отелями: календарь бронирований, гости, оплаты в тенге, уборки и каналы продаж. Алматы, Астана и весь Казахстан. Бесплатно на время бета-теста.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  keywords: [
    "Shanyraq",
    "Шанырак",
    "посуточная аренда",
    "программа для посуточной аренды",
    "система управления посуточной арендой",
    "учёт бронирований",
    "календарь бронирований",
    "шахматка бронирований",
    "PMS для отеля",
    "PMS для гостиницы",
    "программа для гостиницы",
    "программа для апарт-отеля",
    "менеджер каналов",
    "channel manager",
    "краткосрочная аренда Казахстан",
    "посуточные квартиры Алматы",
    "посуточные квартиры Астана",
    "Krisha.kz",
    "Booking.com",
    "Airbnb",
    "тәуліктік жалға беру",
    "қонақ үйді басқару",
  ],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  openGraph: {
    title,
    description: "Бронирования, гости, оплаты и каналы продаж посуточной аренды — в одном окне.",
    url: "/",
    siteName: "Shanyraq AI",
    locale: "ru_KZ",
    type: "website",
  },
  twitter: { card: "summary_large_image", title, description },
  category: "business",
};

export const viewport: Viewport = {
  colorScheme: "only light",
  themeColor: "#faf9f6",
};

export default function Home() {
  return (
    <BetaInvite className={manrope.className}><LandingMotion className={`${s.landing} ${manrope.className}`}>
      <LandingStructuredData />
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
