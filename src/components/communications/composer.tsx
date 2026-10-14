"use client";
/* eslint-disable @next/next/no-img-element -- authenticated private images; never expose these through the shared Next image optimizer */
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DocumentSigningPanel } from "@/components/documents/document-signing-panel";
import { renderMessage, STARTER_TEMPLATES, validateFinalMessage } from "@/lib/communications/template";
import type { PreparedMessage, ReservationCommunicationWorkspace } from "@/lib/communications/types";
import { communicationCommand, readApi } from "./api";
import { ErrorNotice, Field, INPUT, SECONDARY_TEXT } from "./fields";

export function CommunicationComposer({ reservationId, open, onOpenChange }: { reservationId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [workspace, setWorkspace] = useState<ReservationCommunicationWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch(`/api/communications?reservationId=${encodeURIComponent(reservationId)}`, { cache: "no-store", signal: controller.signal })
      .then(readApi<ReservationCommunicationWorkspace>).then(setWorkspace)
      .catch((e: unknown) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Не удалось загрузить данные"); });
    return () => { controller.abort(); setWorkspace(null); setError(null); };
  }, [open, reservationId, generation]);
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent data-clarity-mask="true" className="gap-0 [&>button]:size-11 [&>button]:top-[max(env(safe-area-inset-top),12px)] max-sm:!inset-0 max-sm:!h-dvh max-sm:!w-screen max-sm:!max-w-none max-sm:!rounded-none sm:!w-full sm:!max-w-lg">
      <SheetHeader className="shrink-0 border-b pt-[max(env(safe-area-inset-top),16px)] pr-12">
        <SheetTitle>Сообщение гостю</SheetTitle>
        <SheetDescription className={SECONDARY_TEXT}>Текст, фото и ссылка на документ → приложение гостя</SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[max(env(safe-area-inset-bottom),16px)]">
        {workspace ? <ComposerEditor key={workspace.reservationId + workspace.scope} workspace={workspace} /> : error ? <div className="space-y-3"><ErrorNotice message={error} /><Button className="min-h-11" onClick={() => { setError(null); setGeneration((n) => n + 1); }}>Повторить</Button></div> : <p role="status" className="flex items-center gap-2 py-8"><Loader2 className="size-5 animate-spin" />Загружаем данные брони…</p>}
      </div>
    </SheetContent>
  </Sheet>;
}

