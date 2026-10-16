"use client";
/* eslint-disable @next/next/no-img-element -- private authenticated images must not use the shared image optimizer */
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, ImagePlus, Loader2, Pencil, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DocumentSigningPanel } from "@/components/documents/document-signing-panel";
import { STARTER_TEMPLATES, VARIABLES, validateFinalMessage } from "@/lib/communications/template";
import { AUTOMATIC_TEMPLATE, resolveDraftTemplate, withDocumentLink } from "@/lib/communications/draft";
import type { PreparedMessage, ReservationCommunicationWorkspace } from "@/lib/communications/types";
import type { CreatedSigningLink } from "@/lib/documents/signing/types";
import { communicationCommand, readApi } from "./api";
import { ErrorNotice, Field, INPUT, SECONDARY_TEXT } from "./fields";
import { LoadFailure } from "./load-failure";
import { StepProgress } from "./step-progress";
const STEPS = ["Текст", "Дополнения", "Отправка"] as const;
export function CommunicationComposer({ reservationId, open, onOpenChange }: { reservationId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [workspace, setWorkspace] = useState<ReservationCommunicationWorkspace | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch(`/api/communications?reservationId=${encodeURIComponent(reservationId)}`, { cache: "no-store", signal: controller.signal })
      .then(readApi<ReservationCommunicationWorkspace>).then((data) => { if (!controller.signal.aborted) setWorkspace(data); })
      .catch((e: unknown) => { if (!controller.signal.aborted) setError(e); });
    return () => { controller.abort(); setWorkspace(null); setError(null); };
  }, [open, reservationId, generation]);
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent data-clarity-mask="true" className="gap-0 [&>button]:size-11 [&>button]:top-[max(env(safe-area-inset-top),12px)] max-sm:!inset-0 max-sm:!h-dvh max-sm:!w-screen max-sm:!max-w-none max-sm:!rounded-none sm:!w-full sm:!max-w-lg">
      <SheetHeader className="shrink-0 border-b pt-[max(env(safe-area-inset-top),16px)] pr-12"><SheetTitle>Сообщение гостю</SheetTitle><SheetDescription className={SECONDARY_TEXT}>Подготовьте текст, добавьте вложения и отправьте гостю</SheetDescription></SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col">
        {workspace ? <ComposerEditor key={workspace.reservationId + workspace.scope} workspace={workspace} /> : error ? <div className="overflow-y-auto p-4"><LoadFailure error={error} onRetry={() => { setError(null); setGeneration((n) => n + 1); }} /></div> : <p role="status" className="flex items-center gap-2 p-4 py-8"><Loader2 className="size-5 animate-spin" />Загружаем данные брони…</p>}
      </div>
    </SheetContent>
  </Sheet>;
}
export function ComposerEditor({ workspace: w }: { workspace: ReservationCommunicationWorkspace }) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<"default" | "custom">("default");
  const [templateId, setTemplateId] = useState(w.templates[0]?.id ?? AUTOMATIC_TEMPLATE);
  const [customText, setCustomText] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [documentEnabled, setDocumentEnabled] = useState(false);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [signingLink, setSigningLink] = useState<CreatedSigningLink | null>(null);
  const [prepared, setPrepared] = useState<PreparedMessage | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestKey = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const ready = resolveDraftTemplate(templateId, w.templates, w.values);
  const baseText = mode === "default" ? ready.text : customText;
  const body = withDocumentLink(baseText, documentEnabled ? signingLink?.url : undefined);
  const finalError = validateFinalMessage(baseText) ?? validateFinalMessage(body);
  const supportsShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const supportsFiles = Boolean(prepared && files.length && typeof navigator !== "undefined" && navigator.canShare?.({ text: prepared.text, files }));
  const locked = busy || documentBusy;
  useEffect(() => { heading.current?.focus({ preventScroll: true }); heading.current?.closest("[data-communication-scroll]")?.scrollTo({ top: 0 }); }, [step]);
  function resetDraft() { setPrepared(null); setFiles([]); setNotice(null); setError(null); requestKey.current = null; }
  function changeStep(next: number) { if (next !== 3) resetDraft(); setStep(next); }
  function openCustom() { setMode("custom"); resetDraft(); requestAnimationFrame(() => textarea.current?.focus()); }
  function copyReadyText() { setCustomText(baseText); openCustom(); }
  function editReadyText() { copyReadyText(); }
  async function prepare() {
    if (finalError || (documentEnabled && !signingLink)) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      requestKey.current ??= crypto.randomUUID();
      const draft = await communicationCommand<PreparedMessage>(w.scope, { action: "prepare", reservationId: w.reservationId, ...(mode === "default" && ready.savedId ? { templateId: ready.savedId } : {}), body, photoIds: selected, ...(documentEnabled && signingLink ? { signingRequestId: signingLink.id } : {}), requestKey: requestKey.current });
      // Preload before the user's sharing tap: an awaited fetch in the tap loses iOS activation.
      const readyFiles = await Promise.all(draft.photoIds.map(async (id, index) => {
        const response = await fetch(`/api/communications/photos/${encodeURIComponent(id)}?messageId=${encodeURIComponent(draft.id)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Фото не загрузились. Повторите подготовку или отправьте без фото.");
        return new File([await response.blob()], `apartment-${index + 1}.jpg`, { type: "image/jpeg" });
      }));
      setPrepared(draft); setFiles(readyFiles); setStep(3);
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
    <div data-communication-scroll className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
    <section className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b pb-2 text-xs"><h2 className="text-sm font-medium">{w.guestName}</h2><p className="break-words text-muted-foreground">{w.roomName}{w.phone ? ` · +${w.phone}` : ""}</p></section>
    <StepProgress step={step} labels={STEPS} />
    <div className="flex-1 space-y-4">
      <header><h2 ref={heading} tabIndex={-1} className="mt-1 text-lg font-semibold outline-none">{step === 1 ? "Текст сообщения" : step === 2 ? "Добавьте по желанию" : "Проверьте сообщение"}</h2><p className={`mt-2 ${SECONDARY_TEXT}`}>{step === 1 ? "Можно оставить готовый текст, изменить его или написать с нуля." : step === 2 ? "Фото и документ необязательны. Можно сразу перейти к проверке." : "Выберите приложение и получателя сами — перед отправкой проверьте чат."}</p></header>
      {step === 1 ? <>
        {mode === "default" ? <>
          <Field label="Шаблон"><select className={INPUT} value={templateId} disabled={locked} onChange={(e) => { setTemplateId(e.target.value); resetDraft(); }}><optgroup label="Стандартные тексты">{STARTER_TEMPLATES.map((t, i) => <option key={t.name} value={`starter:${i}`}>{i === 0 ? "Инструкция заселения · стандартная" : t.name}</option>)}</optgroup>{w.templates.length ? <optgroup label="Мои шаблоны">{w.templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? " · по умолчанию" : ""}</option>)}</optgroup> : null}</select></Field>
          <section className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-xs font-medium text-muted-foreground">Сообщение</h3><Button variant="ghost" size="icon" aria-label="Редактировать сообщение" title="Редактировать сообщение" disabled={locked} onClick={editReadyText}><Pencil className="size-4" /></Button></div>
            <p className="text-base leading-relaxed whitespace-pre-wrap break-words" aria-label="Предпросмотр готового текста">{baseText}</p>
          </section>
          {ready.missing.length || ready.unknown.length ? <p className="rounded-xl border bg-accent/40 p-3 text-sm">Не хватает данных: {[...ready.missing, ...ready.unknown].map((key) => VARIABLES[key as keyof typeof VARIABLES] ?? key).join(", ")}. Измените текст кнопкой с карандашом или заполните данные квартиры.</p> : templateId === AUTOMATIC_TEMPLATE && (!w.values.property_address || !w.values.key_instructions) ? <p className={SECONDARY_TEXT}>Адрес и получение ключей добавятся, когда вы заполните их в данных квартиры. Сейчас в тексте только известная информация.</p> : <p className={SECONDARY_TEXT}>Всё уже заполнено. Если текст подходит, нажмите «Далее».</p>}
        </> : <Field label="Текст для гостя" hint={`${body.length}/4096 · меняется только это сообщение, не сохранённый шаблон`}><textarea ref={textarea} rows={8} className={`${INPUT} resize-y leading-relaxed`} maxLength={4096} placeholder="Напишите гостю своими словами…" value={customText} disabled={locked} onChange={(e) => { setCustomText(e.target.value); resetDraft(); }} /></Field>}
        {mode === "custom" && !customText.trim() ? <p className={SECONDARY_TEXT}>Напишите сообщение гостю. Изменения касаются только этой отправки.</p> : null}
      </> : null}
      {step === 2 ? <>
        <section className="space-y-3 rounded-2xl border bg-card p-4"><h3 className="flex items-center gap-2 font-semibold"><ImagePlus className="size-5" />Фото квартиры <span className={SECONDARY_TEXT}>· {selected.length} выбрано</span></h3>
          {w.photos.length ? <div className="grid grid-cols-3 gap-2">{w.photos.map((p, i) => <label key={p.id} className="relative cursor-pointer overflow-hidden rounded-xl border focus-within:ring-2 focus-within:ring-primary"><input aria-label={`Добавить фото ${i + 1}`} type="checkbox" className="absolute top-2 left-2 z-10 size-5 accent-[#07866b]" checked={selected.includes(p.id)} disabled={locked} onChange={(e) => { setSelected(e.target.checked ? [...selected, p.id] : selected.filter((id) => id !== p.id)); resetDraft(); }} /><img src={`/api/communications/photos/${p.id}`} alt={`Фото квартиры ${i + 1}`} className="aspect-square w-full object-cover" /><span className="block p-2 text-sm">Фото {i + 1}</span></label>)}</div> : <p className={SECONDARY_TEXT}>Фото пока нет. Можно отправить только текст; фотографии владелец добавляет в данных квартиры.</p>}
        </section>
        <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border bg-card p-4"><input type="checkbox" className="mt-1 size-5 shrink-0 accent-[#07866b]" checked={documentEnabled} disabled={locked} onChange={(e) => { setDocumentEnabled(e.target.checked); resetDraft(); }} /><span><span className="block font-semibold">Добавить ссылку на документ</span><span className={`mt-1 block ${SECONDARY_TEXT}`}>Гость сможет открыть PDF и подтвердить подписание по ссылке. Не ЭЦП.</span></span></label>
        {documentEnabled ? <><DocumentSigningPanel reservationId={w.reservationId} scope={w.scope} inline onBusyChange={setDocumentBusy} onLinkCreated={(link) => { setSigningLink(link); resetDraft(); }} />{signingLink ? <p role="status" className="rounded-xl border bg-accent/40 p-3 text-sm">Ссылка на {signingLink.title} будет добавлена к сообщению. До {new Date(signingLink.expiresAt).toLocaleString("ru-RU")}.</p> : <p className={SECONDARY_TEXT}>Создайте ссылку выше или отключите добавление документа.</p>}</> : null}
      </> : null}
      {step === 3 && prepared ? <>
        <section className="space-y-3 rounded-2xl border bg-card p-4"><div className="flex items-center justify-between gap-2"><h3 className="text-xs font-medium text-muted-foreground">Сообщение</h3><Button variant="ghost" size="icon" aria-label="Редактировать сообщение" title="Редактировать сообщение" disabled={locked} onClick={() => { changeStep(1); if (mode === "default") editReadyText(); }}><Pencil className="size-4" /></Button></div><p className="text-base leading-relaxed whitespace-pre-wrap break-words" aria-label="Сообщение перед отправкой">{prepared.text}</p><div className={`flex flex-wrap gap-2 border-t pt-3 ${SECONDARY_TEXT}`}><span>{files.length ? `Фото: ${files.length}` : "Без фото"}</span><span>·</span><span>{documentEnabled && signingLink ? "Ссылка на документ" : "Без документа"}</span></div></section>
        <p className={SECONDARY_TEXT}>{supportsShare ? "Кнопка «Отправить» откроет меню WhatsApp, Telegram и других доступных приложений." : "Браузер не поддерживает меню приложений. Скопируйте текст и вставьте его в чат вручную."}</p>
        {supportsFiles ? <p className={SECONDARY_TEXT}>Приложение может принять текст и фото вместе. Если текст не появился, скопируйте его отдельно.</p> : files.length ? <p className="rounded-xl border bg-accent/40 p-3 text-sm">Фото на этом устройстве нужно прикрепить вручную. Кнопка отправит только текст; скачайте фото ниже.</p> : null}
        {supportsShare ? <Button variant="outline" className="min-h-11 w-full" onClick={copy}><Copy className="size-4" />Скопировать текст</Button> : null}
        {files.map((file, i) => <Button key={file.name} variant="outline" className="min-h-11 w-full" onClick={() => download(i)}>Скачать фото {i + 1}</Button>)}
        <p className={SECONDARY_TEXT}>Shanyraq не видит, отправлено ли сообщение в другом приложении. Доставка и прочтение здесь не подтверждаются.</p>
      </> : null}
      <ErrorNotice message={error || (baseText.trim() && finalError ? finalError : null)} />
      {notice ? <p role="status" className="rounded-xl border bg-accent/50 p-3 text-sm">{notice}</p> : null}
    </div>
    </div>
    <footer className="shrink-0 space-y-2 border-t bg-background p-4 pb-[max(env(safe-area-inset-bottom),16px)]">
      <div className="flex gap-2">{step > 1 ? <Button variant="outline" className="min-h-12" disabled={locked} onClick={() => changeStep(step - 1)}><ArrowLeft className="size-4" />Назад</Button> : null}
        {step === 1 ? <Button className="min-h-12 min-w-0 flex-1 rounded-xl" disabled={locked || Boolean(finalError)} onClick={() => changeStep(2)}>Далее<ArrowRight className="size-4" /></Button> : step === 2 ? <Button className="min-h-12 min-w-0 flex-1 rounded-xl" disabled={locked || Boolean(finalError) || (documentEnabled && !signingLink)} onClick={prepare}>{locked ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Проверить</Button> : <Button className="min-h-12 min-w-0 flex-1 rounded-xl" disabled={locked || !prepared} onClick={supportsShare ? share : copy}>{locked ? <Loader2 className="size-4 animate-spin" /> : supportsShare ? <Share2 className="size-4" /> : <Copy className="size-4" />}{supportsShare ? "Отправить" : "Скопировать текст"}</Button>}
      </div><p className={`text-center ${SECONDARY_TEXT}`}>{step === 1 ? "Дальше — необязательные фото и документ" : step === 2 ? "На следующем шаге ничего ещё не отправляется" : "Вы сами выберете приложение и получателя"}</p>
    </footer>
  </div>;
}
