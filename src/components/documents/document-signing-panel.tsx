"use client";
import { useEffect, useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readApi } from "@/components/communications/api";
import { ErrorNotice, Field, INPUT, SECONDARY_TEXT } from "@/components/communications/fields";
import type { CreatedSigningLink, SigningWorkspace } from "@/lib/documents/signing/types";
const labels = { PENDING: "Ожидает подписания", SIGNED: "Подтверждено по ссылке", EXPIRED: "Срок истёк", REVOKED: "Ссылка отозвана", OUTDATED: "Бронь изменена — нужна новая ссылка" };
export function DocumentSigningPanel({ reservationId, scope, onLinkCreated }: { reservationId: string; scope: string; onLinkCreated: (link: CreatedSigningLink) => void }) {
  const [data, setData] = useState<SigningWorkspace | null>(null);
  const [documentId, setDocumentId] = useState("");
  const [days, setDays] = useState(7);
  const [link, setLink] = useState<CreatedSigningLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/document-signing?reservationId=${encodeURIComponent(reservationId)}`, { cache: "no-store", signal: c.signal }).then(readApi<SigningWorkspace>).then((d) => { if (d.scope !== scope) throw new Error("Вы сменили объект. Обновите страницу."); setData(d); }).catch((e: unknown) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Не удалось загрузить документы"); });
    return () => c.abort();
  }, [reservationId, scope]);
  async function command<T>(body: unknown) { return readApi<T>(await fetch("/api/document-signing", { method: "POST", headers: { "Content-Type": "application/json", "x-shanyraq-scope": scope }, body: JSON.stringify(body) })); }
  async function reload() { const d = await readApi<SigningWorkspace>(await fetch(`/api/document-signing?reservationId=${encodeURIComponent(reservationId)}`, { cache: "no-store" })); if (d.scope !== scope) throw new Error("Вы сменили объект"); setData(d); }
  async function create() {
    setBusy(true); setError(null);
    try { const l = await command<CreatedSigningLink>({ action: "create", documentId: documentId || data?.documents[0]?.id, expiresInDays: days }); setLink(l); onLinkCreated(l); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось создать ссылку"); }
    finally { setBusy(false); }
  }
  async function revoke(id: string) {
    setBusy(true); setError(null);
    try { await command({ action: "revoke", requestId: id }); if (link?.id === id) setLink(null); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось отозвать ссылку"); }
    finally { setBusy(false); }
  }
  async function receipt(id: string) {
    setBusy(true); setError(null);
    try { const evidence = await command<unknown>({ action: "receipt", requestId: id }); const url = URL.createObjectURL(new Blob([JSON.stringify(evidence, null, 2)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = "signing-receipt.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось скачать подтверждение"); }
    finally { setBusy(false); }
  }
  return <details className="rounded-2xl border bg-card p-4"><summary className="min-h-11 cursor-pointer font-semibold">Документ для онлайн-подписания</summary><div className="mt-3 space-y-4">
    <p className={SECONDARY_TEXT}>Добавьте в сообщение ссылку на уже созданный документ этой брони. Гость откроет полный PDF и подтвердит согласие. Это не ЭЦП и не проверка личности.</p>
    <ErrorNotice message={error} />
    {!data && !error ? <p role="status">Загружаем документы…</p> : data?.documents.length ? <>
      <Field label="Документ"><select className={INPUT} value={documentId || data.documents[0].id} disabled={busy} onChange={(e) => setDocumentId(e.target.value)}>{data.documents.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select></Field>
      <Field label="Срок ссылки"><select className={INPUT} value={days} disabled={busy} onChange={(e) => setDays(Number(e.target.value))}>{[1, 3, 7, 14].map((n) => <option key={n} value={n}>{n} дн.</option>)}</select></Field>
      <p className={SECONDARY_TEXT}>Новая ссылка отменит прежние неподписанные ссылки этого документа. Подписанные подтверждения сохранятся.</p>
      <Button className="min-h-12 w-full rounded-xl" disabled={busy} onClick={create}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}Создать ссылку и добавить в текст</Button>
    </> : data ? <p className={SECONDARY_TEXT}>Сначала создайте PDF через кнопку «Документы» в этой брони, затем заново откройте «Сообщение гостю».</p> : null}
    {link ? <div className="space-y-2 rounded-xl border bg-accent/40 p-3"><p className="text-sm">Ссылка добавлена в редактируемый текст. Действует до {new Date(link.expiresAt).toLocaleString("ru-RU")}.</p><p className="break-all text-sm">{link.url}</p><p className={SECONDARY_TEXT}>Не публикуйте и не пересылайте посторонним: доступ получает любой обладатель ссылки.</p></div> : null}
    {data?.requests.map((r) => <article key={r.id} className="space-y-2 border-t pt-3"><h3 className="font-semibold">{r.title}</h3><p className={SECONDARY_TEXT}>{labels[r.state]}{r.signedAt ? ` · ${r.signerName} · ${new Date(r.signedAt).toLocaleString("ru-RU")}` : ` · до ${new Date(r.expiresAt).toLocaleString("ru-RU")}`}</p>{r.state === "PENDING" ? <Button variant="outline" className="min-h-11 w-full" disabled={busy} onClick={() => { if (window.confirm("Отозвать ссылку? Она перестанет открываться у гостя.")) void revoke(r.id); }}>Отозвать ссылку</Button> : null}{r.signedAt ? <Button variant="outline" className="min-h-11 w-full" disabled={busy} onClick={() => receipt(r.id)}>Скачать подтверждение</Button> : null}</article>)}
  </div></details>;
}
