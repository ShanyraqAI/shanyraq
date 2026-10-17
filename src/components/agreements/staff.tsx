"use client";
import { PublicRulesEditor } from "./public-rules-editor";
import { useState } from "react";
import { readApi } from "@/components/communications/api";
import type { AgreementWorkspace } from "@/lib/agreements/service";
type CreatedSigningLink = {
  id: string;
  title: string;
  url: string;
  expiresAt: string;
};
const input =
  "min-h-12 w-full min-w-0 rounded-xl border bg-background px-3 py-3 text-base";
const secondary =
  "text-sm leading-relaxed text-[#52645a] dark:text-muted-foreground";
const labels: Record<string, string> = {
  WAITING_GUEST: "Владелец подтвердил · ждём гостя",
  ACKNOWLEDGED: "Обе стороны зафиксировали действия · без ЭЦП",
  OUTDATED: "Данные изменились · нужен новый пакет",
  EXPIRED: "Срок ссылки истёк",
  REVOKED: "Ссылка отозвана",
};
function AgreementEditor({
  reservationId,
  scope: _scope,
  onLinkCreated,
  onBusyChange,
  onLinkCleared,
}: {
  reservationId: string;
  scope: string;
  onLinkCreated: (v: CreatedSigningLink) => void;
  onBusyChange?: (v: boolean) => void;
  onLinkCleared?: () => void;
}) {
  const [open, setOpen] = useState(false),
    [data, setData] = useState<AgreementWorkspace | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [docs, setDocs] = useState<{ id: string; required: boolean }[]>([]);
  const [deposit, setDeposit] = useState(""),
    [cancel, setCancel] = useState(""),
    [guide, setGuide] = useState(""),
    [name, setName] = useState("");
  const [approved, setApproved] = useState(false),
    [authority, setAuthority] = useState(false),
    [otp, setOtp] = useState(false);
  const [key, setKey] = useState(""),
    [link, setLink] = useState("");
  const [frozen, setFrozen] = useState(false);

  async function reload() {
    const d = await fetch(
      `/api/agreements?reservationId=${encodeURIComponent(reservationId)}`,
      { cache: "no-store" },
    ).then(readApi<AgreementWorkspace>);
    setData(d);
    return d;
  }
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось выполнить действие.",
      );
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  function post<T>(body: object) {
    return fetch("/api/agreements", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-shanyraq-scope": data!.scope,
      },
      body: JSON.stringify({ ...body, reservationId }),
    }).then(readApi<T>);
  }
  function edited() {
    setApproved(false);
    setKey("");
    setLink("");
    onLinkCleared?.();
  }
  return (
    <section
      data-clarity-mask="true"
      className="space-y-4 rounded-2xl border bg-background p-4"
    >
      <button
        type="button"
        className="min-h-12 w-full text-left text-base font-semibold"
        disabled={busy}
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && !data)
            void run(async () => {
              await reload();
            });
        }}
      >
        Пакет документов · действия владельца и гостя
      </button>
      {open ? (
        <>
          <p className={secondary}>
            Владелец сначала проверяет PDF, правила, депозит и отмену. Гость
            принимает обязательные условия отдельно по одной защищённой ссылке.
            Это не ЭЦП; юридическая проверка способа не выполнена. Доступно
            владельцу.
          </p>
          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-red-300 p-3 text-red-800 dark:text-red-300"
            >
              {error}
            </p>
          ) : null}
          {!data ? (
            <button
              className={input}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await reload();
                })
              }
            >
              {busy ? "Загружаем…" : "Повторить загрузку"}
            </button>
          ) : (
            <>
              <PublicRulesEditor
                key={`${data.scope}:${data.publicRules?.version ?? 0}`}
                current={data.publicRules}
                busy={busy}
                save={(text, version, published) =>
                  void run(async () => {
                    await post({
                      action: "publishRules",
                      text,
                      version,
                      published,
                      publicContentConfirmed: true,
                    });
                    edited();
                    await reload();
                  })
                }
              />
              <fieldset disabled={busy || frozen} className="space-y-3">
                <legend className="font-semibold">PDF этой брони</legend>
                {data.documents.length ? (
                  data.documents.map((d) => (
                    <div key={d.id} className="rounded-xl border p-3">
                      <label className="flex min-h-12 items-center gap-3">
                        <input
                          className="size-5"
                          type="checkbox"
                          checked={docs.some((v) => v.id === d.id)}
                          onChange={(e) => {
                            edited();
                            setDocs((v) =>
                              e.target.checked
                                ? [...v, { id: d.id, required: true }]
                                : v.filter((x) => x.id !== d.id),
                            );
                          }}
                        />
                        <span>
                          {d.type} №{d.documentNumber}
                        </span>
                      </label>
                      {docs.some((v) => v.id === d.id) ? (
                        <label className="flex min-h-12 items-center gap-3">
                          <input
                            className="size-5"
                            type="checkbox"
                            checked={
                              docs.find((v) => v.id === d.id)?.required ?? true
                            }
                            onChange={(e) => {
                              edited();
                              setDocs((v) =>
                                v.map((x) =>
                                  x.id === d.id
                                    ? { ...x, required: e.target.checked }
                                    : x,
                                ),
                              );
                            }}
                          />
                          <span>Обязателен для принятия пакета</span>
                        </label>
                      ) : null}
                      <p className={secondary}>
                        Перед подтверждением прочитайте полный PDF в разделе
                        документов этой брони.
                      </p>
                    </div>
                  ))
                ) : (
                  <p>Сначала создайте PDF этой брони в разделе документов.</p>
                )}
                <h3 className="font-semibold">
                  Правила проживания · обязательные
                </h3>
                <p className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl border p-3">
                  {data.rules ||
                    "Правила не заполнены. Сначала заполните настройки объекта."}
                </p>
                {[
                  {
                    label: "Депозит и условия возврата *",
                    value: deposit,
                    set: setDeposit,
                  },
                  { label: "Условия отмены *", value: cancel, set: setCancel },
                  {
                    label: "Инструкция заселения · информационная *",
                    value: guide,
                    set: setGuide,
                  },
                ].map((f) => (
                  <label key={f.label} className="block space-y-2">
                    <span className="font-semibold">{f.label}</span>
                    <textarea
                      className={`${input} min-h-28`}
                      maxLength={6000}
                      value={f.value}
                      onChange={(e) => {
                        edited();
                        f.set(e.target.value);
                      }}
                    />
                  </label>
                ))}
                <label className="block space-y-2">
                  <span className="font-semibold">
                    Имя представителя владельца *
                  </span>
                  <input
                    autoComplete="name"
                    maxLength={160}
                    className={input}
                    value={name}
                    onChange={(e) => {
                      edited();
                      setName(e.target.value);
                    }}
                  />
                </label>
                <label className="flex min-h-12 items-start gap-3 py-2">
                  <input
                    className="mt-1 size-5 shrink-0"
                    type="checkbox"
                    checked={otp}
                    disabled={!data.smsConfigured || !data.phone}
                    onChange={(e) => {
                      edited();
                      setOtp(e.target.checked);
                    }}
                  />
                  <span>
                    Запрашивать SMS-код у гостя
                    {data.phone
                      ? ` · ${data.phone}`
                      : " · нужен номер +7 в карточке гостя"}
                  </span>
                </label>
                <p className={secondary}>
                  {data.smsConfigured
                    ? "Настройки сервера присутствуют; реальная доставка SMS здесь не проверена. SMS оплачивается через аккаунт владельца. Лимит — 5 кодов на номер за 24 часа."
                    : "Mobizon не настроен. Подтверждение доступно по ссылке без проверки телефона. Для SMS администратор задаёт серверные ключи и зарегистрированное имя отправителя."}
                </p>
                <label className="flex min-h-12 items-start gap-3 py-2">
                  <input
                    className="mt-1 size-5 shrink-0"
                    type="checkbox"
                    checked={authority}
                    onChange={(e) => {
                      edited();
                      setAuthority(e.target.checked);
                    }}
                  />
                  <span>Я уполномочен(а) действовать от владельца.</span>
                </label>
                <label className="flex min-h-12 items-start gap-3 py-2">
                  <input
                    className="mt-1 size-5 shrink-0"
                    type="checkbox"
                    checked={approved}
                    onChange={(e) => {
                      setKey("");
                      setApproved(e.target.checked);
                    }}
                  />
                  <span>
                    Я прочитал(а) все выбранные PDF и проверил(а) весь пакет,
                    включая правила, депозит, отмену и инструкцию. Подтверждаю
                    передачу гостю без ЭЦП.
                  </span>
                </label>
              </fieldset>
              <button
                className="min-h-12 w-full rounded-xl bg-[#087e68] px-4 py-3 text-base font-semibold text-white disabled:opacity-50"
                disabled={
                  busy ||
                  !!link ||
                  !approved ||
                  !authority ||
                  name.trim().length < 2 ||
                  deposit.trim().length < 10 ||
                  cancel.trim().length < 10 ||
                  guide.trim().length < 10 ||
                  !data.rules.trim() ||
                  !docs.some((d) => d.required)
                }
                onClick={() =>
                  void run(async () => {
                    const requestKey = key || crypto.randomUUID();
                    setKey(requestKey);
                    setFrozen(true);
                    const result = await post<{
                      id: string;
                      url: string | null;
                      expiresAt: string;
                      replayed: boolean;
                    }>({
                      action: "create",
                      requestKey,
                      revision: data.revision,
                      documents: docs,
                      depositTerms: deposit,
                      cancellationTerms: cancel,
                      guide,
                      ownerName: name.trim(),
                      approved: true,
                      authority: true,
                      requireOtp: otp,
                      expiresInDays: 7,
                    });
                    if (!result.url) {
                      setError(
                        "Запрос уже сохранён, но секретная ссылка не восстанавливается. Создайте новый пакет; старый будет отозван.",
                      );
                      return;
                    }
                    setLink(result.url);
                    onLinkCreated({
                      ...result,
                      url: result.url,
                      title: "Пакет документов по брони",
                    });
                    await reload();
                  })
                }
              >
                {busy
                  ? "Сохраняем…"
                  : frozen && !link
                    ? "Проверить результат того же запроса"
                    : "Подтвердить пакет и добавить ссылку"}
              </button>
              {link ? (
                <p className={`${secondary} break-all`}>
                  Ссылка добавлена в сообщение. Она личная; не публикуйте её.{" "}
                  {link}
                </p>
              ) : null}
              {frozen ? (
                <button
                  className={input}
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Начать новый запрос? Если предыдущий сохранился, новая версия отзовёт его ссылку.",
                      )
                    ) {
                      setFrozen(false);
                      edited();
                      void run(async () => {
                        await reload();
                      });
                    }
                  }}
                >
                  Начать новый запрос
                </button>
              ) : null}
              {data.bundles.map((b) => (
                <article key={b.id} className="space-y-2 border-t pt-3">
                  <h3 className="font-semibold">{labels[b.state]}</h3>
                  <p className={secondary}>
                    Владелец: {b.ownerName} ·{" "}
                    {new Date(b.ownerAcceptedAt).toLocaleString("ru-RU")}
                    {b.guestName ? ` · Гость: ${b.guestName}` : ""}
                  </p>
                  <button
                    className={input}
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const e = await post<unknown>({
                          action: "evidence",
                          bundleId: b.id,
                        });
                        const u = URL.createObjectURL(
                          new Blob([JSON.stringify(e, null, 2)], {
                            type: "application/json",
                          }),
                        );
                        const a = document.createElement("a");
                        a.href = u;
                        a.download = "agreement-evidence.json";
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(u), 10000);
                      })
                    }
                  >
                    Скачать архив PDF и действий
                  </button>
                  {b.state !== "REVOKED" ? (
                    <button
                      className={input}
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Отозвать личную ссылку? Журнал действий сохранится.",
                          )
                        )
                          void run(async () => {
                            await post({ action: "revoke", bundleId: b.id });
                            setLink("");
                            onLinkCleared?.();
                            await reload();
                          });
                      }}
                    >
                      Отозвать ссылку
                    </button>
                  ) : null}
                </article>
              ))}
            </>
          )}
        </>
      ) : null}
    </section>
  );
}

export function AgreementPanel(props: Parameters<typeof AgreementEditor>[0]) {
  return (
    <AgreementEditor key={`${props.scope}:${props.reservationId}`} {...props} />
  );
}
