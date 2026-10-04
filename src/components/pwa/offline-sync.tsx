"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CloudUpload, Loader2, RotateCw, Trash2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { callOfflineAction, isOfflineActionKind } from "@/lib/offline/actions";
import { OUTBOX_EVENT, isNetworkError, readOutbox, removeOutboxEntry, setOutboxScope, updateOutboxEntry, type OutboxEntry } from "@/lib/offline/outbox";
import { SNAPSHOT_KEY, warmOfflinePages } from "@/lib/offline/device-data";
import { cn } from "@/lib/utils";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function subscribeOutbox(callback: () => void) {
  window.addEventListener(OUTBOX_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(OUTBOX_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

// Snapshot is the raw JSON so useSyncExternalStore gets a stable value between renders.
const outboxSnapshot = () => JSON.stringify(readOutbox());

function formatTime(value: string | null, kk: boolean) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(kk ? "kk-KZ" : "ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function OfflineSync({ scope, warmUrls, locale }: { scope: string; warmUrls: string[]; locale: "ru" | "kk" }) {
  const kk = locale === "kk";
  const router = useRouter();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const raw = useSyncExternalStore(subscribeOutbox, outboxSnapshot, () => "[]");
  const entries = useMemo(() => (JSON.parse(raw) as OutboxEntry[]).filter((entry) => entry.scope === scope), [raw, scope]);
  const pending = entries.filter((entry) => !entry.error);
  const failed = entries.filter((entry) => entry.error);
  const [syncing, setSyncing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const snapshotAt = useSyncExternalStore(subscribeOutbox, () => window.localStorage.getItem(SNAPSHOT_KEY), () => null);
  const syncingRef = useRef(false);

  useEffect(() => setOutboxScope(scope), [scope]);
  const warmKey = warmUrls.join("|");

  const sync = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    const queue = readOutbox().filter((entry) => entry.scope === scope && !entry.error);
    if (!queue.length) return;
    syncingRef.current = true;
    setSyncing(true);
    let sent = 0;
    let rejected = 0;
    for (const entry of queue) {
      if (!isOfflineActionKind(entry.kind)) {
        updateOutboxEntry(entry.id, { error: kk ? "Белгісіз әрекет" : "Неизвестное действие" });
        rejected += 1;
        continue;
      }
      try {
        const result = await callOfflineAction(entry.kind, entry.args);
        if (result.ok) {
          removeOutboxEntry(entry.id);
          sent += 1;
        } else {
          updateOutboxEntry(entry.id, { error: result.error ?? (kk ? "Сервер өзгерісті қабылдамады" : "Сервер не принял изменение") });
          rejected += 1;
        }
      } catch (error) {
        if (isNetworkError(error)) break;
        updateOutboxEntry(entry.id, { error: error instanceof Error ? error.message : (kk ? "Жіберу мүмкін болмады" : "Не удалось отправить") });
        rejected += 1;
      }
    }
    syncingRef.current = false;
    setSyncing(false);
    if (sent) toast.success(kk ? `Синхрондалды: ${sent}` : `Синхронизировано изменений: ${sent}`);
    if (rejected) toast.error(kk ? `${rejected} өзгеріс жіберілмеді` : `Не удалось отправить изменений: ${rejected}`, { action: { label: kk ? "Ашу" : "Открыть", onClick: () => setSheetOpen(true) } });
    if (sent) router.refresh();
  }, [kk, router, scope]);

  useEffect(() => {
    if (!online) return;
    const timer = window.setTimeout(() => void sync(), 0);
    const urls = warmKey.split("|");
    void warmOfflinePages(urls);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void sync();
      void warmOfflinePages(urls);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [online, sync, warmKey]);

  async function retry(entry: OutboxEntry) {
    updateOutboxEntry(entry.id, { error: undefined });
    await sync();
  }

  function discard(entry: OutboxEntry) {
    if (!window.confirm(kk ? "Бұл өзгерісті жою керек пе? Ол серверге жіберілмейді." : "Удалить это изменение? Оно не будет отправлено на сервер.")) return;
    removeOutboxEntry(entry.id);
  }

  const snapshotLabel = formatTime(snapshotAt, kk);
  const showBanner = !online || syncing || entries.length > 0;

  return (
    <>
      {showBanner ? (
        <div className="sticky top-[max(env(safe-area-inset-top),0.5rem)] z-40 mb-3" role="status" aria-live="polite">
          {!online ? (
            <button type="button" onClick={() => setSheetOpen(true)} className="flex w-full items-start gap-3 rounded-2xl bg-[#193e30] p-3.5 text-left text-white shadow-lg shadow-emerald-950/15">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10"><WifiOff className="size-[18px] text-[#e3d895]" /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2"><b className="text-[13px]">{kk ? "Офлайн режим" : "Офлайн-режим"}</b>{pending.length ? <span className="rounded-full bg-[#e3d895] px-2 py-0.5 text-[10px] font-extrabold text-[#193e30]">{kk ? `${pending.length} күтуде` : `${pending.length} ждут отправки`}</span> : null}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-white/75">{kk ? "Әдеттегідей жұмыс істеңіз — өзгерістер құрылғыда сақталып, интернет пайда болғанда синхрондалады." : "Работайте как обычно — изменения сохраняются на устройстве и синхронизируются, когда появится интернет."}</span>
                {snapshotLabel ? <span className="mt-1 block text-[10px] text-white/55">{kk ? `Деректер: ${snapshotLabel}` : `Данные на ${snapshotLabel}`}</span> : null}
              </span>
            </button>
          ) : syncing ? (
            <div className="flex items-center gap-3 rounded-2xl bg-[#e3f3ed] p-3 text-[#0b6b56] ring-1 ring-[#cfe9df]">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-xs font-bold">{kk ? "Өзгерістер синхрондалуда…" : "Синхронизируем изменения…"}</span>
            </div>
          ) : (
            <button type="button" onClick={() => setSheetOpen(true)} className={cn("flex w-full items-center gap-3 rounded-2xl p-3 text-left ring-1", failed.length ? "bg-[#fff3ef] text-[#a2412c] ring-[#f6d8cf]" : "bg-[#e3f3ed] text-[#0b6b56] ring-[#cfe9df]")}>
              {failed.length ? <AlertTriangle className="size-4 shrink-0" /> : <CloudUpload className="size-4 shrink-0" />}
              <span className="min-w-0 flex-1 text-xs font-bold">{failed.length ? (kk ? `${failed.length} өзгеріс жіберілмеді — тексеріңіз` : `Не отправлено изменений: ${failed.length} — проверьте`) : (kk ? `${pending.length} өзгеріс жіберуді күтуде` : `Ждут отправки: ${pending.length}`)}</span>
            </button>
          )}
        </div>
      ) : null}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-3xl border-0 bg-[#f7f8f5] px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-6">
          <SheetHeader className="p-0 text-left">
            <SheetTitle className="text-base font-extrabold text-[#24332c]">{kk ? "Синхрондау" : "Синхронизация"}</SheetTitle>
            <SheetDescription className="text-xs leading-5 text-[#7b847c]">
              {online
                ? (kk ? "Интернет бар. Күтудегі өзгерістер автоматты түрде жіберіледі." : "Интернет есть. Ожидающие изменения отправляются автоматически.")
                : (kk ? "Интернет жоқ. Өзгерістер осы құрылғыда сақталады және қосылым қалпына келгенде жіберіледі." : "Нет интернета. Изменения хранятся на этом устройстве и отправятся, когда связь восстановится.")}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {entries.length ? entries.map((entry) => (
              <div key={entry.id} className="rounded-2xl bg-white p-3.5 ring-1 ring-[#e7e9e1]">
                <div className="flex items-start gap-3">
                  <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl", entry.error ? "bg-[#fff0e9] text-[#da6951]" : "bg-[#e3f3ed] text-[#07866b]")}>{entry.error ? <AlertTriangle className="size-4" /> : <CloudUpload className="size-4" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-[#28362f]">{entry.label}</span>
                    <span className="block text-[11px] text-[#939991]">{formatTime(entry.createdAt, kk)}</span>
                    {entry.error ? <span className="mt-1 block text-xs leading-5 text-[#a2412c]">{entry.error}</span> : null}
                  </span>
                </div>
                {entry.error ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" disabled={!online || syncing} onClick={() => void retry(entry)} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[#07866b] text-xs font-bold text-white disabled:opacity-50"><RotateCw className="size-3.5" />{kk ? "Қайталау" : "Повторить"}</button>
                    <button type="button" onClick={() => discard(entry)} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[#f3f4ef] text-xs font-bold text-[#a2412c]"><Trash2 className="size-3.5" />{kk ? "Жою" : "Удалить"}</button>
                  </div>
                ) : null}
              </div>
            )) : <p className="rounded-2xl bg-white p-5 text-center text-xs text-[#7b847c] ring-1 ring-[#e7e9e1]">{kk ? "Барлық өзгерістер синхрондалған." : "Все изменения синхронизированы."}</p>}
          </div>
          {online && pending.length ? <button type="button" disabled={syncing} onClick={() => void sync()} className="min-h-12 w-full rounded-2xl bg-[#07866b] text-sm font-bold text-white disabled:opacity-60">{kk ? "Қазір жіберу" : "Отправить сейчас"}</button> : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
