"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, RefreshCw, LockKeyhole, UnlockKeyhole, Battery, Wifi, History } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ttlockCopy } from "./ttlock-copy";
import { TTLockGuide } from "./ttlock-guide";
import type { AppLocale } from "@/lib/locale";
import { assignTTLockAction, controlTTLockAction, getTTLockOperationsDataAction, issueReservationPasscodeAction, saveTTLockConnectionAction, syncTTLockLocksAction } from "@/server/actions/ttlock";

type Device = { lockId: number; lockName: string; lockAlias?: string; electricQuantity?: number; hasGateway?: number; keyboardPwdVersion?: number };
type Room = { id: string; number: string; type: string; lock: { recordId: string; id: string; name: string; alias: string; battery: number | null; online: boolean | null; state: string | null; gateway: boolean | null; codeVersion: number | null } | null };
type Reservation = { id: string; guest: string; room: string; checkIn: string; checkOut: string };
type Event = { id: string; room: string; summary: string; success: boolean | null; actor: string | null; at: string };
type Operations = { state: string; batteryPercent: number | null; isOnline: boolean | null; records: { recordType: number; success: number; username?: string; lockDate: number }[]; passcodes: { id: string; code: string; name: string; startsAt: number; endsAt: number; status: number }[] };

export function TTLockManager({ connected, appConfigured, rooms, reservations, events, locale }: { locale: AppLocale; connected: boolean; appConfigured: boolean; rooms: Room[]; reservations: Reservation[]; events: Event[] }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [operations, setOperations] = useState<Record<string, Operations>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const copy = ttlockCopy[locale];

  async function syncDevices() {
    setLoading(true); setError("");
    try { setDevices(await syncTTLockLocksAction()); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось загрузить замки"); }
    finally { setLoading(false); }
  }

  async function refreshOperations(recordId: string) {
    setBusy(recordId); setError("");
    try { const data = await getTTLockOperationsDataAction(recordId); setOperations((current) => ({ ...current, [recordId]: data })); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось получить состояние замка"); }
    finally { setBusy(""); }
  }

  function control(recordId: string, command: "lock" | "unlock", roomNumber: string) {
    const text = command === "unlock" ? `Удалённо открыть замок квартиры ${roomNumber}? Убедитесь, что это безопасно.` : `Удалённо закрыть замок квартиры ${roomNumber}?`;
    if (!window.confirm(text)) return;
    setBusy(recordId);
    startTransition(async () => {
      try {
        await controlTTLockAction(recordId, command);
        toast.success(command === "lock" ? "Команда закрытия отправлена" : "Команда открытия отправлена");
        await refreshOperations(recordId);
        router.refresh();
      } catch (e) { toast.error(e instanceof Error ? e.message : "Не удалось выполнить команду"); }
      finally { setBusy(""); }
    });
  }

  return <div className="grid gap-5 lg:grid-cols-2">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-slate-900">{copy.title}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">{copy.intro}</p>
      <form action={async (formData) => { try { await saveTTLockConnectionAction(formData); toast.success(copy.connectedToast); router.refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : copy.failedToast); } }} className="mt-4 space-y-3">
        {!appConfigured && <><p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">Для приложения TTLock не заданы серверные Client ID и Client Secret. Временно укажите их здесь; добавьте TTLOCK_CLIENT_ID и TTLOCK_CLIENT_SECRET в Vercel, чтобы пользователи не вводили ключи приложения.</p><input name="clientId" required placeholder="Client ID приложения" autoComplete="off" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /><input name="clientSecret" required placeholder="Client Secret приложения" autoComplete="new-password" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></>}
        <input name="username" required placeholder={copy.login} autoComplete="username" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
        <input name="password" required type="password" placeholder={copy.password} autoComplete="new-password" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
        <button className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white">{connected ? copy.reconnect : copy.connect}</button>
        {connected && <span className="ml-3 text-xs font-semibold text-emerald-700">{copy.connected}</span>}
      </form>
      <TTLockGuide locale={locale} />
      <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        Для удалённого управления и кодов через API нужен Wi‑Fi замок или замок со шлюзом. Для событий замков задайте `TTLOCK_CALLBACK_TOKEN` на сервере и укажите в приложении TTLock callback: <code className="break-all">https://ВАШ-ДОМЕН/api/ttlock/callback?token=ЗНАЧЕНИЕ_СЕРВЕРНОГО_КЛЮЧА</code>.
      </div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-slate-900">Замки и квартиры</h2><p className="mt-1 text-xs text-slate-500">Состояние, батарея и удалённые команды</p></div>
        <button type="button" disabled={!connected || loading} onClick={syncDevices} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">{loading ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}Загрузить замки</button>
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}
      {devices.length > 0 && <div className="mt-3 max-h-40 space-y-2 overflow-auto">{devices.map((device) => <div key={device.lockId} className="rounded-lg bg-slate-50 px-3 py-2 text-xs"><b>{device.lockName}</b> · ID {device.lockId}{device.lockAlias ? ` · ${device.lockAlias}` : ""}{device.electricQuantity != null ? ` · батарея ${device.electricQuantity}%` : ""}{device.hasGateway === 1 ? " · шлюз" : ""}</div>)}</div>}
      <div className="mt-4 space-y-3">{rooms.map((room) => <div key={room.id} className="rounded-xl border border-slate-100 p-3">
        <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">Квартира {room.number}</p><p className="truncate text-[11px] text-slate-500">{room.lock ? `${room.lock.name} · ${room.lock.state ?? "состояние не обновлено"}` : room.type}</p></div>
          <form action={async (formData) => { try { await assignTTLockAction(formData); toast.success(`Замок привязан к квартире ${room.number}`); router.refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Не удалось привязать замок"); } }} className="flex min-w-0 gap-1"><input type="hidden" name="roomId" value={room.id} /><select name="lockId" required className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-2 text-xs"><option value="">Замок</option>{devices.map((device) => <option key={device.lockId} value={device.lockId}>{device.lockName} · {device.lockId}</option>)}{room.lock && !devices.some((device) => String(device.lockId) === room.lock?.id) && <option value={room.lock.id}>{room.lock.name}</option>}</select><button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Связать</button></form>
          {room.lock && <button type="button" aria-label={`Обновить квартиру ${room.number}`} disabled={busy === room.lock.recordId} onClick={() => refreshOperations(room.lock!.recordId)} className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-50">{busy === room.lock.recordId ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}</button>}
        </div>
        {room.lock && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-slate-600"><Battery className="size-3.5" />{operations[room.lock.recordId]?.batteryPercent ?? room.lock.battery ?? "—"}%</span>
          {room.lock.codeVersion !== null && <span className="rounded-full bg-slate-50 px-2.5 py-1 text-slate-600">Коды V{room.lock.codeVersion}</span>}
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-slate-600"><Wifi className="size-3.5" />{(operations[room.lock.recordId]?.isOnline ?? room.lock.online) === null ? "Связь не проверена" : (operations[room.lock.recordId]?.isOnline ?? room.lock.online) ? "На связи" : "Нет связи"}</span>
          <button type="button" disabled={busy === room.lock.recordId || pending} onClick={() => control(room.lock!.recordId, "lock", room.number)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-700 disabled:opacity-50"><LockKeyhole className="size-3.5" />Закрыть</button>
          <button type="button" disabled={busy === room.lock.recordId || pending} onClick={() => control(room.lock!.recordId, "unlock", room.number)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 font-semibold text-white disabled:opacity-50"><UnlockKeyhole className="size-3.5" />Открыть</button>
        </div>}
        {room.lock && operations[room.lock.recordId] && <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {operations[room.lock.recordId].passcodes.length > 0 && <div><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Коды, найденные в замке</p><div className="flex flex-wrap gap-2">{operations[room.lock.recordId].passcodes.slice(0, 12).map((item) => <span key={item.id} className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-900"><b className="tracking-wider">{item.code}</b> · {item.name} · {new Date(item.endsAt).toLocaleDateString("ru-RU")}</span>)}</div></div>}
          {operations[room.lock.recordId].records.length > 0 && <div><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Последние события</p><div className="space-y-1">{operations[room.lock.recordId].records.slice(0, 5).map((item, index) => <p key={`${item.lockDate}-${index}`} className="text-[11px] text-slate-500">Тип {item.recordType} · {item.success ? "успешно" : "ошибка"}{item.username ? ` · ${item.username}` : ""} · {new Date(item.lockDate).toLocaleString("ru-RU")}</p>)}</div></div>}
        </div>}
      </div>)}</div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
      <h2 className="font-bold text-slate-900">Выпустить код для бронирования</h2><p className="mt-1 text-xs text-slate-500">Временный код будет действовать с заезда до выезда. Точность TTLock — до часа; потребуется удалённо доступный замок с поддержкой кодов V4.</p>
      <form action={async (formData) => { try { await issueReservationPasscodeAction(formData); toast.success("Код создан"); router.refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Не удалось создать код"); } }} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <select required name="reservationId" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm"><option value="">Выберите бронирование</option>{reservations.map((item) => <option key={item.id} value={item.id}>{item.guest} · квартира {item.room} · {new Date(item.checkIn).toLocaleDateString("ru-RU")}–{new Date(item.checkOut).toLocaleDateString("ru-RU")}</option>)}</select>
        <button disabled={!connected} className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Создать код</button>
      </form>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2"><h2 className="flex items-center gap-2 font-bold text-slate-900"><History className="size-4" />События замков</h2>
      {events.length ? <div className="mt-3 divide-y divide-slate-100">{events.map((event) => <div key={event.id} className="flex flex-wrap justify-between gap-2 py-2.5 text-xs"><span className="font-semibold text-slate-700">Квартира {event.room} · {event.summary}{event.success === null ? "" : event.success ? " · успешно" : " · ошибка"}</span><span className="text-slate-500">{event.actor ? `${event.actor} · ` : ""}{new Date(event.at).toLocaleString("ru-RU")}</span></div>)}</div> : <p className="mt-3 text-xs text-slate-500">События появятся после настройки callback URL в TTLock и получения событий от подключённого замка.</p>}
    </section>
  </div>;
}
