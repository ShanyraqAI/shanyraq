import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, Check, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingHeader } from "@/components/landing/landing-header";
import { CalendarPreview } from "@/components/landing/calendar-preview";
import { CalendarSection, ExcelSection, FaqSection, FeaturesSection, FinalCta, ProblemsSection, RoadmapSection, SecuritySection, StepsSection } from "@/components/landing/landing-sections";
import { PricingSection } from "@/components/landing/pricing-section";
import { LandingFooter } from "@/components/landing/landing-footer";
import s from "@/components/landing/landing.module.css";

const manrope = localFont({ src: "../assets/fonts/manrope-variable.ttf", display: "swap", weight: "200 800" });

export const metadata: Metadata = {
  title: "Shanyraq AI — все бронирования в одном месте",
  description: "Управляйте посуточными квартирами и апарт-отелями Казахстана: календарь бронирований, гости, оплаты и заезды в одном окне. 14 дней бесплатно.",
  openGraph: { title: "Shanyraq AI — меньше таблиц, больше контроля", description: "Бронирования, гости и оплаты вашего объекта — в одном месте.", locale: "ru_KZ", type: "website" },
};

export default function Home() {
  return (
    <div className={`${s.landing} ${manrope.className}`}>
      <a href="#main" className={s.skipLink}>Перейти к содержимому</a>
      <LandingHeader />
      <main id="main">
        <section className={`${s.hero} ${s.container}`} aria-labelledby="hero-title">
          <div className={s.eyebrow}><span className={s.statusDot} /> Управление посуточной арендой без хаоса</div>
          <h1 id="hero-title">Все бронирования вашего<br className={s.desktopBreak} /> объекта — <span>в одном месте</span></h1>
          <p className={s.heroDescription}>Shanyraq AI помогает управлять квартирами, гостями, оплатами и заездами<br className={s.desktopBreak} /> без путаницы в Excel, WhatsApp и десятках чатов.</p>
          <div className={s.heroActions}>
            <Button asChild className={s.primaryButton}><Link href="/register">Попробовать бесплатно <ArrowUpRight /></Link></Button>
            <Button asChild variant="outline" className={s.secondaryButton}><a href="#demo"><Play /> Посмотреть демо</a></Button>
          </div>
          <p className={s.trialNote}><Check size={14} /> 14 дней бесплатно <span>·</span> Карта не требуется</p>
          <div className={s.heroPreview}>
            <div className={s.previewCaption}><span className={s.statusDot} /> Ваш объект. Вся картина.</div>
            <CalendarPreview compact />
          </div>
          <div className={s.audience}><span>Создано для вашего формата</span><p>Посуточные квартиры <i /> Апарт-отели <i /> Небольшие гостиницы</p><a href="#features" aria-label="Перейти к возможностям"><ArrowDown size={18} /></a></div>
        </section>
        <ProblemsSection />
        <FeaturesSection />
        <CalendarSection />
        <ExcelSection />
        <SecuritySection />
        <StepsSection />
        <PricingSection />
        <RoadmapSection />
        <FaqSection />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
