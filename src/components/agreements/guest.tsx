"use client";
import { useEffect, useState, useRef } from "react";
import { readApi } from "@/components/communications/api";
import type { GuestAgreementView } from "@/lib/agreements/service";
const CONSENT_VERSION = "bundle-acknowledgement-v1";
const input =
  "min-h-12 w-full min-w-0 rounded-xl border bg-white px-3 py-3 text-base text-[#203b30]";
const button =
  "min-h-12 w-full rounded-xl bg-[#087e68] px-4 py-3 text-base font-semibold text-white disabled:opacity-50";
const secondary = "text-sm leading-relaxed text-[#52645a]";
export function GuestAgreement() {
  const tokenRef = useRef("");
  const [secret, setSecret] = useState("");
  const [data, setData] = useState<GuestAgreementView | null>(null);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [intent, setIntent] = useState(false);
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState("");
  const [otpKey, setOtpKey] = useState("");
  const [otpUntil, setOtpUntil] = useState(0);
  const [clock, setClock] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function command<T>(body: object, value = secret): Promise<T> {
    return fetch("/api/agreements/guest", {
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, token: value }),
    }).then(readApi<T>);
  }
  useEffect(() => {
    const t = tokenRef.current || location.hash.slice(1);
    tokenRef.current = t;
    // No capability token in history, analytics, localStorage or referrers.
    history.replaceState(null, "", location.pathname);
    if (!/^[a-f0-9]{64}$/.test(t)) {
      setError("Откройте полную ссылку, которую прислал владелец.");
      return;
    }
    setSecret(t);
    const controller = new AbortController();
    fetch("/api/agreements/guest", {
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "load", token: t }),
    })
      .then(readApi<GuestAgreementView>)
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Не удалось загрузить пакет.",
          );
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось выполнить действие.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function download(itemId?: string) {
    const response = await fetch("/api/agreements/guest", {
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: secret,
        action: itemId ? "pdf" : "evidence",
        ...(itemId ? { itemId } : {}),
      }),
    });
    if (!response.ok) await readApi(response);
    const url = URL.createObjectURL(await response.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = itemId ? "document.pdf" : "agreement-evidence.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async function requestCode(explicitNewKey?: string) {
    // Preserve the same key across network failures: retry must not bill again.
    const key = explicitNewKey || otpKey || crypto.randomUUID();
    setOtpKey(key);
    const r = await command<{
      challengeId: string;
      state: string;
      expiresAt: string;
    }>({ action: "otp", requestKey: key, bundleHash: data!.bundleHash });
    setChallenge(r.challengeId);
    if (r.state === "ACCEPTED") {
      setNotice(
        "Провайдер принял SMS. Доставка пока не подтверждена. Код действует 5 минут.",
      );
      setOtpUntil(Date.now() + 60000);
    } else if (r.state === "UNKNOWN" || r.state === "PENDING") {
      setNotice(
        "Результат отправки неизвестен. Автоматически повторять платную SMS не будем. Новый запрос возможен через 10 минут.",
      );
      setOtpUntil(Date.now() + 600000);
    } else {
      setNotice(
        "Провайдер отклонил SMS. Попросите владельца проверить подключение.",
      );
      setOtpUntil(Date.now() + 60000);
    }
  }
  const completed = !!data?.guestAcceptedAt;
  return (
    <main
      data-clarity-mask="true"
      className="min-h-dvh bg-[#f7f8f4] px-4 py-6 text-base leading-relaxed text-[#203b30] sm:px-6 sm:py-10"
    >
      <div className="mx-auto max-w-2xl space-y-5">
        <header>
          <p className={secondary}>Shanyraq · Документы по брони</p>
          <h1 className="mt-1 text-2xl font-bold">
            {completed
              ? "Ваше подтверждение сохранено"
              : "Ознакомьтесь с пакетом"}
          </h1>
        </header>
        <p className="rounded-2xl border bg-white p-4">
          Это фиксация действий сторон без ЭЦП и независимой проверки личности.
          Юридическая проверка этого способа не выполнена. Открытие страницы
          ничего не подписывает и не оплачивает.
        </p>
        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-300 bg-red-50 p-4 text-[#8c2525]"
          >
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="rounded-xl border bg-white p-4">
            {notice}
          </p>
        ) : null}
        {!data && !error ? <p role="status">Загружаем пакет…</p> : null}
        {data ? (
          <>
            <section className="rounded-2xl border bg-white p-4">
              <h2 className="font-semibold">
                Владелец подтвердил передачу пакета
              </h2>
              <p>{data.ownerName}</p>
              <p className={secondary}>
                {new Date(data.ownerAcceptedAt).toLocaleString("ru-RU")} ·
                Ссылка до {new Date(data.expiresAt).toLocaleString("ru-RU")}
              </p>
              <p className={`${secondary} mt-2 break-all`}>
                Версия SHA-256: {data.bundleHash}
              </p>
            </section>
            <section className="space-y-3" aria-label="Документы и условия">
              {data.items.map((item) => (
                <article
                  key={item.id}
                  className="space-y-3 rounded-2xl border bg-white p-4"
                >
                  <h2 className="text-lg font-semibold">{item.title}</h2>
                  <p className={secondary}>
                    {item.kind === "INFORMATION"
                      ? "Для информации · согласие не требуется"
                      : item.required
                        ? "Обязательно для принятия пакета"
                        : "Необязательно · решаете отдельно"}
                  </p>
                  {item.text ? (
                    <p className="whitespace-pre-wrap break-words">
                      {item.text}
                    </p>
                  ) : null}
                  {item.hasPdf ? (
                    <button
                      disabled={busy}
                      className={`${input} font-semibold`}
                      onClick={() => void run(() => download(item.id))}
                    >
                      Скачать и прочитать полный PDF
                    </button>
                  ) : null}
                  <p className={`${secondary} break-all`}>
                    SHA-256: {item.contentHash}
                  </p>
                  {item.kind !== "INFORMATION" && !completed ? (
                    <label className="flex min-h-12 items-start gap-3 py-2">
                      <input
                        type="checkbox"
                        className="mt-1 size-5 shrink-0 accent-[#087e68]"
                        checked={accepted.includes(item.id)}
                        disabled={busy}
                        onChange={(e) =>
                          setAccepted((v) =>
                            e.target.checked
                              ? [...v, item.id]
                              : v.filter((id) => id !== item.id),
                          )
                        }
                      />
                      <span>Я прочитал(а) и принимаю «{item.title}»</span>
                    </label>
                  ) : null}
                </article>
              ))}
            </section>
            {completed ? (
              <section className="space-y-3 rounded-2xl border bg-white p-4">
                <h2 className="font-semibold">Принято: {data.guestName}</h2>
                <p>{new Date(data.guestAcceptedAt!).toLocaleString("ru-RU")}</p>
                <p className={secondary}>
                  Это не подтверждение отправки сообщения, оплаты или
                  юридической силы договора.
                </p>
                <button
                  className={button}
                  disabled={busy}
                  onClick={() => void run(() => download())}
                >
                  Скачать пакет доказательств
                </button>
              </section>
            ) : (
              <section className="space-y-4 rounded-2xl border bg-white p-4">
                <label className="block space-y-2">
                  <span className="font-semibold">Ваше имя и фамилия</span>
                  <input
                    autoComplete="name"
                    maxLength={160}
                    className={input}
                    value={name}
                    disabled={busy}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="flex min-h-12 items-start gap-3 py-2">
                  <input
                    className="mt-1 size-5 shrink-0 accent-[#087e68]"
                    type="checkbox"
                    checked={intent}
                    disabled={busy}
                    onChange={(e) => setIntent(e.target.checked)}
                  />
                  <span>{data.consentText}</span>
                </label>
                {data.requireOtp ? (
                  <div className="space-y-3 border-t pt-4">
                    <h2 className="font-semibold">
                      Подтверждение доступа к телефону
                    </h2>
                    <p className={secondary}>
                      {data.phone}. Код относится только к этому пакету. Это не
                      проверка личности.
                    </p>
                    {!data.smsConfigured ? (
                      <p role="alert">
                        SMS-провайдер не настроен. Обратитесь к владельцу.
                      </p>
                    ) : (
                      <>
                        <button
                          disabled={busy || otpUntil > clock}
                          className={input}
                          onClick={() =>
                            void run(async () => {
                              if (otpUntil && otpUntil <= Date.now()) {
                                setOtpUntil(0);
                                await requestCode(crypto.randomUUID());
                              } else await requestCode();
                            })
                          }
                        >
                          {otpUntil > clock
                            ? `Повтор через ${Math.ceil((otpUntil - clock) / 1000)} с`
                            : challenge
                              ? "Запросить новый код"
                              : "Запросить SMS-код"}
                        </button>
                        {otpKey ? (
                          <button
                            className={input}
                            disabled={busy}
                            onClick={() => void run(() => requestCode())}
                          >
                            Проверить результат того же запроса
                          </button>
                        ) : null}
                        <label className="block space-y-2">
                          <span>Код из SMS</span>
                          <input
                            className={input}
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            value={code}
                            onChange={(e) =>
                              setCode(e.target.value.replace(/\D/g, ""))
                            }
                          />
                        </label>
                      </>
                    )}
                  </div>
                ) : (
                  <p className={secondary}>
                    Подтверждение по защищённой ссылке. Контроль телефона не
                    проверяется.
                  </p>
                )}
                <button
                  className={button}
                  disabled={
                    busy ||
                    !intent ||
                    name.trim().length < 2 ||
                    data.items.some(
                      (i) => i.required && !accepted.includes(i.id),
                    ) ||
                    (data.requireOtp && (!challenge || code.length !== 6))
                  }
                  onClick={() =>
                    void run(async () =>
                      setData(
                        await command<GuestAgreementView>({
                          action: "accept",
                          bundleHash: data.bundleHash,
                          signerName: name.trim(),
                          acceptedItems: accepted,
                          intent: true,
                          consentVersion: CONSENT_VERSION,
                          ...(data.requireOtp
                            ? { challengeId: challenge, code }
                            : {}),
                        }),
                      ),
                    )
                  }
                >
                  {busy ? "Сохраняем…" : "Зафиксировать моё принятие условий"}
                </button>
              </section>
            )}
            <p className={secondary}>
              Личные документы доступны обладателю ссылки. Не пересылайте её
              посторонним. Владелец может отозвать ссылку; прежние действия и
              версии сохраняются в журнале.
            </p>
          </>
        ) : null}
      </div>
    </main>
  );
}
