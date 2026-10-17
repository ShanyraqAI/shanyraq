import { loadReadSnapshot, saveReadSnapshot, snapshotKey, type ReadSnapshot } from "./read-snapshots";

export interface ReadState<T> {
  snapshot: ReadSnapshot<T> | null;
  refreshing: boolean;
  error: string | null;
  persistenceError: boolean;
}
export interface ReadEnvelope<T> { scope: string; params: string; version: string; data: T }
interface Options<T> {
  scope: string;
  resource: string;
  params: string;
  url: string;
  validate: (data: unknown) => data is T;
  onDenied: (status: number) => void;
  fetcher?: typeof fetch;
  persistence?: { load: typeof loadReadSnapshot<T>; save: typeof saveReadSnapshot<T> };
  retry?: boolean;
}

/** One stable resource per selection; errors never replace previously useful data. */
export class ReadResource<T> {
  private state: ReadState<T> = { snapshot: null, refreshing: false, error: null, persistenceError: false };
  private listeners = new Set<() => void>();
  private flight: Promise<void> | null = null;
  private controller: AbortController | null = null;
  private revision = 0;
  private stopped = false;
  private failures = 0;
  private retryAt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  readonly key: string;
  constructor(private options: Options<T>) {
    this.key = snapshotKey(options.scope, options.resource, options.params);
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private publish(patch: Partial<ReadState<T>>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  async hydrate() {
    try {
      const saved = await (this.options.persistence?.load ?? loadReadSnapshot<T>)(this.key, this.options.scope, this.options.params);
      if (!this.stopped && saved && this.options.validate(saved.data) && !this.state.snapshot)
        this.publish({ snapshot: saved });
    } catch {
      if (!this.stopped) this.publish({ persistenceError: true });
    }
  }
  start() { this.stopped = false; }
  /** Stop makes late fetches and IndexedDB loads harmless after identity changes. */
  stop() {
    this.stopped = true;
    this.revision += 1;
    this.controller?.abort();
    this.flight = null;
    clearTimeout(this.retryTimer);
    this.publish({ snapshot: null, refreshing: false, error: null });
  }
  refresh = (force = false): Promise<void> => {
    if (this.stopped) return Promise.resolve();
    if (this.flight) return this.flight;
    if (!force && Date.now() < this.retryAt) return Promise.resolve();
    if (typeof navigator !== "undefined" && navigator.onLine === false) return Promise.resolve();
    clearTimeout(this.retryTimer);
    const flight = this.request();
    this.flight = flight;
    void flight.finally(() => { if (this.flight === flight) this.flight = null; });
    return flight;
  };
  private async request() {
    const revision = ++this.revision;
    const requestedAt = typeof performance === "undefined" ? Date.now() : performance.timeOrigin + performance.now();
    const controller = new AbortController();
    this.controller = controller;
    this.publish({ refreshing: true });
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const previous = this.state.snapshot;
      const headers: Record<string, string> = { "X-Shanyraq-Read-Scope": this.options.scope };
      if (previous) headers["If-None-Match"] = previous.version;
      const response = await (this.options.fetcher ?? fetch)(this.options.url, {
        cache: "no-store", credentials: "same-origin", headers, signal: controller.signal,
      });
      if (this.stopped || revision !== this.revision) return;
      if ([401, 403, 409].includes(response.status) || response.redirected) {
        this.options.onDenied(response.redirected ? 401 : response.status);
        this.stop();
        return;
      }
      if (!response.ok && response.status !== 304) throw new Error("Не удалось обновить данные. Сохранённая копия остаётся на экране.");
      const envelope: ReadEnvelope<T> | null = response.status === 304 ? null : await response.json();
      if (this.stopped || revision !== this.revision) return;
      if (envelope && (envelope.scope !== this.options.scope || envelope.params !== this.options.params)) {
        this.options.onDenied(409);
        this.stop();
        return;
      }
      if ((!envelope && !previous) || (envelope && !this.options.validate(envelope.data))) throw new Error("Некорректный ответ сервера");
      const record: ReadSnapshot<T> = {
        key: this.key, schema: 1, scope: this.options.scope, params: this.options.params,
        version: envelope?.version ?? previous!.version, syncedAt: Date.now(), requestedAt, data: envelope ? envelope.data : previous!.data,
      };
      this.failures = 0;
      this.retryAt = 0;
      this.publish({ snapshot: record, error: null });
      try {
        await (this.options.persistence?.save ?? saveReadSnapshot<T>)(record);
        if (!this.stopped) this.publish({ persistenceError: false });
      } catch {
        if (!this.stopped) this.publish({ persistenceError: true });
      }
    } catch (error) {
      if (this.stopped || revision !== this.revision) return;
      this.failures += 1;
      const delay = Math.min(60_000, 2000 * 2 ** (this.failures - 1)) + Math.random() * 500;
      this.retryAt = Date.now() + delay;
      this.publish({ error: error instanceof Error ? error.message : "Не удалось обновить данные" });
      if (this.options.retry !== false && this.failures <= 3)
        this.retryTimer = setTimeout(() => {
          if (typeof document === "undefined" || document.visibilityState === "visible") void this.refresh();
        }, delay + 1);
    } finally {
      clearTimeout(timeout);
      if (!this.stopped && revision === this.revision) this.publish({ refreshing: false });
    }
  }
}
