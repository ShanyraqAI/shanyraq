"use client";
import { useEffect, useState } from "react";
import { FileText, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorNotice, Field, INPUT, SECONDARY_TEXT } from "@/components/communications/fields";
import { readApi } from "@/components/communications/api";
import type { GuestDocumentVM } from "@/lib/documents/signing/types";
async function request(token: string, action: string, extra: Record<string, unknown> = {}) { return fetch("/api/guest/documents", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, action, ...extra }) }); }
export function GuestDocumentSigning() {
  const [token, setToken] = useState("");
  const [document, setDocument] = useState<GuestDocumentVM | null>(null);
  const [pdf, setPdf] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const [name, setName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [intent, setIntent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true; let url: string | undefined;
    const capability = window.location.hash.slice(1);
    void (async () => {
      if (!/^[a-f0-9]{64}$/.test(capability)) throw new Error("Ссылка неполная. Откройте её целиком из сообщения владельца.");
      const data = await readApi<GuestDocumentVM>(await request(capability, "load"));
      const response = await request(capability, "pdf");
      if (!response.ok) { await readApi(response); throw new Error("PDF недоступен"); }
      url = URL.createObjectURL(await response.blob());
      if (active) { setToken(capability); setDocument(data); setPdf(url); } else URL.revokeObjectURL(url);
    })().catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "Не удалось открыть документ"); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, []);
  async function sign() {
    if (!document || !opened || !accepted || !intent) return;
    setBusy(true); setError(null);
    try { setDocument(await readApi<GuestDocumentVM>(await request(token, "sign", { signerName: name, accepted, intent, pdfHash: document.pdfHash, consentVersion: document.consentVersion }))); }
    catch (e) { setError(e instanceof Error ? e.message : "Подписание не завершено. Повторите с тем же именем."); }
    finally { setBusy(false); }
  }
  async function receipt() {
    setBusy(true); setError(null);
    try { const response = await request(token, "receipt"); if (!response.ok) { await readApi(response); return; } const url = URL.createObjectURL(await response.blob()); const a = window.document.createElement("a"); a.href = url; a.download = "signing-receipt.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось скачать подтверждение"); }
    finally { setBusy(false); }
  }
  return <main data-dashboard-theme data-clarity-mask="true" className="mx-auto min-h-dvh max-w-xl space-y-5 px-4 pt-[max(env(safe-area-inset-top),24px)] pb-[max(env(safe-area-inset-bottom),24px)]">
    <header className="space-y-2"><p className="text-sm font-semibold text-primary">Shanyraq</p><h1 className="text-2xl font-semibold">Ознакомление и подписание</h1><p className={SECONDARY_TEXT}>Откройте полный документ, проверьте данные и подтвердите своё решение.</p></header>
    <ErrorNotice message={error} />
    {!document && !error ? <p role="status" className="flex gap-2"><Loader2 className="size-5 animate-spin" />Загружаем документ…</p> : null}
    {document ? <section className="space-y-5 rounded-2xl border bg-card p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><FileText className="size-5" />{document.title}</h2>
      <p className={SECONDARY_TEXT}>Ссылка действует до {new Date(document.expiresAt).toLocaleString("ru-RU")}. Не пересылайте её посторонним.</p>
      {pdf ? <Button asChild className="min-h-12 w-full rounded-xl"><a href={pdf} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(true)}>Открыть полный PDF</a></Button> : null}
      {document.signedAt ? <>
        <p role="status" className="flex gap-2 rounded-xl border bg-accent/40 p-3"><Check className="size-5 shrink-0" />Подписание подтверждено: {document.signerName}, {new Date(document.signedAt).toLocaleString("ru-RU")}.</p>
        <p className={SECONDARY_TEXT}>Исходный PDF сохранён без изменений. Подтверждение согласия хранится отдельно.</p>
        <Button variant="outline" className="min-h-11 w-full" disabled={busy} onClick={receipt}>Скачать подтверждение</Button>
      </> : <>
        <Field label="Ваше полное имя"><input autoComplete="name" className={INPUT} value={name} maxLength={160} disabled={busy} onChange={(e) => setName(e.target.value)} /></Field>
        <label className="flex min-h-11 gap-3 text-sm leading-relaxed"><input type="checkbox" className="mt-1 size-5 shrink-0 accent-[#07866b]" checked={accepted} disabled={busy || !opened} onChange={(e) => setAccepted(e.target.checked)} />Я открыл(а) полный PDF, ознакомился(ась) с ним и согласен(на) с его условиями.</label>
        <label className="flex min-h-11 gap-3 text-sm leading-relaxed"><input type="checkbox" className="mt-1 size-5 shrink-0 accent-[#07866b]" checked={intent} disabled={busy || !opened} onChange={(e) => setIntent(e.target.checked)} />Я намерен(на) подписать этот документ онлайн указанным мной именем.</label>
        <p className="rounded-xl border bg-accent/40 p-3 text-sm leading-relaxed">{document.consentText}</p>
        {!opened ? <p className={SECONDARY_TEXT}>Сначала откройте полный PDF.</p> : null}
        <Button className="min-h-12 w-full rounded-xl" disabled={busy || !opened || !accepted || !intent || name.trim().length < 2} onClick={sign}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Подтвердить подписание</Button>
      </>}
      <p className={`break-all text-sm ${SECONDARY_TEXT}`}>SHA-256 исходного PDF: {document.pdfHash}</p>
    </section> : null}
    <p className={SECONDARY_TEXT}>Это подтверждение по защищённой ссылке, не ЭЦП. Личность подписанта независимо не проверяется. Если данные неверны, не подписывайте документ — свяжитесь с владельцем.</p>
  </main>;
}
