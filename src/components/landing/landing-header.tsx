"use client";

import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { BetaTrigger } from "./beta-trigger";
import s from "./landing.module.css";

export const landingLinks = [["Возможности", "#features"], ["Безопасность", "#security"], ["Тарифы", "#pricing"], ["FAQ", "#faq"]] as const;

export function LandingLogo() {
  return <Link href="/" className={s.logo} aria-label="Shanyraq AI — главная"><BrandLogo className={s.brandLogo} /></Link>;
}

export function LandingHeader() {
  return (
    <header className={s.header}>
      <div className={`${s.container} ${s.headerInner}`}>
        <LandingLogo />
        <nav className={s.desktopNav} aria-label="Основная навигация">{landingLinks.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav>
        <div className={s.headerActions}><Link href="/login" className={s.loginLink}>Войти</Link><BetaTrigger className={`${s.primaryButton} ${s.headerCta}`}>Попробовать бесплатно <ArrowUpRight size={15} /></BetaTrigger></div>
        <details className={s.mobileNav}>
          <summary aria-label="Открыть меню"><Menu size={24} /></summary>
          <nav aria-label="Мобильная навигация" onClick={(event) => { if ((event.target as HTMLElement).closest("a, button")) event.currentTarget.closest("details")?.removeAttribute("open"); }}>
            {landingLinks.map(([label, href]) => <a key={href} href={href}>{label}</a>)}<Link href="/login">Войти в аккаунт</Link><BetaTrigger>Попробовать бесплатно ↗</BetaTrigger>
          </nav>
        </details>
      </div>
    </header>
  );
}
