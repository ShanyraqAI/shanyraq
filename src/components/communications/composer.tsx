"use client";
/* eslint-disable @next/next/no-img-element -- private authenticated images must not use the shared image optimizer */
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Copy, ImagePlus, Loader2, Share2 } from "lucide-react";
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
const STEPS = ["Сообщение", "Проверка"] as const;
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
      <SheetHeader className="shrink-0 border-b pt-[max(env(safe-area-inset-top),16px)] pr-12"><SheetTitle>Сообщение гостю</SheetTitle><SheetDescription className={SECONDARY_TEXT}>Измените текст → проверьте → выберите приложение</SheetDescription></SheetHeader>
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
  function changeStep(next: number) { if (next !== 2) resetDraft(); setStep(next); }
  function chooseTemplate(id: string) {
    if (mode === "custom" && customText !== ready.text && !window.confirm("Заменить ваш текст выбранным шаблоном?")) return;
    setTemplateId(id); setMode("default"); resetDraft();
  }
  function editText() { changeStep(1); requestAnimationFrame(() => textarea.current?.focus()); }
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
    <div data-communication-scroll className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
    <section className="rounded-2xl border bg-accent/40 px-4 py-3"><h2 className="font-semibold">{w.guestName}</h2><p className={`mt-1 break-words ${SECONDARY_TEXT}`}>{w.roomName}{w.phone ? ` · +${w.phone}` : ""}</p></section>
    <StepProgress step={step} labels={STEPS} />
    <div className="flex-1 space-y-4">
      <header><h2 ref={heading} tabIndex={-1} className="text-lg font-semibold outline-none">{step === 1 ? "Текст для гостя" : "Всё готово к передаче"}</h2></header>
      {step === 1 ? <>
        <Field label="Сообщение" hint="Нажмите на текст, чтобы изменить. Шаблон не изменится."><textarea ref={textarea} rows={10} className={`${INPUT} resize-y leading-relaxed`} maxLength={4096} value={baseText} disabled={locked} onChange={(e) => { setCustomText(e.target.value); setMode("custom"); resetDraft(); }} /></Field>
        {mode === "default" && (ready.missing.length || ready.unknown.length) ? <p role="status" className={SECONDARY_TEXT}>Заполните или удалите в тексте: {[...ready.missing, ...ready.unknown].map((key) => VARIABLES[key as keyof typeof VARIABLES] ?? key).join(", ")}</p> : null}
        <details className="rounded-xl border px-3"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Другой шаблон</summary><div className="pb-3"><Field label="Шаблон"><select className={INPUT} value={templateId} disabled={locked} onChange={(e) => chooseTemplate(e.target.value)}><optgroup label="Стандартные тексты">{STARTER_TEMPLATES.map((t, i) => <option key={t.name} value={`starter:${i}`}>{t.name}</option>)}</optgroup>{w.templates.length ? <optgroup label="Мои шаблоны">{w.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup> : null}</select></Field><Button variant="ghost" className="mt-2 min-h-11" disabled={locked} onClick={() => chooseTemplate(templateId)}>Вернуть текст шаблона</Button><Button variant="ghost" className="mt-2 min-h-11" disabled={locked} onClick={() => { if (baseText.trim() && !window.confirm("Очистить текст и написать с нуля?")) return; setCustomText(""); setMode("custom"); resetDraft(); textarea.current?.focus(); }}>Написать с нуля</Button></div></details>
        <details className="rounded-xl border p-3"><summary className="min-h-11 cursor-pointer text-sm font-semibold">Фото и документ · {selected.length || documentEnabled ? `${selected.length} фото${documentEnabled ? " · документ" : ""}` : "необязательно"}</summary><div className="mt-3 space-y-4">
        <section className="space-y-3 rounded-2xl border bg-card p-4"><h3 className="flex items-center gap-2 font-semibold"><ImagePlus className="size-5" />Фото квартиры <span className={SECONDARY_TEXT}>· {selected.length} выбрано</span></h3>
          {w.photos.length ? <div className="grid grid-cols-3 gap-2">{w.photos.map((p, i) => <label key={p.id} className="relative cursor-pointer overflow-hidden rounded-xl border focus-within:ring-2 focus-within:ring-primary"><input aria-label={`Добавить фото ${i + 1}`} type="checkbox" className="absolute top-2 left-2 z-10 size-5 accent-[#07866b]" checked={selected.includes(p.id)} disabled={locked} onChange={(e) => { setSelected(e.target.checked ? [...selected, p.id] : selected.filter((id) => id !== p.id)); resetDraft(); }} /><img src={`/api/communications/photos/${p.id}`} alt={`Фото квартиры ${i + 1}`} className="aspect-square w-full object-cover" /><span className="block p-2 text-sm">Фото {i + 1}</span></label>)}</div> : <p className={SECONDARY_TEXT}>Фото пока нет. Можно отправить только текст; фотографии владелец добавляет в данных квартиры.</p>}
        </section>
        <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border bg-card p-4"><input type="checkbox" className="mt-1 size-5 shrink-0 accent-[#07866b]" checked={documentEnabled} disabled={locked} onChange={(e) => { setDocumentEnabled(e.target.checked); resetDraft(); }} /><span><span className="block font-semibold">Добавить ссылку на документ</span><span className={`mt-1 block ${SECONDARY_TEXT}`}>Гость сможет открыть PDF и подтвердить подписание по ссылке. Не ЭЦП.</span></span></label>
        {documentEnabled ? <><Button variant="ghost" className="min-h-11" disabled={locked} onClick={() => { setDocumentEnabled(false); resetDraft(); }}>Продолжить без документа</Button><DocumentSigningPanel reservationId={w.reservationId} scope={w.scope} inline onBusyChange={setDocumentBusy} onLinkCleared={() => { setSigningLink(null); resetDraft(); }} onLinkCreated={(link) => { setSigningLink(link); resetDraft(); }} />{signingLink ? <p role="status" className="rounded-xl border bg-accent/40 p-3 text-sm">Ссылка на {signingLink.title} будет добавлена к сообщению. До {new Date(signingLink.expiresAt).toLocaleString("ru-RU")}.</p> : <p className={SECONDARY_TEXT}>Выберите PDF и нажмите «Добавить ссылку» — или продолжите без документа.</p>}</> : null}

        </div></details>
      </> : null}
      {step === 2 && prepared ? <>
        <section className="space-y-3 rounded-2xl border bg-card p-4"><button type="button" disabled={locked} onClick={editText} className="block w-full text-left text-base leading-relaxed whitespace-pre-wrap break-words focus-visible:outline-2" aria-label="Изменить сообщение перед отправкой">{prepared.text}</button><div className={`flex flex-wrap gap-2 border-t pt-3 ${SECONDARY_TEXT}`}><span>{files.length ? `Фото: ${files.length}` : "Без фото"}</span><span>·</span><span>{documentEnabled && signingLink ? "Ссылка на документ" : "Без документа"}</span></div></section>

        <p className={SECONDARY_TEXT}>{supportsShare ? "Нажмите «Выбрать приложение», затем выберите чат гостя и отправьте сообщение." : "Браузер не поддерживает меню приложений. Скопируйте текст и вставьте его в чат вручную."}</p>
        {supportsFiles ? <p className={SECONDARY_TEXT}>Приложение может принять текст и фото вместе. Если текст не появился, скопируйте его отдельно.</p> : files.length ? <p className="rounded-xl border bg-accent/40 p-3 text-sm">Фото на этом устройстве нужно прикрепить вручную. Кнопка отправит только текст; скачайте фото ниже.</p> : null}
        <details className="rounded-xl border p-3"><summary className="min-h-11 cursor-pointer text-sm font-semibold">Копирование и скачивание</summary><div className="space-y-2">{supportsShare ? <Button variant="outline" className="min-h-11 w-full" onClick={copy}><Copy className="size-4" />Скопировать текст</Button> : null}
        {files.map((file, i) => <Button key={file.name} variant="outline" className="min-h-11 w-full" onClick={() => download(i)}>Скачать фото {i + 1}</Button>)}
        <p className={SECONDARY_TEXT}>Shanyraq не видит, отправлено ли сообщение в другом приложении. Доставка и прочтение здесь не подтверждаются.</p></div></details>
      </> : null}
      <ErrorNotice message={error || (baseText.trim() && finalError ? finalError : null)} />
      {notice ? <p role="status" className="rounded-xl border bg-accent/50 p-3 text-sm">{notice}</p> : null}
    </div>
    </div>
    <footer className="shrink-0 space-y-2 border-t bg-background p-4 pb-[max(env(safe-area-inset-bottom),16px)]">
      <div className="flex gap-2">{step > 1 ? <Button variant="outline" className="min-h-12" disabled={locked} onClick={() => changeStep(step - 1)}><ArrowLeft className="size-4" />Назад</Button> : null}
        {step === 1 ? <Button className="min-h-12 min-w-0 flex-1 rounded-xl" disabled={locked || Boolean(finalError) || (documentEnabled && !signingLink)} onClick={prepare}>{locked ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}Проверить сообщение</Button> : <Button className="min-h-12 min-w-0 flex-1 rounded-xl" disabled={locked || !prepared} onClick={supportsShare ? share : copy}>{locked ? <Loader2 className="size-4 animate-spin" /> : supportsShare ? <Share2 className="size-4" /> : <Copy className="size-4" />}{supportsShare ? "Выбрать приложение" : "Скопировать текст"}</Button>}
      </div><p className={`text-center ${SECONDARY_TEXT}`}>{step === 1 ? "Пока ничего не отправляем" : "Проверьте получателя в выбранном приложении"}</p>
    </footer>
  </div>;
}
