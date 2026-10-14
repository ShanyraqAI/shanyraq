"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VARIABLES, validateTemplateSyntax, STARTER_TEMPLATES } from "@/lib/communications/template";
import type { RoomCommunicationVM, TemplateVM } from "@/lib/communications/types";
import type { z } from "zod";
import type { templateSchema } from "@/lib/communications/schema";
import { communicationCommand } from "./api";
import { ErrorNotice, Field, INPUT, SECONDARY_TEXT } from "./fields";
import { StepProgress } from "./step-progress";
export function TemplateEditor({ template, rooms, scope, onSaved, onCancel }: { template: TemplateVM | null; rooms: RoomCommunicationVM[]; scope: string; onSaved: () => Promise<void>; onCancel: () => void }) {
  const [value, setValue] = useState<z.infer<typeof templateSchema>>({ id: template?.id, version: template?.version ?? 0, name: template?.name ?? STARTER_TEMPLATES[0].name, body: template?.body ?? STARTER_TEMPLATES[0].body, roomId: template?.roomId ?? null, language: (template?.language as "ru" | "kk" | "en") ?? "ru", status: (template?.status as "DRAFT" | "ACTIVE" | "ARCHIVED") ?? "ACTIVE", isDefault: template?.isDefault ?? false });
  const [step, setStep] = useState(1);
  const [source, setSource] = useState<"ready" | "custom">("ready");
  const [seedIndex, setSeedIndex] = useState(0);
  const [readyText, setReadyText] = useState<string>(STARTER_TEMPLATES[0].body);
  const [ownText, setOwnText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const syntaxError = validateTemplateSyntax(value.body);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step]);
  async function save(copy = false) {
    setBusy(true); setError(null);
    try { await communicationCommand(scope, { action: "saveTemplate", template: copy ? { ...value, id: undefined, version: 0, name: `${value.name.slice(0, 150)} · копия`, isDefault: false } : value }); await onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось сохранить шаблон. Написанный текст остаётся в редакторе."); }
    finally { setBusy(false); }
  }
  function switchSource(next: "ready" | "custom") {
    if (source === next) return;
    if (next === "custom") { setReadyText(value.body); setValue({ ...value, body: ownText }); }
    else { setOwnText(value.body); setValue({ ...value, body: readyText }); }
    setSource(next); setError(null);
  }
  function insert(key: string) {
    const start = textarea.current?.selectionStart ?? value.body.length; const end = textarea.current?.selectionEnd ?? start;
    const token = `{{${key}}}`; const body = value.body.slice(0, start) + token + value.body.slice(end);
    if (body.length > 4096) { setError("Для этой переменной не хватает места. Сократите текст."); return; }
    setValue({ ...value, body }); requestAnimationFrame(() => { textarea.current?.focus(); textarea.current?.setSelectionRange(start + token.length, start + token.length); });
  }
  return <section className="space-y-5 rounded-2xl border bg-card p-4 sm:p-6">
    <h2 className="text-lg font-semibold">{template?.id ? "Редактирование шаблона" : "Новый шаблон"}</h2>
    <StepProgress step={step} labels={["Текст", "Сохранение"]} />
    <h3 ref={heading} tabIndex={-1} className="font-semibold outline-none">{step === 1 ? "Сначала подготовим текст" : "Как сохранить этот текст?"}</h3>
    <fieldset disabled={busy} className="space-y-4">
      {step === 1 ? <>
        {!template ? <><fieldset className="grid grid-cols-2 gap-2"><legend className="sr-only">С чего начать</legend>{[["ready", "Готовый текст"], ["custom", "Свой текст"]].map(([id, label]) => <label key={id} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-semibold ${source === id ? "border-primary bg-accent/40" : ""}`}><input type="radio" name="template-source" className="size-4 accent-[#07866b]" checked={source === id} onChange={() => switchSource(id as "ready" | "custom")} />{label}</label>)}</fieldset>
          {source === "ready" ? <Field label="Начать с готового текста"><select className={INPUT} value={seedIndex} onChange={(e) => { const index = Number(e.target.value); const seed = STARTER_TEMPLATES[index]; setSeedIndex(index); setReadyText(seed.body); setValue({ ...value, name: value.name === STARTER_TEMPLATES[seedIndex].name ? seed.name : value.name, body: seed.body }); }}>{STARTER_TEMPLATES.map((t, i) => <option key={t.name} value={i}>{t.name}</option>)}</select></Field> : null}</> : null}
        <Field label="Текст сообщения" hint={`${value.body.length}/4096 · этот текст можно использовать для следующих гостей`}><textarea ref={textarea} className={`${INPUT} resize-y leading-relaxed`} rows={8} maxLength={4096} placeholder="Напишите сообщение своими словами…" value={value.body} onChange={(e) => { setValue({ ...value, body: e.target.value }); setError(null); }} /></Field>
        <p className={SECONDARY_TEXT}>Готовый текст можно оставить как есть. Свой черновик не стирается при переключении.</p>
        <details className="rounded-xl border p-3"><summary className="min-h-11 cursor-pointer text-sm font-semibold">Подставлять данные гостя автоматически</summary><p className={`my-2 ${SECONDARY_TEXT}`}>Нажмите нужное поле. В сообщении из брони вместо него появятся реальные данные.</p><div className="flex flex-wrap gap-2">{Object.entries(VARIABLES).map(([key, label]) => <button type="button" key={key} className="min-h-11 rounded-lg border px-3 text-sm focus-visible:ring-2 focus-visible:ring-primary" onClick={() => insert(key)}>{label}</button>)}</div></details>
      </> : <>
        <Field label="Название шаблона"><input className={INPUT} maxLength={160} value={value.name} onChange={(e) => setValue({ ...value, name: e.target.value })} /></Field>
        <Field label="Для какой квартиры"><select className={INPUT} value={value.roomId ?? ""} onChange={(e) => setValue({ ...value, roomId: e.target.value || null })}><option value="">Все квартиры объекта</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.label}</option>)}</select></Field>
        <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border bg-accent/30 p-3"><input className="mt-1 size-5 shrink-0" type="checkbox" checked={value.isDefault} disabled={value.status === "ARCHIVED"} onChange={(e) => setValue({ ...value, isDefault: e.target.checked, status: e.target.checked ? "ACTIVE" : value.status })} /><span><span className="block text-sm font-semibold">Использовать по умолчанию</span><span className={`mt-1 block ${SECONDARY_TEXT}`}>Шаблон станет активным и будет предлагаться в сообщениях для выбранных квартир.</span></span></label>
        <details className="rounded-xl border p-3"><summary className="min-h-11 cursor-pointer text-sm font-semibold">Дополнительные настройки</summary><div className="mt-2 space-y-4"><Field label="Язык"><select className={INPUT} value={value.language} onChange={(e) => setValue({ ...value, language: e.target.value as "ru" | "kk" | "en" })}><option value="ru">Русский</option><option value="kk">Қазақша</option><option value="en">English</option></select></Field><Field label="Статус"><select className={INPUT} value={value.status} onChange={(e) => setValue({ ...value, status: e.target.value as "DRAFT" | "ACTIVE" | "ARCHIVED", isDefault: e.target.value === "ACTIVE" && value.isDefault })}><option value="DRAFT">Черновик</option><option value="ACTIVE">Активный</option><option value="ARCHIVED">Архив</option></select></Field></div></details>
        <p className={SECONDARY_TEXT}>{value.status === "ACTIVE" ? "После сохранения шаблон появится в сообщениях для выбранных квартир." : value.status === "DRAFT" ? "Это черновик: в отправке его пока не будет. Для использования выберите активный статус." : "Шаблон в архиве: в отправке его не будет."}</p>
        <p className={SECONDARY_TEXT}>При сохранении создаётся новая версия. Уже подготовленные сообщения не изменятся.</p>
      </>}
    </fieldset>
    <ErrorNotice message={error || syntaxError} />
    <div className="flex flex-wrap gap-2 border-t pt-4">{step === 2 ? <Button className="min-h-12" variant="outline" disabled={busy} onClick={() => setStep(1)}><ArrowLeft className="size-4" />Назад</Button> : null}{step === 1 ? <Button className="min-h-12 flex-1" disabled={busy || !value.body.trim() || Boolean(syntaxError)} onClick={() => setStep(2)}>Далее<ArrowRight className="size-4" /></Button> : <Button className="min-h-12 flex-1" disabled={busy || !value.name.trim() || !value.body.trim() || Boolean(syntaxError)} onClick={() => save()}>{busy ? <Loader2 className="size-4 animate-spin" /> : null}Сохранить шаблон</Button>}{step === 2 && template ? <Button className="min-h-12" variant="outline" disabled={busy || !value.name.trim() || Boolean(syntaxError)} onClick={() => save(true)}>Сохранить копию</Button> : null}<Button className="min-h-12" variant="outline" disabled={busy} onClick={onCancel}>Закрыть</Button></div>
  </section>;
}
