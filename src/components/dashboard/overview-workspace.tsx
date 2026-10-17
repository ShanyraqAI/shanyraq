"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ReadResource } from "@/lib/offline/read-resource";
import { clearReadSnapshots, READ_SNAPSHOTS_CLEARED } from "@/lib/offline/read-snapshots";
import { ACTIVE_SCOPE_KEY } from "@/lib/offline/outbox";
import { OVERVIEW_BLOCKS, overviewParams, type OverviewContext, type OverviewData, type OverviewBlock } from "@/lib/dashboard/overview-types";
import { validateOverviewBlock } from "@/lib/dashboard/overview-validation";
import { OverviewView } from "./overview-view";

type Resources = { [K in OverviewBlock]: ReadResource<OverviewData[K]> };
const OutletContext = createContext<ReactNode | undefined>(undefined);
const onlineSnapshot = () => navigator.onLine;
function onlineSubscribe(notify: () => void) {
  window.addEventListener("online", notify); window.addEventListener("offline", notify);
  return () => { window.removeEventListener("online", notify); window.removeEventListener("offline", notify); };
}

export function OverviewWorkspace({ context, children }: { context: OverviewContext; children: ReactNode }) {
  const pathname = usePathname();
  const [denied, setDenied] = useState<number | null>(null);
  const online = useSyncExternalStore(onlineSubscribe, onlineSnapshot, () => true);
  const overviewScroll = useRef(0);
  const [boot] = useState(context);
  // The server layout keys this provider by identity, permissions, day and locale.
  const resources = useMemo(() => {
    const value = {} as Resources;
    function onDenied(status: number) {
      Object.values(value).forEach((resource) => resource.stop());
      setDenied(status);
      void clearReadSnapshots(boot.scope).catch(() => undefined);
    }
    function make<K extends OverviewBlock>(block: K) {
      return new ReadResource<OverviewData[K]>({
        scope: boot.scope, params: overviewParams(boot), resource: `overview:${block}`,
        url: `/api/dashboard/overview?block=${block}&day=${encodeURIComponent(boot.day)}`,
        validate: (data): data is OverviewData[K] => validateOverviewBlock(block, data), onDenied,
      });
    }
    value.core = make("core"); value.attention = make("attention"); value.recent = make("recent"); value.channels = make("channels");
    return value;
  }, [boot]);
  const core = useSyncExternalStore(resources.core.subscribe, resources.core.getSnapshot, resources.core.getSnapshot);
  const attention = useSyncExternalStore(resources.attention.subscribe, resources.attention.getSnapshot, resources.attention.getSnapshot);
  const recent = useSyncExternalStore(resources.recent.subscribe, resources.recent.getSnapshot, resources.recent.getSnapshot);
  const channels = useSyncExternalStore(resources.channels.subscribe, resources.channels.getSnapshot, resources.channels.getSnapshot);
  const active = pathname === "/dashboard";
  const allowedBlocks = useMemo(() => OVERVIEW_BLOCKS.filter((block) => block !== "recent" || boot.permissions.includes("RESERVATIONS")), [boot]);

  useEffect(() => {
    const current = boot;
    const halt = () => {
      Object.values(resources).forEach((resource) => resource.stop());
      setDenied((status) => status ?? 409);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === ACTIVE_SCOPE_KEY && event.newValue !== current.deviceScope) {
        halt(); void clearReadSnapshots(current.scope).catch(() => undefined);
      }
    };
    const cleared = (event: Event) => {
      const scope = (event as CustomEvent<string | undefined>).detail;
      if (!scope || scope === current.scope) halt();
    };
    const refresh = () => {
      try {
        const deviceScope = window.localStorage.getItem(ACTIVE_SCOPE_KEY);
        if (deviceScope !== null && deviceScope !== current.deviceScope) { halt(); return; }
      } catch { /* IndexedDB/in-memory reads can still work with localStorage denied. */ }
      if (document.visibilityState !== "visible") return;
      allowedBlocks.forEach((block) => { void resources[block].refresh(); });
    };
    allowedBlocks.forEach((block) => { resources[block].start(); void resources[block].hydrate(); });
    refresh();
    window.addEventListener("storage", storage);
    window.addEventListener(READ_SNAPSHOTS_CLEARED, cleared);
    window.addEventListener("online", refresh);
    window.addEventListener("shanyraq-read-invalidate", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      Object.values(resources).forEach((resource) => resource.stop());
      window.removeEventListener("storage", storage);
      window.removeEventListener(READ_SNAPSHOTS_CLEARED, cleared);
      window.removeEventListener("online", refresh);
      window.removeEventListener("shanyraq-read-invalidate", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [allowedBlocks, resources, boot]);

  // Opening the section/revalidated server children triggers independent background reads, never a cleared screen.
  useEffect(() => {
    if (!denied && active) allowedBlocks.forEach((block) => { void resources[block].refresh(); });
  }, [active, children, denied, resources, allowedBlocks]);

  useLayoutEffect(() => {
    if (active) window.scrollTo(0, overviewScroll.current);
  }, [active]);

  function captureNavigation(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
    if (!target || target.hasAttribute("download") || (target.target && target.target !== "_self")) return;
    const url = new URL(target.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (active && url.pathname !== "/dashboard") overviewScroll.current = window.scrollY;
    if (denied || !core.snapshot || url.pathname !== "/dashboard" || url.search || url.hash) return;
    // A real client-rendered destination replaces the route outlet; no RSC/API is awaited.
    event.preventDefault();
    if (!active) window.history.pushState(null, "", "/dashboard");
  }

  if (denied) return <div role="alert" className="mx-auto max-w-xl space-y-3 p-6">
    <p>{denied === 401 ? "Сессия завершена. Войдите снова." : "Рабочий контекст изменился. Обновите приложение."}</p>
    <a className="font-medium underline" href={denied === 401 ? "/login" : "/dashboard"}>{denied === 401 ? "Войти" : "Обновить"}</a>
  </div>;

  const states = [core, attention, recent, channels];
  const status = <div className="mb-3 text-xs text-muted-foreground" role="status" aria-live="polite">
    {!online ? "Нет сети. " : states.some((state) => state.refreshing) ? "Обновление в фоне. " : ""}
    {core.snapshot ? `Сохранённые показатели на ${new Date(core.snapshot.syncedAt).toLocaleString(context.locale === "kk" ? "kk-KZ" : "ru-RU")}. Актуальность доступности и финансов требует проверки.` : "Для первой загрузки нужен интернет."}
    {states.some((state) => state.error) ? <span> Обновить часть данных не удалось; сохранённые данные не удалены.</span> : null}
    {states.some((state) => state.persistenceError) ? <span> Хранилище устройства недоступно: данные этой сессии не гарантированы после закрытия.</span> : null}
  </div>;
  const outlet = <>
    {/* Only the prepared Overview and the current server route are retained, not every screen. */}
    <div hidden={!active} data-instant-overview>
      {status}
      {core.snapshot ? <OverviewView context={boot} core={core.snapshot.data} attention={attention.snapshot?.data} recent={recent.snapshot?.data} channels={channels.snapshot?.data} /> : <div className="rounded-xl border p-5" role="status"><h1 className="text-xl font-semibold">Обзор</h1><p className="mt-2 text-sm">{online ? "Первоначальная загрузка данных…" : "Обзор ещё не подготовлен на этом устройстве."}</p><button className="mt-3 underline" onClick={() => { void resources.core.refresh(true); }}>Повторить</button></div>}
    </div>
  </>;
  return <div onClickCapture={captureNavigation}><OutletContext.Provider value={outlet}>{children}</OutletContext.Provider></div>;
}

export function OverviewOutlet({ children }: { children: ReactNode }) {
  const overview = useContext(OutletContext);
  const pathname = usePathname();
  if (overview === undefined) return children;
  return <>{overview}<div hidden={pathname === "/dashboard"}>{children}</div></>;
}
