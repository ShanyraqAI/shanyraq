"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CommunicationWorkspace, TemplateVM } from "@/lib/communications/types";
import { HISTORY_LABELS } from "@/lib/communications/types";
import { TemplateEditor } from "./template-editor";
import { LoadFailure } from "./load-failure";
import { SendGuide } from "./send-guide";
import { readApi } from "./api";
import { Field, INPUT, SECONDARY_TEXT } from "./fields";
export function CommunicationsWorkspace({ owner = false, initialTab = "send" }: { owner?: boolean; initialTab?: "send" | "rooms" | "templates" | "history" }) {
  const [data, setData] = useState<CommunicationWorkspace | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<string>(initialTab);
  const [roomId, setRoomId] = useState("");
  const [editing, setEditing] = useState<TemplateVM | "new" | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true);
    try { const fresh = await readApi<CommunicationWorkspace>(await fetch("/api/communications", { cache: "no-store" })); setData(fresh); setError(null); }
    catch (e) { setError(e); throw e; }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/communications", { cache: "no-store", signal: controller.signal }).then(readApi<CommunicationWorkspace>)
      .then((fresh) => { if (!controller.signal.aborted) setData(fresh); }).catch((e: unknown) => { if (!controller.signal.aborted) setError(e); });
    return () => controller.abort();
  }, []);
  async function loadMore() {
    if (!data?.nextCursor) return;
    setLoadingMore(true);
    try {
      const next = await readApi<CommunicationWorkspace>(await fetch(`/api/communications?cursor=${encodeURIComponent(data.nextCursor)}`, { cache: "no-store" }));
      if (next.scope !== data.scope) throw new Error("Вы сменили объект. Обновите страницу.");
      const seen = new Set(data.history.map((item) => item.id));
      setData({ ...data, history: [...data.history, ...next.history.filter((h) => !seen.has(h.id))], nextCursor: next.nextCursor });
    } catch (e) { setError(e); }
    finally { setLoadingMore(false); }
  }
  const room = data?.rooms.find((r) => r.id === roomId) ?? data?.rooms[0];
  return <div data-clarity-mask="true" className="mx-auto max-w-3xl space-y-5">
    <header><h1 className="text-2xl font-extrabold tracking-tight">Коммуникации</h1><p className={`mt-2 ${SECONDARY_TEXT}`}>Данные квартиры, тексты и фото для гостя — в одном месте.</p></header>
    <nav aria-label="Разделы коммуникаций" className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[["rooms", "Квартиры"], ["templates", "Шаблоны"], ["history", "История"], ["send", "Отправка"]].map(([id, label]) => <Button key={id} variant={tab === id ? "default" : "outline"} className="min-h-11 rounded-xl" aria-current={tab === id ? "page" : undefined} onClick={() => { setTab(id); setEditing(null); setNotice(null); }}>{label}</Button>)}</nav>
    {error ? <LoadFailure error={error} owner={owner} busy={loading} onRetry={() => { void reload().catch(() => undefined); }} /> : null}
    {tab === "send" ? <SendGuide /> : null}
    {notice ? <p role="status" className="rounded-xl border bg-accent/40 p-3 text-sm">{notice}</p> : null}
    {!data ? !error && tab !== "send" ? <p role="status" className="flex items-center gap-2"><Loader2 className="size-5 animate-spin" />Загружаем данные…</p> : null : <>
      {tab === "rooms" ? room ? <div className="space-y-4"><Field label="Выберите квартиру"><select className={INPUT} value={room.id} onChange={(e) => setRoomId(e.target.value)}>{data.rooms.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></Field><Link href={`/dashboard/rooms/${encodeURIComponent(room.id)}`} className="flex min-h-12 items-center justify-between gap-3 rounded-xl border bg-card p-4 font-semibold">Открыть профиль квартиры<span aria-hidden>→</span></Link></div> : <section className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">Сначала добавьте квартиру</h2><p className={`mt-2 ${SECONDARY_TEXT}`}>Квартиры создаются в существующем разделе объектов.</p><Link className="mt-4 inline-flex min-h-11 items-center font-semibold underline" href="/dashboard/rooms">Открыть квартиры</Link></section> : null}
      {tab === "templates" ? editing ? <TemplateEditor key={editing === "new" ? "new" : `${editing.id}:${editing.version}`} template={editing === "new" ? null : editing} rooms={data.rooms} scope={data.scope} onSaved={async () => { await reload(); setEditing(null); setNotice("Шаблон сохранён"); }} onCancel={() => setEditing(null)} /> : <section className="space-y-3">
        {data.owner ? <Button className="min-h-12 w-full rounded-xl sm:w-auto" onClick={() => setEditing("new")}><Plus className="size-4" />Создать шаблон</Button> : <p className={SECONDARY_TEXT}>Шаблоны изменяет владелец объекта.</p>}
        {!data.templates.length ? <div className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">Шаблонов пока нет</h2><p className={`mt-2 ${SECONDARY_TEXT}`}>Создайте свой текст или начните с инструкции заселения, подтверждения брони или Wi-Fi.</p></div> : data.templates.map((t) => <article key={t.id} className="rounded-2xl border bg-card p-4"><div className="flex items-start justify-between gap-3"><h2 className="min-w-0 break-words font-semibold">{t.name}</h2><span className={`shrink-0 ${SECONDARY_TEXT}`}>{t.language.toUpperCase()} · v{t.version}</span></div><p className={`mt-2 ${SECONDARY_TEXT}`}>{t.status === "ACTIVE" ? "Активный" : t.status === "ARCHIVED" ? "Архив" : "Черновик"}{t.isDefault ? " · по умолчанию" : ""} · {data.rooms.find((r) => r.id === t.roomId)?.label ?? "Все квартиры"}</p>{data.owner ? <Button className="mt-3 min-h-11 w-full sm:w-auto" variant="outline" onClick={() => setEditing(t)}>Редактировать</Button> : null}</article>)}
      </section> : null}
      {tab === "history" ? <section className="space-y-3"><h2 className="font-semibold">Подготовка и ручная передача</h2><p className={SECONDARY_TEXT}>Это журнал действий, а не подтверждение отправки или доставки.</p>{!data.history.length ? <p className="rounded-2xl border bg-card p-5">История появится после подготовки сообщения в карточке брони.</p> : data.history.map((h) => <article key={h.id} className="rounded-2xl border bg-card p-4"><Link href={`/dashboard/reservations/${encodeURIComponent(h.reservationId)}`} className="inline-flex min-h-11 items-center font-semibold underline">{h.guestName}</Link><p className={`mt-1 ${SECONDARY_TEXT}`}>{HISTORY_LABELS[h.state] ?? "Неизвестное событие"}</p><p className={`mt-2 ${SECONDARY_TEXT}`}>{new Date(h.createdAt).toLocaleString("ru-RU")}</p></article>)}{data.nextCursor ? <Button className="min-h-11 w-full" variant="outline" disabled={loadingMore} onClick={loadMore}>Загрузить ещё</Button> : null}</section> : null}

    </>}
  </div>;
}
