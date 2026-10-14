"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { VARIABLES, validateTemplateSyntax, STARTER_TEMPLATES } from "@/lib/communications/template";
import type { RoomCommunicationVM, TemplateVM } from "@/lib/communications/types";
import type { z } from "zod";
import type { templateSchema } from "@/lib/communications/schema";
import { communicationCommand } from "./api";
import { ErrorNotice, Field, INPUT, SECONDARY_TEXT } from "./fields";
export function TemplateEditor({ template, rooms, scope, onSaved, onCancel }: { template: TemplateVM | null; rooms: RoomCommunicationVM[]; scope: string; onSaved: () => Promise<void>; onCancel: () => void }) {
  const [value, setValue] = useState<z.infer<typeof templateSchema>>({ id: template?.id, version: template?.version ?? 0, name: template?.name ?? STARTER_TEMPLATES[0].name, body: template?.body ?? STARTER_TEMPLATES[0].body, roomId: template?.roomId ?? null, language: (template?.language as "ru" | "kk" | "en") ?? "ru", status: (template?.status as "DRAFT" | "ACTIVE" | "ARCHIVED") ?? "DRAFT", isDefault: template?.isDefault ?? false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const syntaxError = validateTemplateSyntax(value.body);
  async function save(copy = false) {
    setBusy(true); setError(null);
    try {
      await communicationCommand(scope, { action: "saveTemplate", template: copy ? { ...value, id: undefined, version: 0, name: `${value.name.slice(0, 150)} · копия`, isDefault: false } : value });
      await onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось сохранить шаблон"); }
    finally { setBusy(false); }
  }
  function insert(key: string) {
    const start = textarea.current?.selectionStart ?? value.body.length;
    const end = textarea.current?.selectionEnd ?? start;
    const token = `{{${key}}}`;
    setValue({ ...value, body: value.body.slice(0, start) + token + value.body.slice(end) });
    requestAnimationFrame(() => { textarea.current?.focus(); textarea.current?.setSelectionRange(start + token.length, start + token.length); });
  }
  return <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6">
    <h2 className="font-semibold">{template?.id ? "Редактирование шаблона" : "Новый шаблон"}</h2>
    {!template ? <Field label="Начать с готового текста"><select className={INPUT} defaultValue="0" onChange={(e) => { const seed = STARTER_TEMPLATES[Number(e.target.value)]; setValue({ ...value, name: seed.name, body: seed.body }); }}><option value="0">Инструкция заселения</option>{STARTER_TEMPLATES.slice(1).map((t, i) => <option key={t.name} value={i + 1}>{t.name}</option>)}</select></Field> : null}
    <Field label="Название"><input className={INPUT} maxLength={160} value={value.name} onChange={(e) => setValue({ ...value, name: e.target.value })} /></Field>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Квартира"><select className={INPUT} value={value.roomId ?? ""} onChange={(e) => setValue({ ...value, roomId: e.target.value || null })}><option value="">Все квартиры объекта</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.label}</option>)}</select></Field><Field label="Язык"><select className={INPUT} value={value.language} onChange={(e) => setValue({ ...value, language: e.target.value as "ru" | "kk" | "en" })}><option value="ru">Русский</option><option value="kk">Қазақша</option><option value="en">English</option></select></Field></div>
    <Field label="Текст сообщения" hint="Нажмите переменную ниже, чтобы вставить её в текст."><textarea ref={textarea} className={`${INPUT} resize-y leading-relaxed`} rows={8} maxLength={4096} value={value.body} onChange={(e) => setValue({ ...value, body: e.target.value })} /></Field>
    <details className="rounded-xl border p-3"><summary className="min-h-11 cursor-pointer text-sm font-semibold">Доступные переменные</summary><div className="mt-2 flex flex-wrap gap-2">{Object.entries(VARIABLES).map(([key, label]) => <button type="button" key={key} className="min-h-11 rounded-lg border px-3 text-sm focus-visible:ring-2 focus-visible:ring-primary" onClick={() => insert(key)}>{label}</button>)}</div></details>
    <Field label="Статус"><select className={INPUT} value={value.status} onChange={(e) => setValue({ ...value, status: e.target.value as "DRAFT" | "ACTIVE" | "ARCHIVED", isDefault: e.target.value === "ACTIVE" && value.isDefault })}><option value="DRAFT">Черновик</option><option value="ACTIVE">Активный</option><option value="ARCHIVED">Архив</option></select></Field>
    <label className="flex min-h-11 items-center gap-3 text-sm"><input className="size-5" type="checkbox" checked={value.isDefault} disabled={value.status !== "ACTIVE"} onChange={(e) => setValue({ ...value, isDefault: e.target.checked })} />Использовать по умолчанию</label>
    <p className={SECONDARY_TEXT}>При сохранении создаётся версия. Уже подготовленные сообщения не изменяются. Персональный предпросмотр доступен в карточке брони.</p>
    <ErrorNotice message={error || syntaxError} />
    <div className="flex flex-wrap gap-2"><Button className="min-h-12 flex-1" disabled={busy || !value.name.trim() || Boolean(syntaxError)} onClick={() => save()}>Сохранить</Button>{template ? <Button className="min-h-12" variant="outline" disabled={busy || !value.name.trim() || Boolean(syntaxError)} onClick={() => save(true)}>Сохранить копию</Button> : null}<Button className="min-h-12" variant="outline" disabled={busy} onClick={onCancel}>Закрыть</Button></div>
  </section>;
}
