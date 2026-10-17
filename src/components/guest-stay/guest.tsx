"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { readApi } from "@/components/communications/api";
import type { GuestStayView } from "@/lib/guest-stay/service";
import type { GuestAgreementView } from "@/lib/agreements/service";
import { inputClass, buttonClass, secondaryClass } from "./styles";
export function GuestStayPage() {
  const token = useRef("");
  const [secret, setSecret] = useState("");
  const dirty = useRef(false);
  const inFlight = useRef(false);
  const [data, setData] = useState<GuestStayView | null>(null),
    [form, setForm] = useState({
      firstName: "",
      lastName: "",
      phone: "",
      arrivalTime: "",
    });
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [accepted, setAccepted] = useState<string[]>([]),
    [intent, setIntent] = useState(false),
    [intentHash, setIntentHash] = useState("");
  async function command<T>(body: object) {
    return fetch("/api/guest/stay", {
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, token: token.current }),
    }).then(readApi<T>);
  }
  const load = useCallback(async () => {
    if (!token.current) return;
    try {
      const v = await command<GuestStayView>({ action: "load" });
      setData(v);
      if (!dirty.current) setForm(v.form);
      setError("");
    } catch (e) {
      setData(null);
      setError(
        e instanceof Error
          ? e.message
          : "Нет связи. Приватные сведения скрыты; попробуйте ещё раз.",
      );
    }
  }, []);
  useEffect(() => {
    token.current = location.hash.slice(1);
    queueMicrotask(() => setSecret(token.current));
    // Keep fragment for reload/return. It is never sent in HTTP URLs or persisted in storage.
    if (!/^[a-f0-9]{64}$/.test(token.current)) {
      setError("Откройте полную персональную ссылку от хозяина.");
      return;
    }
    void load();
    const refresh = () => {
      if (!document.hidden) void load();
      else setData((v) => (v ? { ...v, access: null } : v));
    };
    const clearAccess = () => setData((v) => (v ? { ...v, access: null } : v));
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("pagehide", clearAccess);
    document.addEventListener("visibilitychange", refresh);
    const timer = setInterval(refresh, 15000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("pagehide", clearAccess);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  async function run(work: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Не удалось сохранить. Повторите: дубли не создаются.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function save(submit: boolean) {
    if (!data) return;
    await run(async () => {
      const v = await command<GuestStayView>({
        action: "save",
        version: data.version,
        revision: data.revision,
        form,
        submit,
      });
      dirty.current = false;
      setData(v);
      setForm(v.form);
      setNotice(
        submit
          ? "Данные переданы хозяину. Ожидайте подтверждения"
          : "Черновик сохранён на сервере для этой ссылки.",
      );
    });
  }
  async function download(itemId?: string, bundleId?: string) {
    await run(async () => {
      const r = await fetch("/api/guest/stay", {
        method: "POST",
        cache: "no-store",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.current,
          action: "agreement",
          command: itemId ? "pdf" : "evidence",
          ...(itemId ? { itemId } : {}),
          ...(bundleId ? { bundleId } : {}),
        }),
      });
      if (!r.ok) await readApi(r);
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = itemId ? "document.pdf" : "acknowledgement.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
  }
  const agreement =
    data?.agreement && "items" in data.agreement
      ? (data.agreement as GuestAgreementView)
      : null;
  const waiting = data?.formState === "SUBMITTED" && !data.needsResubmit;
  return (
    <main className="mx-auto min-h-dvh w-full max-w-xl space-y-5 px-4 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] [overflow-wrap:anywhere]">
      <h1 className="text-2xl font-semibold">Ваше проживание</h1>
      <p className="text-sm text-muted-foreground">
        Ссылка даёт доступ к данным этой поездки, но не подтверждает личность.
        Не пересылайте её посторонним. Заполнение не означает оплату или
        разрешение входа.
      </p>
      {error ? (
        <div role="alert" className="rounded-xl border p-3">
          <p>{error}</p>
          <button className={secondaryClass} onClick={() => void load()}>
            Обновить состояние
          </button>
        </div>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
      {!data && !error ? <p role="status">Загружаем…</p> : null}
      {data ? (
        <>
          <section className="space-y-2 rounded-2xl border bg-card p-4">
            <h2 className="text-xl font-semibold">{data.title}</h2>
            <p>
              Заезд: {data.checkIn}, {data.checkInTime}
            </p>
            <p>
              Выезд: {data.checkOut}, {data.checkOutTime} · {data.timezone}
            </p>
            <p>{data.paymentNote}</p>
            {data.agreedTotal !== null ? (
              <p>
                Согласованное проживание: {data.agreedTotal} {data.currency}
              </p>
            ) : null}
            {data.deposit !== null && Number(data.deposit) > 0 ? (
              <p>
                Возвратный депозит отдельно: {data.deposit} {data.currency}
              </p>
            ) : null}
          </section>
          {data.cancelled || data.ended ? (
            <p>
              Проживание отменено или завершено. Актуальные инструкции доступа
              не выдаются.
            </p>
          ) : null}
          {data.access ? (
            <section className="space-y-4 rounded-2xl border bg-card p-4">
              <h2 className="text-xl font-semibold">Когда и куда приехать</h2>
              <p>
                {form.firstName} {form.lastName}
              </p>
              {data.access.address ? <p>{data.access.address}</p> : null}
              {data.access.mapLink ? (
                <a
                  className="inline-flex min-h-11 items-center underline"
                  href={data.access.mapLink}
                  rel="noreferrer"
                >
                  Открыть маршрут
                </a>
              ) : null}
              <PrivateEntryPhotos
                positions={data.access.entryPhotoPositions}
                token={secret}
              />
              {data.access.keyInstructions ? (
                <div>
                  <h3 className="font-semibold">Как войти</h3>
                  <p className="whitespace-pre-wrap">
                    {data.access.keyInstructions}
                  </p>
                </div>
              ) : null}
              {data.access.checkinGuideLink ? (
                <a
                  className="block min-h-11 underline"
                  href={data.access.checkinGuideLink}
                  rel="noreferrer"
                >
                  Инструкция заселения
                </a>
              ) : null}
              {data.access.wifiName || data.access.wifiPassword ? (
                <div>
                  <h3 className="font-semibold">Wi-Fi</h3>
                  <p>{data.access.wifiName}</p>
                  <p>{data.access.wifiPassword}</p>
                </div>
              ) : null}
              {data.access.parking ? (
                <div>
                  <h3 className="font-semibold">Парковка</h3>
                  <p className="whitespace-pre-wrap">{data.access.parking}</p>
                </div>
              ) : null}
              {data.access.checkoutInstructions ? (
                <div>
                  <h3 className="font-semibold">Выезд</h3>
                  <p className="whitespace-pre-wrap">
                    {data.access.checkoutInstructions}
                  </p>
                </div>
              ) : null}
              {data.access.supportPhone ? (
                <p>Контакт хозяина: {data.access.supportPhone}</p>
              ) : null}
              {data.access.rulesLink ? (
                <a
                  className="block min-h-11 underline"
                  href={data.access.rulesLink}
                  rel="noreferrer"
                >
                  Бытовые правила
                </a>
              ) : null}
            </section>
          ) : waiting ? (
            <p role="status">
              Данные переданы хозяину. Ожидайте подтверждения. Доступ к
              заселению закрыт.
            </p>
          ) : null}
          {!waiting && !data.cancelled && !data.ended ? (
            <form
              className="space-y-4 rounded-2xl border p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void save(true);
              }}
            >
              <h2 className="text-xl font-semibold">Данные для этой поездки</h2>
              <p>
                Они нужны хозяину для подготовки заселения. Общая карточка гостя
                не изменяется.
              </p>
              {data.knownGuestName ? (
                <p>
                  В брони указано: {data.knownGuestName}. Уточните имя и фамилию
                  ниже для проверки хозяином.
                </p>
              ) : null}
              {data.correctionReason ? (
                <p role="status">
                  Хозяин просит исправить: {data.correctionReason}
                </p>
              ) : null}
              {data.needsResubmit && data.formState === "SUBMITTED" ? (
                <p>
                  Условия поездки изменились. Проверьте их и передайте данные
                  повторно.
                </p>
              ) : null}
              {(
                [
                  ["firstName", "Имя"],
                  ["lastName", "Фамилия"],
                  ["phone", "Контактный телефон"],
                  ["arrivalTime", "Ожидаемое время прибытия"],
                ] as const
              ).map(([key, label]) => (
                <label className="block min-w-0" key={key}>
                  {label}
                  <input
                    className={inputClass}
                    name={key}
                    autoComplete={
                      key === "firstName"
                        ? "given-name"
                        : key === "lastName"
                          ? "family-name"
                          : key === "phone"
                            ? "tel"
                            : "off"
                    }
                    type={
                      key === "arrivalTime"
                        ? "time"
                        : key === "phone"
                          ? "tel"
                          : "text"
                    }
                    required={
                      key === "firstName" ||
                      key === "lastName" ||
                      (key === "arrivalTime" && data.requireArrival)
                    }
                    maxLength={key === "phone" ? 40 : 80}
                    value={form[key]}
                    onChange={(e) => {
                      dirty.current = true;
                      setForm((v) => ({ ...v, [key]: e.target.value }));
                    }}
                  />
                </label>
              ))}
              {data.identityMode === "ORIGINAL_AT_ARRIVAL" ? (
                <p>
                  При заселении покажите оригинал документа администратору.
                  Фотография не нужна и не хранится.
                </p>
              ) : null}
              <p className="text-sm text-muted-foreground">
                Перед обновлением страницы сохраните черновик. Данные не
                сохраняются в localStorage.
              </p>
              <div className="grid gap-2">
                <button
                  type="button"
                  className={secondaryClass}
                  disabled={busy}
                  onClick={() => void save(false)}
                >
                  Сохранить черновик
                </button>
                <button
                  className={buttonClass}
                  disabled={busy || (data.requireAgreement && !data.consent)}
                >
                  {busy ? "Сохраняем…" : "Передать данные хозяину"}
                </button>
              </div>
            </form>
          ) : null}
          {data.agreementHistory.length ? (
            <section>
              <h2 className="font-semibold">Ранее принятые условия</h2>
              {data.agreementHistory.map((b) => (
                <button
                  key={b.id}
                  className={secondaryClass}
                  disabled={busy}
                  onClick={() => void download(undefined, b.id)}
                >
                  Протокол {b.acceptedAt}
                </button>
              ))}
            </section>
          ) : null}
          {data.agreementError ? (
            <p role="alert">{data.agreementError}</p>
          ) : null}
          {agreement ? (
            <section className="space-y-4 rounded-2xl border p-4">
              <h2 className="text-xl font-semibold">Условия поездки</h2>
              <p>
                {agreement.guestAcceptedAt
                  ? `Ознакомление зафиксировано: ${agreement.guestAcceptedAt}`
                  : "Откройте полные документы перед подтверждением."}
              </p>
              {agreement.items.map((i) => (
                <article className="space-y-2 border-t pt-3" key={i.id}>
                  <h3 className="font-semibold">
                    {i.title}
                    {i.required ? " · обязательно" : " · информация"}
                  </h3>
                  {i.text ? (
                    <p className="whitespace-pre-wrap">{i.text}</p>
                  ) : null}
                  {i.hasPdf ? (
                    <button
                      className={secondaryClass}
                      disabled={busy}
                      onClick={() => void download(i.id)}
                    >
                      Полный документ PDF
                    </button>
                  ) : null}
                  {!agreement.guestAcceptedAt && i.kind !== "INFORMATION" ? (
                    <label className="flex min-h-11 gap-3 py-2">
                      <input
                        type="checkbox"
                        className="mt-1 size-5 shrink-0"
                        checked={accepted.includes(i.id)}
                        onChange={(e) =>
                          setAccepted((v) =>
                            e.target.checked
                              ? [...v, i.id]
                              : v.filter((x) => x !== i.id),
                          )
                        }
                      />
                      Я ознакомился и принимаю этот документ
                    </label>
                  ) : null}
                </article>
              ))}
              {!agreement.guestAcceptedAt ? (
                <>
                  <label className="flex min-h-11 gap-3">
                    <input
                      className="mt-1 size-5 shrink-0"
                      type="checkbox"
                      checked={intent && intentHash === agreement.bundleHash}
                      onChange={(e) => {
                        setIntent(e.target.checked);
                        setIntentHash(agreement.bundleHash);
                      }}
                    />
                    {agreement.consentText}
                  </label>
                  <button
                    className={`${buttonClass} w-full`}
                    disabled={
                      busy ||
                      !intent ||
                      intentHash !== agreement.bundleHash ||
                      !form.firstName.trim() ||
                      !form.lastName.trim() ||
                      agreement.items.some(
                        (i) => i.required && !accepted.includes(i.id),
                      )
                    }
                    onClick={() =>
                      void run(async () => {
                        await command({
                          action: "agreement",
                          command: "accept",
                          bundleHash: agreement.bundleHash,
                          acceptedItems: accepted,
                          signerName:
                            `${form.firstName} ${form.lastName}`.trim(),
                          intent: true,
                        });
                        await load();
                      })
                    }
                  >
                    Подтвердить ознакомление
                  </button>
                </>
              ) : (
                <button
                  className={secondaryClass}
                  disabled={busy}
                  onClick={() => void download()}
                >
                  Скачать протокол ознакомления
                </button>
              )}
              <p className="text-sm text-muted-foreground">
                Это фиксация действия, не ЭЦП и не независимая проверка
                личности.
              </p>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}

function PrivateEntryPhotos({
  positions,
  token,
}: {
  positions: number[];
  token: string;
}) {
  const [images, setImages] = useState<string[]>([]);
  const key = positions.join(",");
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    const abort = new AbortController();
    void Promise.all(
      key
        ? key.split(",").map(async (position) => {
            const response = await fetch("/api/guest/stay", {
              method: "POST",
              cache: "no-store",
              credentials: "omit",
              signal: abort.signal,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "photo",
                token,
                position: Number(position),
              }),
            });
            if (!response.ok) return null;
            const url = URL.createObjectURL(await response.blob());
            urls.push(url);
            return url;
          })
        : [],
    )
      .then((values) => {
        if (!cancelled) setImages(values.filter((v): v is string => !!v));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      abort.abort();
      urls.forEach((v) => URL.revokeObjectURL(v));
    };
  }, [key, token]);
  // Authenticated blobs only: never a public image URL or shared optimizer.
  return images.length ? (
    <section>
      <h3 className="font-semibold">Фотографии входа</h3>
      {images.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={url}
          src={url}
          alt={`Вход · ${i + 1}`}
          width={600}
          height={450}
          className="mt-2 h-auto w-full rounded-xl"
        />
      ))}
    </section>
  ) : null;
}