export function ComposerEditor({ workspace: w }: { workspace: ReservationCommunicationWorkspace }) {
  const firstTemplate = w.templates[0];
  const initial = renderMessage(firstTemplate?.body ?? STARTER_TEMPLATES[0].body, w.values);
  const [body, setBody] = useState(initial.text);
  const [templateId, setTemplateId] = useState(firstTemplate?.id ?? "");
  const [missing, setMissing] = useState(initial.missing);
  const [selected, setSelected] = useState<string[]>([]);
  const [prepared, setPrepared] = useState<PreparedMessage | null>(null);
  const [signingLink, setSigningLink] = useState<{ id: string; url: string } | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestKey = useRef<string | null>(null);
  const finalError = validateFinalMessage(body);
  const supportsFiles = files.length > 0 && typeof navigator !== "undefined" && Boolean(navigator.canShare?.({ files }));
  function resetDraft() { setPrepared(null); setFiles([]); setNotice(null); requestKey.current = null; }
  function selectTemplate(id: string) {
    const template = w.templates.find((item) => item.id === id);
    const result = renderMessage(template?.body ?? STARTER_TEMPLATES[0].body, w.values);
    setTemplateId(id); setBody(result.text); setMissing(result.missing); resetDraft();
  }
  async function prepare() {
    setBusy(true); setError(null); setNotice(null);
    try {
      requestKey.current ??= crypto.randomUUID();
      const draft = await communicationCommand<PreparedMessage>(w.scope, { action: "prepare", reservationId: w.reservationId, ...(templateId ? { templateId } : {}), body, ...(signingLink && body.includes(signingLink.url) ? { signingRequestId: signingLink.id } : {}), photoIds: selected, requestKey: requestKey.current });
      // Load before the sharing tap. Awaiting fetch inside the tap loses user activation on iOS.
      const readyFiles = await Promise.all(draft.photoIds.map(async (id, index) => {
        const response = await fetch(`/api/communications/photos/${encodeURIComponent(id)}?messageId=${encodeURIComponent(draft.id)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Не удалось загрузить фото. Повторите подготовку.");
        return new File([await response.blob()], `apartment-${index + 1}.jpg`, { type: "image/jpeg" });
      }));
      setPrepared(draft); setFiles(readyFiles);
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось подготовить сообщение"); }
    finally { setBusy(false); }
  }
  async function record(state: "MANUAL_WHATSAPP_OPENED" | "SHARE_RETURNED") {
    if (!prepared) return;
    try { await communicationCommand(w.scope, { action: "recordManual", messageId: prepared.id, state }); }
    catch { setError("Действие не записалось в историю. Не отправляйте сообщение повторно, если оно уже отправлено в приложении."); }
  }
  function share() {
    if (!prepared || !navigator.share) return;
    // Must be invoked synchronously from the user's tap; do not await an API here.
    let sharing: Promise<void>;
    try { sharing = navigator.share({ text: prepared.text, ...(supportsFiles ? { files } : {}) }); }
    catch { setError("Меню приложений недоступно. Скопируйте текст и скачайте фото ниже."); return; }
    setBusy(true); setError(null);
    void sharing.then(() => { setNotice("Данные переданы в меню «Поделиться». Доставку и получателя Shanyraq подтвердить не может."); return record("SHARE_RETURNED"); })
      .catch((e: unknown) => { if (!(e instanceof DOMException && e.name === "AbortError")) setError("Не удалось открыть меню приложений. Скопируйте текст и скачайте фото ниже."); })
      .finally(() => setBusy(false));
  }
  function download(index: number) {
    const url = URL.createObjectURL(files[index]);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = files[index].name; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  const supportsShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return <div className="space-y-5">
    <section className="rounded-2xl border bg-accent/40 p-4"><h2 className="font-semibold">{w.guestName}</h2><p className={`mt-1 break-words ${SECONDARY_TEXT}`}>{w.roomName}</p><p className={`mt-1 ${SECONDARY_TEXT}`}>{w.phone ? `+${w.phone}` : "Телефон не указан"}</p></section>
    {!prepared ? <>
    <Field label="Шаблон"><select className={INPUT} value={templateId} disabled={busy} onChange={(e) => selectTemplate(e.target.value)}><option value="">Инструкция заселения</option>{w.templates.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.language.toUpperCase()}</option>)}</select></Field>
    {missing.length ? <p className="rounded-xl border bg-accent/40 p-3 text-sm">Не хватает данных: {missing.join(", ")}. Заполните их в «Коммуникации → Квартиры» или замените переменные в тексте вручную.</p> : null}
    <Field label="Текст для гостя" hint={`${body.length}/4096 · можно изменить только для этой отправки`}><textarea rows={9} maxLength={4096} className={`${INPUT} resize-y leading-relaxed`} value={body} disabled={busy} onChange={(e) => { setBody(e.target.value); resetDraft(); }} /></Field>
    <DocumentSigningPanel reservationId={w.reservationId} scope={w.scope} onLinkCreated={(link) => { setBody((text) => signingLink && text.includes(signingLink.url) ? text.replaceAll(signingLink.url, link.url) : `${text}\n\nОзнакомиться и подписать документ: ${link.url}`); setSigningLink(link); resetDraft(); }} />
    <section className="space-y-2"><h3 className="flex items-center gap-2 text-sm font-semibold"><ImagePlus className="size-4" />Фото квартиры <span className={SECONDARY_TEXT}>· выбрано {selected.length}</span></h3>
      {w.photos.length ? <div className="grid grid-cols-3 gap-2">{w.photos.map((p, i) => <label key={p.id} className="relative overflow-hidden rounded-xl border bg-card focus-within:ring-2 focus-within:ring-primary"><input aria-label={`Добавить фото ${i + 1}`} type="checkbox" className="absolute top-2 left-2 z-10 size-5 accent-[#07866b]" checked={selected.includes(p.id)} disabled={busy} onChange={(e) => { setSelected(e.target.checked ? [...selected, p.id] : selected.filter((id) => id !== p.id)); resetDraft(); }} /><img src={`/api/communications/photos/${p.id}`} alt={`Фото квартиры ${i + 1}`} className="aspect-square w-full object-cover" /><span className="block p-2 text-xs">Фото {i + 1}</span></label>)}</div> : <p className={SECONDARY_TEXT}>Фото ещё не добавлены. Владелец может загрузить их в разделе «Коммуникации».</p>}
    </section>
    </> : null}
    <ErrorNotice message={error} />
    {!prepared ? <Button className="min-h-12 w-full rounded-xl" disabled={busy || Boolean(finalError)} onClick={prepare}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Проверить и подготовить</Button> : <section className="space-y-3 rounded-2xl border bg-card p-4">
      <h3 className="font-semibold">Готово к ручной отправке</h3><p className={SECONDARY_TEXT}>Гость: {w.guestName}{prepared.phone ? `, +${prepared.phone}` : ""}. Получателя выберите и проверьте в приложении.</p>
      <p className="max-h-48 overflow-y-auto rounded-xl bg-accent/40 p-3 text-sm whitespace-pre-wrap break-words">{prepared.text}</p>
      <Button className="min-h-12 w-full rounded-xl" disabled={busy || !supportsShare} onClick={share}><Share2 className="size-4" />Отправить</Button>
      <p className={SECONDARY_TEXT}>{supportsShare ? "Откроется меню приложений: выберите WhatsApp, Telegram или другое доступное приложение, затем нужного гостя." : "Браузер не поддерживает меню приложений. Скопируйте текст и вставьте его в нужный чат вручную."}</p>
      {supportsFiles ? <p className={SECONDARY_TEXT}>Текст и фото передаются вместе, если выбранное приложение это поддерживает. Если текст не появился, скопируйте его отдельно.</p> : files.length ? <p className={SECONDARY_TEXT}>Фото нельзя передать автоматически на этом устройстве. Кнопка «Отправить» передаст текст; скачайте фото ниже и добавьте их в чат вручную.</p> : null}
      <Button variant="outline" className="min-h-11 w-full" onClick={() => { if (!navigator.clipboard) { setError("Выделите текст и скопируйте вручную."); return; } void navigator.clipboard.writeText(prepared.text).then(() => setNotice("Текст скопирован"), () => setError("Не удалось скопировать. Выделите текст и скопируйте вручную.")); }}>Скопировать текст</Button>
      {files.map((file, i) => <Button key={file.name} variant="outline" className="min-h-11 w-full" onClick={() => download(i)}>Скачать фото {i + 1}</Button>)}
      <Button className="min-h-11 w-full" variant="outline" disabled={busy} onClick={resetDraft}>Изменить текст или фото</Button>
    </section>}
    {finalError ? <p className={SECONDARY_TEXT}>{finalError}</p> : null}
    {notice ? <p role="status" className="rounded-xl border bg-accent/50 p-3 text-sm">{notice}</p> : null}
    <p className={SECONDARY_TEXT}>Shanyraq не видит, отправлено ли ручное сообщение. Статусы доставки и прочтения здесь не показываются.</p>
  </div>;
}
