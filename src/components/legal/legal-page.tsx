import type { ReactNode } from "react";
import Link from "next/link";
import localFont from "next/font/local";
import { BrandLogo } from "@/components/shared/brand-logo";
import { LEGAL_DOCUMENTS, LEGAL_EMAIL, LEGAL_UPDATED_AT } from "@/lib/legal";
import s from "./legal-page.module.css";

const manrope = localFont({ src: "../../assets/fonts/manrope-variable.ttf", display: "swap", weight: "200 800" });

export function LegalPage({ path, title, children }: { path: string; title: string; children: ReactNode }) {
  return (
    <div className={`${s.page} ${manrope.className}`}>
      <header className={s.header}>
        <Link href="/" className={s.logo} aria-label="Shanyraq AI — главная"><BrandLogo className={s.brandLogo} /></Link>
        <Link href="/" className={s.back}>На главную</Link>
      </header>
      <main className={s.main}>
        <h1 className={s.title}>{title}</h1>
        <p className={s.updated}>Редакция от {LEGAL_UPDATED_AT}</p>
        <nav className={s.tabs} aria-label="Юридические документы">
          {LEGAL_DOCUMENTS.map((doc) => <Link key={doc.href} href={doc.href} aria-current={doc.href === path ? "page" : undefined}>{doc.title}</Link>)}
        </nav>
        <article className={s.content}>{children}</article>
        <p className={s.footer}>Вопросы по документам: <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>. Shanyraq AI, г. Астана, Республика Казахстан.</p>
      </main>
    </div>
  );
}

export function LegalTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className={s.tableWrap}>
      <table>
        <thead><tr>{head.map((cell) => <th key={cell}>{cell}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell, i) => <td key={i}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
