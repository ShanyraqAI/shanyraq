"use client";
import { useState } from "react";
import type { AgreementWorkspace } from "@/lib/agreements/service";
export function PublicRulesEditor({
  current,
  busy,
  save,
}: {
  current: AgreementWorkspace["publicRules"];
  busy: boolean;
  save: (text: string, version: number, published: boolean) => void;
}) {
  const [text, setText] = useState(current?.text ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const input =
    "min-h-12 w-full min-w-0 rounded-xl border bg-background px-3 py-3 text-base";
  return (
    <details className="space-y-3 rounded-xl border p-3">
      <summary className="min-h-12 cursor-pointer py-3 font-semibold">
        Публичная ссылка на правила
      </summary>
      <p className="text-sm leading-relaxed text-[#52645a] dark:text-muted-foreground">
        Отдельная страница для любого обладателя ссылки. Здесь не должно быть
        ФИО гостей, телефонов, ИИН, кодов замков, Wi-Fi-паролей или личных
        документов. Публикация не означает согласие гостя. Личные инструкции и
        договор остаются только в защищённом пакете.
      </p>
      {current?.published && current.url ? (
        <a
          className="inline-flex min-h-12 max-w-full items-center break-all text-primary underline"
          href={current.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Открыть публичные правила · версия {current.version}
        </a>
      ) : (
        <p className="text-sm">Правила не опубликованы.</p>
      )}
      <label className="block space-y-2">
        <span className="font-semibold">Только публичный текст правил</span>
        <textarea
          className={`${input} min-h-36`}
          value={text}
          maxLength={6000}
          disabled={busy}
          onChange={(e) => {
            setText(e.target.value);
            setConfirmed(false);
          }}
        />
      </label>
      <label className="flex min-h-12 items-start gap-3 py-2">
        <input
          className="mt-1 size-5 shrink-0"
          type="checkbox"
          checked={confirmed}
          disabled={busy}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>
          Я проверил(а) текст: в нём нет персональных данных и секретов.
          Разрешаю общедоступную публикацию.
        </span>
      </label>
      <button
        className="min-h-12 w-full rounded-xl bg-[#087e68] px-4 py-3 text-base font-semibold text-white disabled:opacity-50"
        disabled={busy || !confirmed || text.trim().length < 10}
        onClick={() => save(text, current?.version ?? 0, true)}
      >
        Опубликовать новую версию правил
      </button>
      {current?.published ? (
        <button
          className={input}
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                "Снять публичные правила с публикации? Старые принятые версии останутся в архиве.",
              )
            )
              save(current.text, current.version, false);
          }}
        >
          Снять с публикации
        </button>
      ) : null}
      <p className="text-sm leading-relaxed text-[#52645a] dark:text-muted-foreground">
        После изменения правил ранее выданные пакеты потребуется создать и
        принять заново. Предыдущие версии сохраняются.
      </p>
    </details>
  );
}
