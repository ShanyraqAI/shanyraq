"use client";
/* eslint-disable @next/next/no-img-element -- private authenticated images must not use the shared image optimizer */
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Copy, FileText, ImagePlus, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DocumentSigningPanel } from "@/components/documents/document-signing-panel";
import { STARTER_TEMPLATES, validateFinalMessage } from "@/lib/communications/template";
import { AUTOMATIC_TEMPLATE, resolveDraftTemplate, withDocumentLink } from "@/lib/communications/draft";
import { recallComposer, rememberComposer } from "@/lib/communications/composer-memory";
import type { PreparedMessage, ReservationCommunicationWorkspace } from "@/lib/communications/types";
import type { CreatedSigningLink } from "@/lib/documents/signing/types";
import { communicationCommand, readApi } from "./api";
import { ErrorNotice, Field, INPUT, SECONDARY_TEXT } from "./fields";
import { LoadFailure } from "./load-failure";
import { StepProgress } from "./step-progress";
const STEPS = ["Сообщение", "Проверка"] as const;
export function CommunicationComposer({ reservationId, open, onOpenChange }: { reservationId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [workspace, setWorkspace] = useState<ReservationCommunicationWorkspace | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [generation, setGeneration] = useState(0);
  const dirty = useRef(false);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch(`/api/communications?reservationId=${encodeURIComponent(reservationId)}`, { cache: "no-store", signal: controller.signal })
      .then(readApi<ReservationCommunicationWorkspace>).then((data) => { if (!controller.signal.aborted) setWorkspace(data); })
      .catch((e: unknown) => { if (!controller.signal.aborted) setError(e); });
    return () => { controller.abort(); setWorkspace(null); setError(null); };
  }, [open, reservationId, generation]);
  function changeOpen(next: boolean) {
    if (!next && dirty.current && !window.confirm("Закрыть редактор? Текст и выбранные фото останутся в памяти этой вкладки на 15 минут. Ссылку на документ потребуется подготовить заново.")) return;
    onOpenChange(next);
  }
  return <Sheet open={open} onOpenChange={changeOpen}>
    <SheetContent data-clarity-mask="true" className="[--muted-foreground:#52645a] dark:[--muted-foreground:#b4c5ba] gap-0 [&>button]:size-11 [&>button]:top-[max(env(safe-area-inset-top),12px)] max-sm:!inset-0 max-sm:!h-dvh max-sm:!w-screen max-sm:!max-w-none max-sm:!rounded-none sm:!w-full sm:!max-w-lg">
      <SheetHeader className="shrink-0 border-b pt-[max(env(safe-area-inset-top),16px)] pr-12"><SheetTitle>Сообщение гостю</SheetTitle><SheetDescription className="sr-only">Подготовьте сообщение и проверьте перед передачей в приложение.</SheetDescription></SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col">
        {workspace?.reservationId === reservationId ? <ComposerEditor key={workspace.draftScope ?? workspace.reservationId + workspace.scope} workspace={workspace} onDirtyChange={(value) => { dirty.current = value; }} /> : error ? <div className="overflow-y-auto p-4"><LoadFailure error={error} onRetry={() => { setError(null); setGeneration((n) => n + 1); }} /></div> : <p role="status" className="flex items-center gap-2 p-4 py-8"><Loader2 className="size-5 animate-spin" />Загружаем данные брони…</p>}
      </div>
    </SheetContent>
  </Sheet>;
}
export function ComposerEditor({ workspace: w, onDirtyChange }: { workspace: ReservationCommunicationWorkspace; onDirtyChange?: (value: boolean) => void }) {
  const [restored] = useState(() => recallComposer(w.draftScope ?? ""));
  const initialTemplate = restored?.templateId ?? w.templates[0]?.id ?? AUTOMATIC_TEMPLATE;
  const [step, setStep] = useState(1);
  const [templateId, setTemplateId] = useState(initialTemplate);
  const [customText, setCustomText] = useState(() => restored?.text ?? resolveDraftTemplate(initialTemplate, w.templates, w.values).text);
  const [selected, setSelected] = useState<string[]>(() => (restored?.photoIds ?? []).filter((id) => w.photos.some((photo) => photo.id === id)));
  const [attachment, setAttachment] = useState<"photos" | "document" | null>(null);
  const [documentEnabled, setDocumentEnabled] = useState(false);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [signingLink, setSigningLink] = useState<CreatedSigningLink | null>(null);
  const [prepared, setPrepared] = useState<PreparedMessage | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(restored ? "Черновик восстановлен. Проверьте актуальные даты, текст и вложения." : null);
  const requestKey = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const ready = resolveDraftTemplate(templateId, w.templates, w.values);
  const baseText = customText;
  const body = withDocumentLink(baseText, documentEnabled ? signingLink?.url : undefined);
  const finalError = validateFinalMessage(baseText) ?? validateFinalMessage(body);
  const supportsShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const supportsFiles = Boolean(prepared && files.length && typeof navigator !== "undefined" && navigator.canShare?.({ text: prepared.text, files }));
  const locked = busy || documentBusy;
  const dirty = customText !== ready.text || selected.length > 0 || documentEnabled;
  useEffect(() => { heading.current?.focus({ preventScroll: true }); heading.current?.closest("[data-communication-scroll]")?.scrollTo({ top: 0 }); }, [step]);
  useEffect(() => { rememberComposer(w.draftScope ?? "", { text: customText, templateId, photoIds: selected }); }, [w.draftScope, customText, templateId, selected]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  function resetDraft() { setPrepared(null); setFiles([]); setNotice(null); setError(null); requestKey.current = null; }
  function changeStep(next: number) { if (next === 1) resetDraft(); setStep(next); }
  function changeTemplate(id: string) {
    if (customText !== ready.text && !window.confirm("Заменить изменённый текст выбранным шаблоном?")) return;
    setTemplateId(id); setCustomText(resolveDraftTemplate(id, w.templates, w.values).text); resetDraft();
  }
  async function prepare() {
    if (finalError || (documentEnabled && !signingLink)) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      requestKey.current ??= crypto.randomUUID();
      const draft = await communicationCommand<PreparedMessage>(w.scope, { action: "prepare", reservationId: w.reservationId, ...(baseText === ready.text && ready.savedId ? { templateId: ready.savedId } : {}), body, photoIds: selected, ...(documentEnabled && signingLink ? { signingRequestId: signingLink.id } : {}), requestKey: requestKey.current });
      // Preload before the user's sharing tap: an awaited fetch in the tap loses iOS activation.
      const readyFiles = await Promise.all(draft.photoIds.map(async (id, index) => {
        const response = await fetch(`/api/communications/photos/${encodeURIComponent(id)}?messageId=${encodeURIComponent(draft.id)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Фото не загрузились. Повторите подготовку или отправьте без фото.");
        return new File([await response.blob()], `apartment-${index + 1}.jpg`, { type: "image/jpeg" });
      }));
      setPrepared(draft); setFiles(readyFiles); setStep(2);
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось подготовить сообщение. Ваш текст сохранён в открытом редакторе."); }
    finally { setBusy(false); }
  }
  function share() {
    if (!prepared || !navigator.share) return;
    let sharing: Promise<void>;
    try { sharing = navigator.share({ text: prepared.text, ...(supportsFiles ? { files } : {}) }); }
    catch { setError("Меню приложений недоступно. Скопируйте текст и скачайте фото ниже."); return; }
    setBusy(true); setError(null);
    void sharing.then(async () => {
      setNotice("Меню приложений закрыто. Shanyraq не может подтвердить получателя и доставку сообщения.");
      try { await communicationCommand(w.scope, { action: "recordManual", messageId: prepared.id, state: "SHARE_RETURNED" }); }
      catch { setError("Не удалось обновить историю. Не отправляйте повторно, если сообщение уже отправлено."); }
    }).catch((e: unknown) => { if (!(e instanceof DOMException && e.name === "AbortError")) setError("Не удалось открыть меню приложений. Скопируйте текст и скачайте фото ниже."); }).finally(() => setBusy(false));
  }
  function copy() {
    if (!prepared) return;
    if (!navigator.clipboard) { setError("Выделите текст в предпросмотре и скопируйте его вручную."); return; }
    void navigator.clipboard.writeText(prepared.text).then(() => setNotice("Текст скопирован. Вставьте его в чат нужного гостя."), () => setError("Не удалось скопировать. Выделите текст и скопируйте вручную."));
  }
  function download(index: number) { const url = URL.createObjectURL(files[index]); const a = document.createElement("a"); a.href = url; a.download = files[index].name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
  return <div className="flex min-h-0 flex-1 flex-col">
    <div data-communication-scroll className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
      <section className="space-y-1 border-b pb-3"><h2 className="break-words text-base font-semibold">{w.guestName}</h2><p className="break-words text-sm text-muted-foreground">{w.roomName} · {w.values.checkin_date}–{w.values.checkout_date}</p>{w.phone ? <p className="break-all text-sm text-muted-foreground">+{w.phone}</p> : null}</section>
      <StepProgress step={step} labels={STEPS} />
      <h2 ref={heading} tabIndex={-1} className="sr-only outline-none">{step === 1 ? "Сообщение" : "Проверка сообщения"}</h2>
      {step === 1 ? <>
        <Field label="Сообщение" hint={`${body.length}/4096`}><textarea rows={9} className={`${INPUT} resize-y leading-relaxed`} maxLength={4096} value={customText} disabled={locked} onChange={(e) => { setCustomText(e.target.value); resetDraft(); }} /></Field>
        <div className="flex flex-wrap gap-2" aria-label="Вложения"><Button variant="outline" className="min-h-11" disabled={locked} aria-expanded={attachment === "photos"} onClick={() => setAttachment(attachment === "photos" ? null : "photos")}><ImagePlus className="size-4" />Фото{selected.length ? ` · ${selected.length}` : ""}</Button><Button variant="outline" className="min-h-11" disabled={locked} aria-expanded={attachment === "document"} onClick={() => setAttachment(attachment === "document" ? null : "document")}><FileText className="size-4" />Документ</Button><a href={`/dashboard/reservations/${encodeURIComponent(w.reservationId)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center px-2 text-sm text-primary underline" title="Открыть бронирование в новой вкладке">Запрос оплаты — из брони</a></div>
        {attachment === "photos" ? <section className="space-y-3 border-y py-4"><h3 className="text-base font-semibold">Фото квартиры</h3>{w.photos.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{w.photos.map((photo, index) => <label key={photo.id} className="relative min-h-11 cursor-pointer overflow-hidden rounded-xl border focus-within:ring-2 focus-within:ring-primary"><input aria-label={`Добавить фото ${index + 1}`} type="checkbox" className="absolute top-2 left-2 z-10 size-6 accent-primary" checked={selected.includes(photo.id)} disabled={locked} onChange={(e) => { setSelected(e.target.checked ? [...selected, photo.id] : selected.filter((id) => id !== photo.id)); resetDraft(); }} /><img src={`/api/communications/photos/${encodeURIComponent(photo.id)}`} alt={`Фото квартиры ${index + 1}`} loading="lazy" className="aspect-square w-full object-cover" /><span className="block p-3 text-sm">Фото {index + 1}</span></label>)}</div> : <p className={SECONDARY_TEXT}>Доступных фотографий нет. Можно подготовить только текст.</p>}</section> : null}
        {attachment === "document" ? <section className="space-y-3 border-y py-4"><label className="flex min-h-11 items-center gap-3 text-base"><input type="checkbox" className="size-5 accent-primary" checked={documentEnabled} disabled={locked} onChange={(e) => { setDocumentEnabled(e.target.checked); resetDraft(); }} />Добавить ссылку на документ</label><p className={SECONDARY_TEXT}>Ознакомление и подтверждение по ссылке с вводом имени. Личность не проверяется; это не SMS и не ЭЦП.</p>{documentEnabled ? <DocumentSigningPanel reservationId={w.reservationId} scope={w.scope} inline onBusyChange={setDocumentBusy} onLinkCleared={() => { setSigningLink(null); resetDraft(); }} onLinkCreated={(link) => { setSigningLink(link); resetDraft(); }} /> : null}</section> : null}
        {documentEnabled ? <p role="status" className="break-words text-sm">{signingLink ? `К сообщению добавится ссылка: ${signingLink.title}.` : "Подготовьте ссылку в разделе «Документ» или отключите её добавление."}</p> : null}
        <details><summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">Выбрать другой шаблон</summary><Field label="Шаблон"><select className={INPUT} value={templateId} disabled={locked} onChange={(e) => changeTemplate(e.target.value)}><optgroup label="Стандартные тексты">{STARTER_TEMPLATES.map((t, i) => <option key={t.name} value={`starter:${i}`}>{t.name}</option>)}</optgroup>{w.templates.length ? <optgroup label="Мои шаблоны">{w.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup> : null}</select></Field></details>
      </> : prepared ? <>
        <section className="space-y-3 rounded-xl border bg-card p-4"><h3 className="text-sm font-semibold">Итоговый текст</h3><p className="whitespace-pre-wrap break-words text-base leading-relaxed" aria-label="Сообщение перед отправкой">{prepared.text}</p><p className="border-t pt-3 text-sm text-muted-foreground">{prepared.phone ? `Контакт гостя: +${prepared.phone}. ` : "Телефон гостя не указан. "}Приложение и получателя вы выбираете сами.</p></section>
        {files.length ? <section className="space-y-2"><h3 className="text-base font-semibold">Выбранные фотографии · {files.length}</h3>{prepared.photoIds.map((id, index) => <div key={id} className="flex min-w-0 items-center gap-3 border-b py-2"><img src={`/api/communications/photos/${encodeURIComponent(id)}?messageId=${encodeURIComponent(prepared.id)}`} alt={`Вложение ${index + 1}`} className="size-16 shrink-0 rounded-lg object-cover" /><Button variant="outline" className="min-h-11 min-w-0" onClick={() => download(index)}>Скачать фото {index + 1}</Button></div>)}</section> : <p className={SECONDARY_TEXT}>Без фотографий</p>}
        {documentEnabled && signingLink ? <p className="break-words text-sm">Документ: {signingLink.title} · ссылка в тексте</p> : null}
        {files.length && !supportsFiles ? <p className="rounded-xl border p-3 text-sm">Это устройство передаст только текст. Скачайте выбранные фото и прикрепите их вручную.</p> : null}
        {supportsFiles ? <p className={SECONDARY_TEXT}>Приложение может принять текст и фото вместе. Проверьте вложения в выбранном чате.</p> : null}
        {supportsShare ? <Button variant="outline" className="min-h-11 w-full" disabled={locked} onClick={copy}><Copy className="size-4" />Скопировать текст</Button> : null}
        <p className={SECONDARY_TEXT}>Открытие приложения не подтверждает отправку, доставку или оплату.</p>
      </> : null}
      <ErrorNotice message={error || (baseText.trim() && finalError ? finalError : null)} />
      {notice ? <p role="status" className="rounded-xl border p-3 text-sm">{notice}</p> : null}
    </div>
    <footer className="shrink-0 space-y-2 border-t bg-background p-4 pb-[max(env(safe-area-inset-bottom),16px)]"><div className="flex flex-wrap gap-2">{step === 2 ? <Button variant="outline" className="min-h-12" disabled={locked} onClick={() => changeStep(1)}><ArrowLeft className="size-4" />Назад</Button> : null}{step === 1 ? <Button className="min-h-12 min-w-0 flex-1 rounded-xl hover:bg-[#06745d] dark:hover:bg-primary" disabled={locked || Boolean(finalError) || (documentEnabled && !signingLink)} onClick={prepare}>{locked ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Проверить сообщение</Button> : <Button className="min-h-12 min-w-0 flex-1 rounded-xl hover:bg-[#06745d] dark:hover:bg-primary max-[360px]:basis-full" disabled={locked || !prepared} onClick={supportsShare ? share : copy}>{locked ? <Loader2 className="size-4 animate-spin" /> : supportsShare ? <Share2 className="size-4" /> : <Copy className="size-4" />}{supportsShare ? "Выбрать приложение" : "Скопировать текст"}</Button>}</div><p className={`text-center ${SECONDARY_TEXT}`}>{step === 1 ? "Пока ничего не отправляем" : "Проверьте получателя в выбранном приложении"}</p></footer>
  </div>;
}
