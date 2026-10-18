"use client";
import { Publication } from "./publication";
import { copyText } from "./copy";
import { useCallback, useEffect, useRef, useState } from "react";
import { readApi } from "@/components/communications/api";
import type { StayWorkspace } from "@/lib/guest-stay/service";
import { useGuestStayFeatures } from "./context";
import { inputClass, buttonClass, secondaryClass } from "./styles";
type Listing = {
  id?: string;
  version?: number;
  title: string;
  description: string;
  publicLocation: string;
  amenities: string;
  restrictions: string;
  contactUrl: string;
  photoIds: string[];
  ratePlanId: string | null;
  published: boolean;
};
type Policy = {
  version?: number;
  identityMode: string;
  requireArrival: boolean;
  requireAgreement: boolean;
  parking?: string;
  checkoutInstructions?: string;
  entryPhotoIds?: string[];
};
export type Workspace = StayWorkspace & {
  photoScope: string;
  catalogPath: string;
  roomLabel: string;
  listing: Listing | null;
  policy: Policy | null;
  photos: { id: string; name: string }[];
  ratePlans: { id: string; name: string }[];
  catalogEnabled: boolean;
  stayEnabled: boolean;
};
export function OwnerStayBlock(props: {
  reservationId?: string;
  roomId: string;
  checkIn?: string;
  checkOut?: string;
  stayId?: string;
  catalogOnly?: boolean;
}) {
  const features = useGuestStayFeatures();
  if (!features.stay && !features.catalog) return null;
  return <OwnerPanel {...props} />;
}
function OwnerPanel({
  reservationId,
  roomId,
  checkIn = "",
  checkOut = "",
  stayId,
  catalogOnly = false,
}: {
  reservationId?: string;
  roomId: string;
  checkIn?: string;
  checkOut?: string;
  stayId?: string;
  catalogOnly?: boolean;
}) {
  const [data, setData] = useState<Workspace | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [from, setFrom] = useState(checkIn),
    [to, setTo] = useState(checkOut),
    [prepared, setPrepared] = useState("");
  const key = useRef("");
  const inFlight = useRef(false);
  const load = useCallback(async () => {
    const q = new URLSearchParams({
      roomId,
      ...(reservationId ? { reservationId } : {}),
      ...(stayId ? { stayId } : {}),
    });
    const value = await fetch(`/api/guest-stay?${q}`, {
      cache: "no-store",
    }).then(readApi<Workspace>);
    setData(value);
  }, [roomId, reservationId, stayId]);
  useEffect(() => {
    void Promise.resolve()
      .then(load)
      .catch((e) => setError(e.message));
  }, [load]);
  async function command(body: object) {
    if (!data) throw new Error("Обновите страницу.");
    return fetch("/api/guest-stay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-shanyraq-scope": data.scope,
      },
      body: JSON.stringify(body),
    }).then(readApi);
  }
  async function run(work: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось выполнить действие.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function create() {
    await run(async () => {
      key.current ||= crypto.randomUUID();
      await command({
        action: "create",
        roomId,
        ...(reservationId ? { reservationId } : {}),
        checkIn: from,
        checkOut: to,
        requestKey: key.current,
      });
      setNotice(
        "Персональная ссылка подготовлена. Выберите способ передачи ниже.",
      );
    });
  }
  function prepare(s: Workspace["stays"][number], access: boolean) {
    setPrepared(
      `${access ? "Информация для заселения доступна по вашей персональной ссылке." : "Заполните, пожалуйста, данные для поездки и ознакомьтесь с условиями."}\n${s.message}\n${s.url}\nНе пересылайте ссылку посторонним.`,
    );
    setNotice("Текст подготовлен. Это ещё не отправка сообщения.");
  }
  function share() {
    if (!navigator.share) {
      setNotice("Системная передача недоступна. Используйте копирование.");
      return;
    }
    // Called directly in the click event, never after await/create/fetch.
    void navigator.share({ text: prepared }).then(
      () =>
        setNotice(
          "Управление вернулось из меню передачи. Доставка сообщения не подтверждена.",
        ),
      (e) =>
        setNotice(
          e?.name === "AbortError"
            ? "Передача отменена. Сообщение не отмечено отправленным."
            : "Не удалось открыть передачу. Можно скопировать текст.",
        ),
    );
  }
  if (catalogOnly)
    return (
      <section className="min-w-0 space-y-5" aria-label="Настройка каталога">
        {error ? (
          <p role="alert" className="rounded-xl border p-3">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="rounded-xl border p-3 text-sm">
            {notice}
          </p>
        ) : null}
        {!data && !error ? <p>Загружаем карточку…</p> : null}
        {data?.catalogEnabled ? (
          <Publication
            key={`listing-${data.listing?.version ?? 0}`}
            roomId={roomId}
            data={data}
            busy={busy}
            run={run}
            command={command}
            onSaved={setNotice}
          />
        ) : null}
      </section>
    );
  const stays = reservationId ? data?.stays.slice(0, 1) : data?.stays;
  return (
    <section
      className="min-w-0 space-y-4 rounded-2xl border bg-card p-4 [overflow-wrap:anywhere]"
      aria-label="Гость и заселение"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Гость и заселение</h2>
        <button
          className={secondaryClass}
          disabled={busy}
          onClick={() => void run(load)}
        >
          Обновить
        </button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {!data && !error ? <p>Загрузка…</p> : null}
      {data ? (
        <>
          {!reservationId && data.catalogEnabled ? (
            <a
              className={`${secondaryClass} inline-flex items-center`}
              href={`/dashboard/rooms/${encodeURIComponent(roomId)}/catalog`}
            >
              Настроить страницу квартиры
            </a>
          ) : null}
          {!reservationId && data.stayEnabled ? (
            <PolicySettings
              key={`policy-${data.policy?.version ?? 0}`}
              roomId={roomId}
              data={data}
              busy={busy}
              run={run}
              command={command}
            />
          ) : null}
          {data.stayEnabled && (!reservationId || !stays?.length) ? (
            <div className="space-y-3">
              {!reservationId ? (
                <>
                  <h3 className="font-semibold">Предварительная запись</h3>
                  <p className="text-sm">
                    Без выдуманных имени и контакта. Не блокирует календарь.
                    Перед разрешением доступа потребуется связать с обычной
                    бронью.
                  </p>
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    <label className="min-w-0">
                      Заезд
                      <input
                        type="date"
                        className={inputClass}
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                      />
                    </label>
                    <label className="min-w-0">
                      Выезд
                      <input
                        type="date"
                        className={inputClass}
                        min={from}
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                      />
                    </label>
                  </div>
                </>
              ) : null}
              <button
                className={buttonClass}
                disabled={busy || !from || !to}
                onClick={() => void create()}
              >
                {reservationId
                  ? "Отправить форму гостю"
                  : "Создать предварительную запись и ссылку"}
              </button>
              {reservationId ? (
                <button className={`${secondaryClass} ml-2`} disabled>
                  Отправить страницу заселения
                </button>
              ) : null}
            </div>
          ) : null}
          {stays?.map((s) => (
            <div key={s.id} className="space-y-3 border-t pt-3">
              {!reservationId ? <p>{s.message}</p> : null}
              <p className="text-sm">
                Данные:{" "}
                {s.formState === "SUBMITTED"
                  ? "заполнены"
                  : s.formState === "CORRECTION"
                    ? "нужны исправления"
                    : "не переданы"}{" "}
                · Ознакомление:{" "}
                {s.consent
                  ? s.requireAgreement
                    ? "зафиксировано"
                    : "не требуется"
                  : "не получено"}{" "}
                · Проверка: {s.reviewed ? "выполнена" : "ожидается"} · Доступ:{" "}
                {s.allowed ? "разрешён" : "закрыт"}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  className={buttonClass}
                  disabled={busy || !s.url}
                  onClick={() => prepare(s, false)}
                >
                  Отправить форму гостю
                </button>
                <button
                  className={buttonClass}
                  disabled={busy || !s.allowed || !s.url}
                  onClick={() => prepare(s, true)}
                >
                  Отправить страницу заселения
                </button>
              </div>
              <p className="text-sm text-muted-foreground">{s.reason}</p>
              <details>
                <summary className="min-h-11 cursor-pointer py-2 font-semibold">
                  Проверка, условия и разрешение
                </summary>
                <div className="space-y-3">
                  <p>
                    В общей карточке: {s.knownGuestName || "не указано"} ·{" "}
                    {s.knownPhone || "контакт не указан"}
                  </p>
                  <p>
                    В этой форме: {s.form.firstName} {s.form.lastName} ·{" "}
                    {s.form.phone || "контакт не указан"} · прибытие{" "}
                    {s.form.arrivalTime || "не указано"}
                  </p>
                  <p className="text-sm">
                    Общая карточка гостя не изменяется. Проверка оригинала —
                    отметка администратора, не независимая проверка подлинности.
                    Отзыв ссылки не меняет уже выданные коды двери.
                  </p>
                  <Decision
                    s={s}
                    busy={busy}
                    run={run}
                    command={command}
                    onChange={() => setPrepared("")}
                  />
                  <p className="text-xs">Срок ссылки: {s.expiresAt}</p>
                  <h4 className="font-semibold">История решений</h4>
                  <ul className="space-y-2 text-sm">
                    {s.events.map((e) => (
                      <li key={e.id}>
                        {e.createdAt} · {e.action} ·{" "}
                        {e.actorId || "гость по ссылке"}
                        {e.reason ? ` · ${e.reason}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            </div>
          ))}
          {prepared ? (
            <div className="space-y-2 border-t pt-3">
              <label className="block">
                Готовый текст
                <textarea
                  readOnly
                  rows={7}
                  className={inputClass}
                  value={prepared}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  className={secondaryClass}
                  onClick={() => {
                    void copyText(prepared).then(
                      () =>
                        setNotice(
                          "Текст скопирован. Отправка не подтверждена.",
                        ),
                      () =>
                        setNotice(
                          "Не удалось скопировать. Выделите текст вручную.",
                        ),
                    );
                  }}
                >
                  Скопировать текст
                </button>
                <button className={secondaryClass} onClick={share}>
                  Системное меню передачи
                </button>
                <button
                  className={secondaryClass}
                  onClick={() => setPrepared("")}
                >
                  Закрыть
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
export type Operations = {
  busy: boolean;
  run: (work: () => Promise<void>) => Promise<void>;
  command: (body: object) => Promise<unknown>;
};
function Decision({
  s,
  busy,
  run,
  command,
  onChange,
}: Operations & { s: Workspace["stays"][number]; onChange: () => void }) {
  const [decision, setDecision] = useState("ACCEPT"),
    [reason, setReason] = useState(""),
    [referenceId, setReferenceId] = useState("");
  const [requirements, setRequirements] = useState({
    identityMode: s.identityMode,
    requireArrival: s.requireArrival,
    requireAgreement: s.requireAgreement,
  });
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          await command({
            action: "decision",
            stayId: s.id,
            version: s.version,
            decision,
            reason,
            ...(decision === "SET_REQUIREMENTS" ? { requirements } : {}),
            ...(referenceId ? { referenceId } : {}),
          });
          onChange();
        });
      }}
    >
      <label className="block">
        Действие
        <select
          aria-label="Действие"
          className={inputClass}
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
        >
          <option value="ACCEPT">Принять данные этой формы</option>
          <option value="CORRECTION">Запросить исправление</option>
          <option value="GRANT" disabled={!s.canGrant}>
            Разрешить заселение
          </option>
          <option value="SET_REQUIREMENTS">
            Исключения формы для этой брони
          </option>
          <option value="REVOKE_ACCESS">Отозвать разрешение</option>
          <option value="ORIGINAL_CHECKED">Отметить проверку оригинала</option>
          <option value="BIND_AGREEMENT">
            Подключить подготовленный пакет условий
          </option>
          {!s.reservationId ? (
            <option value="LINK_RESERVATION">Связать с реальной бронью</option>
          ) : null}
          <option value="REVOKE_LINK">Отозвать ссылку</option>
          <option value="ROTATE">Заменить ссылку (старую отозвать)</option>
        </select>
      </label>
      {decision === "SET_REQUIREMENTS" ? (
        <fieldset className="space-y-2">
          <legend>
            Только эта бронь; потребуется повторная отправка формы
          </legend>
          <select
            aria-label="Режим проверки оригинала"
            className={inputClass}
            value={requirements.identityMode}
            onChange={(e) =>
              setRequirements((v) => ({ ...v, identityMode: e.target.value }))
            }
          >
            <option value="NONE">Без документа</option>
            <option value="ORIGINAL_AT_ARRIVAL">
              Проверка оригинала при заселении
            </option>
          </select>
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={requirements.requireArrival}
              onChange={(e) =>
                setRequirements((v) => ({
                  ...v,
                  requireArrival: e.target.checked,
                }))
              }
            />
            Обязательное время прибытия
          </label>
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={requirements.requireAgreement}
              onChange={(e) =>
                setRequirements((v) => ({
                  ...v,
                  requireAgreement: e.target.checked,
                }))
              }
            />
            Обязательный пакет условий
          </label>
        </fieldset>
      ) : null}
      {decision === "BIND_AGREEMENT" ? (
        <label className="block">
          Пакет документов
          <select
            required
            className={inputClass}
            value={referenceId}
            onChange={(e) => setReferenceId(e.target.value)}
          >
            <option value="">Выберите подготовленный пакет без SMS</option>
            {s.bundles.map((b) => (
              <option key={b.id} value={b.id}>
                {b.createdAt} · {b.id}
              </option>
            ))}
          </select>
          <span className="text-sm">
            Создайте пакет через существующий раздел документов брони. Здесь он
            будет доступен гостю по той же ссылке.
          </span>
        </label>
      ) : null}
      {decision === "LINK_RESERVATION" ? (
        <label className="block">
          ID существующей брони
          <input
            required
            maxLength={100}
            className={inputClass}
            value={referenceId}
            onChange={(e) => setReferenceId(e.target.value)}
          />
        </label>
      ) : null}
      <label className="block">
        Причина / пояснение
        <textarea
          required
          minLength={3}
          maxLength={1000}
          rows={2}
          className={inputClass}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <span className="text-sm">
          Без кодов доступа, документов и других секретов. Причина исправления
          будет видна гостю.
        </span>
      </label>
      <button
        className={secondaryClass}
        disabled={busy || (decision === "GRANT" && !s.canGrant)}
      >
        Применить решение
      </button>
    </form>
  );
}
function PolicySettings({
  data,
  roomId,
  busy,
  run,
  command,
}: Operations & { data: Workspace; roomId: string }) {
  const [policy, setPolicy] = useState<Policy>(
    data.policy ?? {
      identityMode: "NONE",
      requireArrival: false,
      requireAgreement: false,
    },
  );
  return (
    <details>
      <summary className="min-h-11 cursor-pointer py-2 font-semibold">
        Стандартная форма объекта
      </summary>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await command({
              action: "savePolicy",
              roomId,
              version: data.policy?.version ?? 0,
              policy: {
                identityMode: policy.identityMode,
                requireArrival: policy.requireArrival,
                requireAgreement: policy.requireAgreement,
                parking: policy.parking ?? "",
                checkoutInstructions: policy.checkoutInstructions ?? "",
                entryPhotoIds: policy.entryPhotoIds ?? [],
              },
            });
          });
        }}
      >
        <p className="text-sm">
          Применяется к новым ссылкам всех единиц этого объекта. Уже выданные
          ссылки не меняются незаметно.
        </p>
        <label className="block">
          Документ
          <select
            className={inputClass}
            value={policy.identityMode}
            onChange={(e) =>
              setPolicy((v) => ({ ...v, identityMode: e.target.value }))
            }
          >
            <option value="NONE">Не запрашивается</option>
            <option value="ORIGINAL_AT_ARRIVAL">
              Оригинал при заселении, без копии
            </option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            checked={policy.requireArrival}
            onChange={(e) =>
              setPolicy((v) => ({ ...v, requireArrival: e.target.checked }))
            }
          />
          Время прибытия обязательно
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            checked={policy.requireAgreement}
            onChange={(e) =>
              setPolicy((v) => ({ ...v, requireAgreement: e.target.checked }))
            }
          />
          Нужен подготовленный пакет условий (agreements)
        </label>
        <label className="block">
          Парковка (приватная инструкция)
          <textarea
            maxLength={2000}
            className={inputClass}
            value={policy.parking ?? ""}
            onChange={(e) =>
              setPolicy((v) => ({ ...v, parking: e.target.value }))
            }
          />
        </label>
        <label className="block">
          Инструкция выезда
          <textarea
            maxLength={2000}
            className={inputClass}
            value={policy.checkoutInstructions ?? ""}
            onChange={(e) =>
              setPolicy((v) => ({ ...v, checkoutInstructions: e.target.value }))
            }
          />
        </label>
        <fieldset>
          <legend>Фотографии входа — только после разрешения</legend>
          {data.photos.map((p) => (
            <label key={p.id} className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                checked={(policy.entryPhotoIds ?? []).includes(p.id)}
                onChange={(e) =>
                  setPolicy((v) => ({
                    ...v,
                    entryPhotoIds: e.target.checked
                      ? [...(v.entryPhotoIds ?? []), p.id]
                      : (v.entryPhotoIds ?? []).filter((id) => id !== p.id),
                  }))
                }
              />
              {p.name}
            </label>
          ))}
        </fieldset>
        <button className={secondaryClass} disabled={busy}>
          Сохранить стандартную форму
        </button>
      </form>
    </details>
  );
}
