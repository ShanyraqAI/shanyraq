"use client";
import { useEffect, useRef, useState, useId } from "react";
import { Button } from "@/components/ui/button";
import { readApi } from "@/components/communications/api";
import { KASPI_HELP } from "@/lib/guest-payments/policy";
import type {
  PaymentSettings,
  PaymentMethodView,
} from "@/lib/guest-payments/types";
import { paymentPost, PAYMENT_INPUT, PAYMENT_SECONDARY } from "./client";
export function GuestPaymentSettings({
  enabled,
  locale = "ru",
}: {
  enabled: boolean;
  locale?: "ru" | "kk";
}) {
  const [data, setData] = useState<PaymentSettings | null>(null),
    [error, setError] = useState("");
  const kk = locale === "kk";
  async function load() {
    setError("");
    try {
      setData(
        await readApi<PaymentSettings>(
          await fetch("/api/guest-payments?settings=1", { cache: "no-store" }),
        ),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось загрузить настройки",
      );
    }
  }
  useEffect(() => {
    if (!enabled) return;
    const c = new AbortController();
    fetch("/api/guest-payments?settings=1", {
      cache: "no-store",
      signal: c.signal,
    })
      .then(readApi<PaymentSettings>)
      .then(setData)
      .catch((e) => {
        if (!c.signal.aborted)
          setError(e instanceof Error ? e.message : "Ошибка загрузки");
      });
    return () => c.abort();
  }, [enabled]);
  return (
    <section data-clarity-mask="true" className="space-y-4">
      <h2 className="text-xl font-bold">
        {kk ? "Төлем қабылдау · Kaspi Pay" : "Приём оплаты · Kaspi Pay"}
      </h2>
      <p className={PAYMENT_SECONDARY}>
        {kk
          ? "Әр нысанның сілтемесі бөлек сақталады. Бұл банк API қосылымы емес. Соманы қонақ өзі енгізеді."
          : "Ссылка сохраняется отдельно для каждого объекта. Это не подключение банковского API. Гость сам вводит сумму, оплата проверяется вручную в Kaspi Pay."}
      </p>
      <a
        href={KASPI_HELP}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center font-semibold text-primary underline"
      >
        {kk ? "Сілтемені алу нұсқаулығы" : "Как получить ссылку в Kaspi Pay"}
      </a>
      {!enabled ? (
        <p role="status" className={PAYMENT_SECONDARY}>
          {kk
            ? "Әкімші миграция мен Preview тексеруінен кейін қосады."
            : "Администратор включит функцию после проверенной миграции и Preview. Ссылки пока не сохраняются."}
        </p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <Button
            onClick={() => void load()}
            variant="outline"
            className="mt-2 min-h-11"
          >
            {kk ? "Қайта жүктеу" : "Перезагрузить настройки"}
          </Button>
        </div>
      ) : !data ? (
        <p role="status">{kk ? "Жүктелуде…" : "Загружаем…"}</p>
      ) : data.properties.length ? (
        data.properties.map((p) => (
          <MethodForm
            key={`${p.id}:${data.methods.find((m) => m.rentalPropertyId === p.id)?.version ?? 0}`}
            property={p}
            current={data.methods.find((m) => m.rentalPropertyId === p.id)}
            scope={data.scope}
            locale={locale}
            onSaved={(method) =>
              setData((d) =>
                d
                  ? {
                      ...d,
                      methods: [
                        ...d.methods.filter((m) => m.id !== method.id),
                        method,
                      ],
                    }
                  : d,
              )
            }
          />
        ))
      ) : (
        <p>
          {kk
            ? "Алдымен нысан қосыңыз."
            : "Сначала добавьте объект проживания."}
        </p>
      )}
    </section>
  );
}
function MethodForm({
  property,
  current,
  scope,
  onSaved,
  locale,
}: {
  property: { id: string; name: string };
  current?: PaymentMethodView;
  scope: string;
  onSaved: (m: PaymentMethodView) => void;
  locale: "ru" | "kk";
}) {
  const id = useId(),
    busyRef = useRef(false);
  const [name, setName] = useState(current?.name ?? "Kaspi Pay"),
    [recipient, setRecipient] = useState(current?.recipient ?? ""),
    [url, setUrl] = useState(current?.url ?? ""),
    [enabled, setEnabled] = useState(current?.enabled ?? false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const kk = locale === "kk";
  const dirty =
    name !== (current?.name ?? "Kaspi Pay") ||
    recipient !== (current?.recipient ?? "") ||
    url !== (current?.url ?? "") ||
    enabled !== (current?.enabled ?? false);
  useEffect(() => {
    if (!dirty) return;
    const f = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [dirty]);
  return (
    <form
      className="space-y-3 border-t pt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busyRef.current) return;
        busyRef.current = true;
        setBusy(true);
        setError("");
        try {
          onSaved(
            await paymentPost<PaymentMethodView>(scope, {
              action: "saveMethod",
              rentalPropertyId: property.id,
              name,
              recipient,
              url,
              enabled,
              version: current?.version ?? 0,
            }),
          );
        } catch (e) {
          setError(e instanceof Error ? e.message : "Не удалось сохранить");
        } finally {
          busyRef.current = false;
          setBusy(false);
        }
      }}
    >
      <h3 className="font-semibold">{property.name}</h3>
      <p className={PAYMENT_SECONDARY}>
        {current
          ? kk
            ? "Сілтеме сақталған · Банк растауы жоқ"
            : "Ссылка сохранена · Банк и получатель не подтверждены"
          : kk
            ? "Бапталмаған"
            : "Не настроено"}
      </p>
      <fieldset disabled={busy} className="min-w-0 space-y-3">
        <label className="block space-y-1" htmlFor={`${id}-name`}>
          <span>{kk ? "Төлем тәсілі" : "Название способа"}</span>
          <input
            id={`${id}-name`}
            className={PAYMENT_INPUT}
            maxLength={100}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block space-y-1" htmlFor={`${id}-recipient`}>
          <span>{kk ? "Алушы" : "Получатель"}</span>
          <input
            id={`${id}-recipient`}
            className={PAYMENT_INPUT}
            maxLength={160}
            required
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
        </label>
        <label className="block space-y-1" htmlFor={`${id}-url`}>
          <span>
            {kk ? "Сауда нүктесінің сілтемесі" : "Ссылка точки продаж"}
          </span>
          <input
            id={`${id}-url`}
            className={PAYMENT_INPUT}
            type="url"
            inputMode="url"
            autoCapitalize="none"
            maxLength={500}
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <p className={PAYMENT_SECONDARY}>
          {kk
            ? "HTTPS пен домен тексеріледі. Бұл банк тексеруі емес."
            : "Проверяем HTTPS, точный домен pay.kaspi.kz и поддерживаемый путь /pay/…. Это не проверка получателя банком."}
        </p>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="size-5"
          />
          {kk ? "Осы нысан үшін қосу" : "Включить для этого объекта"}
        </label>
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={busy || !dirty}
        className="min-h-12 w-full whitespace-normal hover:bg-primary"
      >
        {busy
          ? kk
            ? "Сақталуда…"
            : "Сохраняем…"
          : kk
            ? "Сілтемені сақтау"
            : "Сохранить ссылку"}
      </Button>
    </form>
  );
}
