"use client";

import { ArrowUpRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LandingLogo, landingLinks } from "./landing-header";
import s from "./landing.module.css";

function LegalDocumentLink({ title }: { title: string }) {
  return <Dialog><DialogTrigger className={s.legalLink}>{title}</DialogTrigger><DialogContent className={s.legalDialog}><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Запросить документ или задать вопросы об условиях работы с Shanyraq AI можно по электронной почте.</DialogDescription></DialogHeader><a href={`mailto:hello@shanyraq.ai?subject=${encodeURIComponent(title)}`}>hello@shanyraq.ai <ArrowUpRight size={16} /></a><p>Юридические документы не предоставлены для публикации на этой странице.</p></DialogContent></Dialog>;
}

export function LandingFooter() {
  return <footer className={`${s.container} ${s.footer}`}><div className={s.footerTop}><div><LandingLogo /><p>Ваш объект. Ваш порядок.<br />Ваш Shanyraq.</p></div><nav aria-label="Навигация в подвале">{landingLinks.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav><div className={s.footerContact}><span>Давайте оставаться на связи</span><a href="mailto:hello@shanyraq.ai">hello@shanyraq.ai <ArrowUpRight size={15} /></a><small>С заботой о вашем бизнесе, из Казахстана.</small></div></div><div className={s.footerBottom}><p>© 2026 Shanyraq AI. Казахстан.</p><div><LegalDocumentLink title="Политика конфиденциальности" /><LegalDocumentLink title="Условия использования" /></div></div></footer>;
}
