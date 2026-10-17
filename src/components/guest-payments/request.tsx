"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { readApi } from "@/components/communications/api";
import type {
  PaymentWorkspace,
  PreparedPayment,
} from "@/lib/guest-payments/types";
import { paymentPost, PAYMENT_INPUT, PAYMENT_SECONDARY } from "./client";
export function GuestPaymentRequestButton({
  reservationId,
  enabled,
  locale = "ru",
}: {
  reservationId: string;
  enabled: boolean;
  locale?: "ru" | "kk";
}) {
  const [open, setOpen] = useState(false);
  const kk = locale === "kk";
  return (
    <div className="space-y-2">
      <Button
        className="min-h-12 w-full whitespace-normal hover:bg-primary"
        variant="outline"
        disabled={!enabled}
        onClick={() => setOpen(true)}
      >
        {kk ? "Төлем сұрау" : "Запросить оплату"}
      </Button>
      {!enabled ? (
        <p className={PAYMENT_SECONDARY}>
          {kk
            ? "Kaspi Pay әкімші тексеруінен кейін қосылады."
            : "Kaspi Pay будет доступен после миграции и проверки администратором."}
        </p>
      ) : null}
      {open ? (
        <RequestEditor
          key={reservationId}
          reservationId={reservationId}
          locale={locale}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
function RequestEditor({
  reservationId,
  locale,
  onClose,
  onAttach,
}: {
  reservationId: string;
  locale: "ru" | "kk";
  onClose: () => void;
  onAttach?: (value: PreparedPayment) => void;
}) {
  const [data, setData] = useState<PaymentWorkspace | null>(null),
    [amount, setAmount] = useState(""),
    [purpose, setPurpose] = useState<"BALANCE" | "PREPAYMENT" | "CUSTOM">(
      "BALANCE",
    ),
    [confirmed, setConfirmed] = useState(false),
    [result, setResult] = useState<PreparedPayment | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const busyRef = useRef(false),
    keyRef = useRef<string | null>(null),
    id = useId();
  const kk = locale === "kk";
  const blockedReason = !data
    ? ""
    : data.paymentCollect === "ota"
      ? kk
        ? "Төлемді брондау арнасы қабылдайды. Қайта төлем сұрауға болмайды."
        : "Оплату принимает канал бронирования. Повторный запрос гостю недоступен."
      : ["CANCELLED", "NO_SHOW"].includes(data.status)
        ? kk
          ? "Бұл бронь күйі үшін төлем сұрау қолжетімсіз."
          : "Для отмены или неявки запрос оплаты недоступен."
        : data.currency !== "KZT"
          ? kk
            ? "Kaspi Pay тек KZT үшін қолжетімді."
            : "Kaspi Pay доступен только для брони в KZT."
          : Number(data.remaining) <= 0
            ? kk
              ? "Тұру үшін төлеуге қалған сома жоқ."
              : "По учёту остаток за проживание равен нулю. Депозит оплачивается отдельно."
            : "";
  const dirty = Boolean(
    result ||
    (data && (amount !== data.remaining || purpose !== "BALANCE" || confirmed)),
  );
  const endpoint = `/api/guest-payments?reservationId=${encodeURIComponent(reservationId)}`;
  useEffect(() => {
    const c = new AbortController();
    fetch(endpoint, { cache: "no-store", signal: c.signal })
      .then(readApi<PaymentWorkspace>)
      .then((w) => {
        setData(w);
        setAmount(w.remaining);
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setError(e instanceof Error ? e.message : "Ошибка загрузки");
      });
    return () => c.abort();
  }, [endpoint]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);
  function change() {
    keyRef.current = null;
    setResult(null);
    setNotice("");
  }
  function close() {
    if (busyRef.current) return;
    if (
      dirty &&
      !window.confirm(
        kk
          ? "Терезені жабу керек пе? Дайын сұрау тарихта қалады."
          : "Закрыть окно? Подготовленный запрос останется в истории.",
      )
    )
      return;
    onClose();
  }
  async function refresh() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const w = await readApi<PaymentWorkspace>(
        await fetch(endpoint, { cache: "no-store" }),
      );
      if (data && data.scope !== w.scope)
        throw new Error(
          "Объект изменился. Закройте окно и откройте бронь заново.",
        );
      setData(w);
      setAmount(w.remaining);
      setConfirmed(false);
      change();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function prepare() {
    if (!data || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    keyRef.current ??= crypto.randomUUID();
    try {
      setResult(
        await paymentPost<PreparedPayment>(data.scope, {
          action: "prepare",
          reservationId,
          revision: data.revision,
          amount: amount.replace(",", "."),
          purpose,
          collectionConfirmed: confirmed,
          locale,
          key: keyRef.current,
        }),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Проверьте историю перед повторной попыткой.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function handoff(share: boolean) {
    if (!data || !result || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const checked = await paymentPost<PreparedPayment>(data.scope, {
        action: "validate",
        id: result.id,
      });
      if (share) {
        if (!navigator.share)
          throw new Error(
            kk
              ? "Бұл браузерде бөлісу қолжетімсіз. Мәтінді көшіріңіз."
              : "Системное меню недоступно. Скопируйте текст.",
          );
        await navigator.share({ text: checked.text });
        setNotice(
          kk
            ? "Қолданбадан алушыны тексеріңіз. Жіберу мен төлем расталған жоқ."
            : "Проверьте получателя в приложении. Отправка и оплата не подтверждены.",
        );
      } else {
        await navigator.clipboard.writeText(checked.text);
        setNotice(
          kk
            ? "Мәтін көшірілді. Қолданба мен алушыны өзіңіз таңдаңыз."
            : "Текст скопирован. Приложение и получателя выберите сами.",
        );
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setError(
          e instanceof Error
            ? e.message
            : "Не удалось передать текст. Ничего не отправлено автоматически.",
        );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent
        data-clarity-mask="true"
        className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg max-sm:inset-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none [&_[data-slot=dialog-close]]:min-h-11 [&_[data-slot=dialog-close]]:min-w-11"
      >
        <DialogHeader className="shrink-0 border-b p-4 pr-14 text-left">
          <DialogTitle>{kk ? "Төлем сұрау" : "Запросить оплату"}</DialogTitle>
          <DialogDescription>
            {kk
              ? "Kaspi Pay сілтемесі · төлемді автоматты түрде тіркемейміз"
              : "Ссылка Kaspi Pay · платёж автоматически не учитываем"}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {error ? (
            <p
              role="alert"
              className="break-words rounded-xl border border-destructive/30 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
          {!data ? (
            <div>
              <p role="status">
                {kk ? "Деректер жүктелуде" : "Загружаем данные брони"}
              </p>
              <Button
                className="mt-2 min-h-11"
                variant="outline"
                onClick={() => void refresh()}
                disabled={busy}
              >
                {kk ? "Қайта жүктеу" : "Повторить загрузку"}
              </Button>
            </div>
          ) : result ? (
            <>
              <section className="space-y-3 rounded-xl border p-4">
                <h3 className="font-semibold">
                  {kk ? "Тексерілген мәтін" : "Проверенный текст"}
                </h3>
                <p className="whitespace-pre-wrap break-words text-base leading-relaxed">
                  {result.text}
                </p>
              </section>
              <p className={PAYMENT_SECONDARY}>
                {kk
                  ? "Сұрау дайындалды. Жіберілгені, жеткізілгені және төленгені расталған жоқ."
                  : "Запрос подготовлен. Отправка, доставка и оплата не подтверждены. Скриншот чека не является банковским подтверждением."}
              </p>
              <p className={PAYMENT_SECONDARY}>
                {kk
                  ? "Сома мен алушы берудің алдында қайта тексеріледі."
                  : "Перед копированием или выбором приложения заново проверим актуальность брони, оплат и реквизитов."}
              </p>
              {notice ? (
                <p role="status" className="text-sm">
                  {notice}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <div className="space-y-2 border-b pb-3 text-base">
                <p>
                  {kk ? "Бронь" : "Бронь"} {data.booking}
                </p>
                <p>
                  {kk ? "Тұру құны" : "Стоимость проживания"}: {data.total}{" "}
                  {data.currency}
                </p>
                <p>
                  {kk ? "Төленгені / қайтарылғаны" : "Оплачено / возвращено"}:{" "}
                  {data.paid} / {data.refunded}
                </p>
                <p className="font-semibold">
                  {kk ? "Қалғаны" : "Остаток по учёту"}: {data.remaining}{" "}
                  {data.currency}
                </p>
                <p className={PAYMENT_SECONDARY}>
                  {kk
                    ? "Қайтарылатын депозит бөлек"
                    : "Возвратный депозит отдельно"}
                  : {data.deposit}
                </p>
              </div>
              {!data.method?.enabled ? (
                <div className="space-y-2">
                  <p>
                    {kk
                      ? "Осы нысан үшін төлем сілтемесі қосылмаған."
                      : "Для этого объекта не включена ссылка оплаты."}
                  </p>
                  <Link
                    href="/dashboard/settings?section=payments"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center text-primary underline"
                  >
                    {kk
                      ? "Баптауларды жаңа қойындыда ашу"
                      : "Открыть настройки в новой вкладке"}
                  </Link>
                </div>
              ) : (
                <p className={PAYMENT_SECONDARY}>
                  {kk ? "Алушы" : "Получатель"}: {data.method.recipient} ·{" "}
                  {kk ? "Банк растауы жоқ" : "Банком не подтверждён"}
                </p>
              )}
              {blockedReason ? (
                <p role="status" className={PAYMENT_SECONDARY}>
                  {blockedReason}
                </p>
              ) : null}
              <fieldset disabled={busy} className="min-w-0 space-y-3">
                <label htmlFor={`${id}-purpose`} className="block space-y-1">
                  <span>{kk ? "Мақсаты" : "Назначение"}</span>
                  <select
                    id={`${id}-purpose`}
                    className={PAYMENT_INPUT}
                    value={purpose}
                    onChange={(e) => {
                      change();
                      setPurpose(e.target.value as typeof purpose);
                    }}
                  >
                    <option value="BALANCE">
                      {kk ? "Қалған соманы төлеу" : "Оплата остатка"}
                    </option>
                    <option value="PREPAYMENT">
                      {kk ? "Алдын ала төлем" : "Предоплата"}
                    </option>
                    <option value="CUSTOM">
                      {kk ? "Өз сомам" : "Своя сумма"}
                    </option>
                  </select>
                </label>
                <label htmlFor={`${id}-amount`} className="block space-y-1">
                  <span>{kk ? "Сома, KZT" : "Сумма, KZT"}</span>
                  <input
                    id={`${id}-amount`}
                    className={PAYMENT_INPUT}
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => {
                      change();
                      setAmount(e.target.value);
                    }}
                  />
                </label>
                {data.paymentCollect !== "property" &&
                data.paymentCollect !== "ota" ? (
                  <label className="flex min-h-11 items-start gap-3">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => {
                        change();
                        setConfirmed(e.target.checked);
                      }}
                      className="mt-1 size-5 shrink-0"
                    />
                    <span className="text-sm">
                      {kk
                        ? "Төлемді арна емес, нысан қабылдайтынын тексердім."
                        : "Проверено: оплату должен принять объект, а не канал."}
                    </span>
                  </label>
                ) : null}
              </fieldset>
              <p className={PAYMENT_SECONDARY}>
                {kk
                  ? "Соманы қонақ Kaspi.kz ішінде өзі енгізеді. Сілтемені ашу төлем емес."
                  : "По обычной ссылке сумму вводит гость. В URL не добавляются amount или orderId. Открытие ссылки не означает оплату."}
              </p>
              {data.history.length ? (
                <details>
                  <summary className="min-h-11 cursor-pointer text-sm font-semibold">
                    {kk
                      ? "Дайындалған сұраулар"
                      : "История подготовленных запросов"}
                  </summary>
                  {data.history.map((h) => (
                    <p key={h.id} className={PAYMENT_SECONDARY}>
                      {h.amount} KZT ·{" "}
                      {new Date(h.createdAt).toLocaleString(
                        kk ? "kk-KZ" : "ru-RU",
                      )}{" "}
                      ·{" "}
                      {h.stale
                        ? kk
                          ? "Деректер өзгерген"
                          : "Данные изменились"
                        : kk
                          ? "Дайындалған, төлем емес"
                          : "Подготовлен, не платёж"}
                    </p>
                  ))}
                </details>
              ) : null}
            </>
          )}
        </div>
        <footer className="shrink-0 space-y-2 border-t p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          {data && result ? (
            <>
              <Button
                className="min-h-11 w-full"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setResult(null);
                  setNotice("");
                }}
              >
                {kk ? "Артқа" : "Назад"}
              </Button>
              {onAttach ? (
                <Button
                  className="min-h-12 w-full whitespace-normal"
                  disabled={busy}
                  onClick={async () => {
                    if (busyRef.current) return;
                    busyRef.current = true;
                    setBusy(true);
                    setError("");
                    try {
                      const checked = await paymentPost<PreparedPayment>(
                        data.scope,
                        { action: "validate", id: result.id },
                      );
                      onAttach(checked);
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : "Не удалось проверить запрос оплаты.",
                      );
                    } finally {
                      busyRef.current = false;
                      setBusy(false);
                    }
                  }}
                >
                  Добавить запрос оплаты в сообщение
                </Button>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  className="min-h-12 flex-1 whitespace-normal hover:bg-primary"
                  disabled={busy}
                  onClick={() => void handoff(false)}
                >
                  {kk ? "Мәтінді көшіру" : "Скопировать текст"}
                </Button>
                <Button
                  className="min-h-12 flex-1 whitespace-normal"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void handoff(true)}
                >
                  {kk ? "Қолданбаны таңдау" : "Выбрать приложение"}
                </Button>
              </div>
            </>
          ) : data ? (
            <>
              <Button
                className="min-h-12 w-full hover:bg-primary"
                disabled={
                  busy ||
                  Boolean(blockedReason) ||
                  !data.method?.enabled ||
                  data.paymentCollect === "ota" ||
                  ["CANCELLED", "NO_SHOW"].includes(data.status) ||
                  data.currency !== "KZT"
                }
                onClick={() => void prepare()}
              >
                {busy
                  ? kk
                    ? "Дайындау…"
                    : "Готовим…"
                  : kk
                    ? "Хабарламаны тексеру"
                    : "Проверить сообщение"}
              </Button>
              <Button
                variant="ghost"
                className="min-h-11 w-full"
                disabled={busy}
                onClick={() => {
                  if (
                    !dirty ||
                    window.confirm(
                      kk
                        ? "Соманы қайта жүктеу керек пе?"
                        : "Заново загрузить сумму? Введённое значение будет заменено.",
                    )
                  )
                    void refresh();
                }}
              >
                {kk
                  ? "Сомалар мен баптауларды жаңарту"
                  : "Обновить суммы и настройки"}
              </Button>
            </>
          ) : null}
        </footer>
      </DialogContent>
    </Dialog>
  );
}

/** Reuses the same authoritative request editor; no second payment calculator. */
export function GuestPaymentAttachment({
  reservationId,
  onPrepared,
  onBusyChange,
}: {
  reservationId: string;
  onPrepared: (value: PreparedPayment) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  function close() {
    setOpen(false);
    onBusyChange(false);
  }
  return (
    <>
      <Button
        variant="outline"
        className="min-h-12 w-full"
        onClick={() => {
          setOpen(true);
          onBusyChange(true);
        }}
      >
        Настроить запрос оплаты
      </Button>
      {open ? (
        <RequestEditor
          key={reservationId}
          reservationId={reservationId}
          locale="ru"
          onClose={close}
          onAttach={(value) => {
            onPrepared(value);
            close();
          }}
        />
      ) : null}
    </>
  );
}
