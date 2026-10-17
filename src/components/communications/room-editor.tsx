"use client";
/* eslint-disable @next/next/no-img-element -- authenticated private images; never expose these through the shared Next image optimizer */
import { useEffect, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProfileInput } from "@/lib/communications/schema";
import { MAX_PHOTOS, MAX_UPLOAD_BYTES } from "@/lib/communications/schema";
import type { RoomCommunicationVM } from "@/lib/communications/types";
import { communicationCommand, readApi } from "./api";
import { ErrorNotice, Field, INPUT, SECONDARY_TEXT } from "./fields";
const PROFILE_FIELDS: Array<{ key: keyof ProfileInput; label: string; multi?: boolean; secret?: boolean }> = [
  { key: "publicName", label: "Название для гостя" }, { key: "address", label: "Адрес квартиры" },
  { key: "mapLink", label: "Ссылка на карту" }, { key: "keyInstructions", label: "Как получить ключи", multi: true },
  { key: "wifiName", label: "Название сети Wi-Fi" }, { key: "wifiPassword", label: "Пароль Wi-Fi", secret: true },
  { key: "rulesLink", label: "Ссылка на правила проживания" }, { key: "checkinGuideLink", label: "Ссылка на инструкцию" },
  { key: "supportPhone", label: "Телефон поддержки" },
];
export function RoomCommunicationEditor({ room, scope, editable, onSaved }: { room: RoomCommunicationVM; scope: string; editable: boolean; onSaved: () => Promise<void> }) {
  const [profile, setProfile] = useState(room.profile);
  const [savedProfile, setSavedProfile] = useState(room.profile);
  const dirty = JSON.stringify(profile) !== JSON.stringify(savedProfile);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const navigation = (e: MouseEvent) => {
      const link = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (link && !window.confirm("Перейти без сохранения изменений квартиры?")) { e.preventDefault(); e.stopPropagation(); }
    };
    document.addEventListener("click", navigation, true);
    window.addEventListener("beforeunload", warn);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", navigation, true); };
  }, [dirty]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setBusy(true); setError(null);
    try { await communicationCommand(scope, { action: "saveProfile", roomId: room.id, version: room.version, profile }); setSavedProfile(profile); await onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось сохранить"); }
    finally { setBusy(false); }
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) { setError("Выберите фото до 4 МБ"); return; }
    setBusy(true); setError(null);
    try {
      const form = new FormData(); form.set("roomId", room.id); form.set("file", file);
      await readApi(await fetch("/api/communications/photos", { method: "POST", headers: { "x-shanyraq-scope": scope }, body: form }));
      await onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось добавить фото"); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!window.confirm("Убрать фото из будущих сообщений? В уже подготовленных сообщениях оно сохранится.")) return;
    setBusy(true); setError(null);
    try { await communicationCommand(scope, { action: "archivePhoto", photoId: id }); await onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось убрать фото"); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5">
    {!editable ? <p className={`rounded-xl border p-3 ${SECONDARY_TEXT}`}>Настройки и фото изменяет владелец объекта. Вы можете использовать их при отправке гостю.</p> : null}
    <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6"><h2 className="font-semibold">Данные квартиры</h2><p className={SECONDARY_TEXT}>Заполните один раз. Эти данные подставятся в сообщение из бронирования.</p>
      <div className="grid gap-4 sm:grid-cols-2">{PROFILE_FIELDS.map((field) => <div key={field.key} className={field.multi ? "sm:col-span-2" : ""}><Field label={field.label}>{field.multi ? <textarea className={INPUT} rows={4} value={profile[field.key]} disabled={!editable || busy} onChange={(e) => setProfile({ ...profile, [field.key]: e.target.value })} /> : <input className={INPUT} type={field.secret ? "password" : "text"} autoComplete="off" value={profile[field.key]} disabled={!editable || busy} onChange={(e) => setProfile({ ...profile, [field.key]: e.target.value })} />}</Field></div>)}</div>
      <p className={SECONDARY_TEXT}>Пароль Wi-Fi и инструкции доступа доступны сотрудникам с правом на бронирования. Не добавляйте их в общедоступные ссылки.</p>
      {editable ? <div className="flex flex-wrap gap-2"><Button className="min-h-12 w-full rounded-xl sm:w-auto" disabled={busy || !dirty} onClick={save}>{busy ? <Loader2 className="size-4 animate-spin" /> : null}Сохранить данные</Button><Button variant="ghost" className="min-h-11" disabled={busy || !dirty} onClick={() => { if (window.confirm("Отменить несохранённые изменения?")) setProfile(savedProfile); }}>Отмена</Button></div> : null}
    </section>
    <section className="space-y-3 rounded-2xl border bg-card p-4 sm:p-6"><h2 className="font-semibold">Фото квартиры · {room.photos.length}/{MAX_PHOTOS}</h2><p className={SECONDARY_TEXT}>JPEG, PNG или WebP до 4 МБ. Фото сохраняются приватно; геометки удаляются. Для iPhone экспортируйте HEIC в JPEG.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{room.photos.map((photo, index) => <div key={photo.id} className="overflow-hidden rounded-xl border"><img alt={`Фото квартиры ${index + 1}`} src={`/api/communications/photos/${photo.id}`} className="aspect-[4/3] w-full object-cover" /><div className="flex items-center justify-between gap-2 p-2"><span className="text-sm">Фото {index + 1}</span>{editable ? <Button aria-label={`Удалить фото ${index + 1}`} variant="ghost" className="size-11 text-destructive" disabled={busy} onClick={() => remove(photo.id)}><Trash2 className="size-4" /></Button> : null}</div></div>)}</div>
      {editable && room.photos.length < MAX_PHOTOS ? <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-3 text-sm font-semibold focus-within:ring-2 focus-within:ring-primary"><ImagePlus className="size-4" />{busy ? "Обрабатываем фото…" : "Добавить фото"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; void upload(file); }} /></label> : null}
    </section>
    <ErrorNotice message={error} />
  </div>;
}
