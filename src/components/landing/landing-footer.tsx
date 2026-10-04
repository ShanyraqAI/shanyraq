"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { LEGAL_DOCUMENTS } from "@/lib/legal";
import { LandingLogo, landingLinks } from "./landing-header";
import s from "./landing.module.css";

export function LandingFooter() {
  return <footer className={`${s.container} ${s.footer}`}><div className={s.footerTop}><div><LandingLogo /><p>Ваш объект. Ваш порядок.<br />Ваш Shanyraq.</p></div><nav aria-label="Навигация в подвале">{landingLinks.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav><div className={s.footerContact}><span>Давайте оставаться на связи</span><a href="mailto:hello@shanyraq.ai">hello@shanyraq.ai <ArrowUpRight size={15} /></a><small>С заботой о вашем бизнесе, из Казахстана.</small></div></div><div className={s.footerBottom}><p>© 2026 Shanyraq AI. Астана, Казахстан.</p><div>{LEGAL_DOCUMENTS.map((doc) => <Link key={doc.href} href={doc.href} className={s.legalLink}>{doc.title}</Link>)}</div></div></footer>;
}
