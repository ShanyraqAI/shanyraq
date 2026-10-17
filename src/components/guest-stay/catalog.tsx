/* eslint-disable @next/next/no-img-element -- explicit published photos, no optimizer cache */
"use client";
import { useCallback, useEffect, useState } from "react";
import type { CatalogView } from "@/lib/guest-stay/catalog";
import { readApi } from "@/components/communications/api";
import { inputClass, buttonClass } from "./styles";
export function PublicCatalog({
  slug,
  listingId,
  preview = false,
}: {
  slug: string;
  listingId?: string;
  preview?: boolean;
}) {
  const [data, setData] = useState<CatalogView | null>(null),
    [error, setError] = useState("");
  const [checkIn, setCheckIn] = useState(""),
    [checkOut, setCheckOut] = useState(""),
    [guests, setGuests] = useState(1),
    [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState<{
    checkIn: string;
    checkOut: string;
    guests: number;
  } | null>(null);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const q = new URLSearchParams({
        slug,
        ...(listingId ? { listingId } : {}),
        ...(preview ? { preview: "true" } : {}),
      });
      if (selection) {
        q.set("checkIn", selection.checkIn);
        q.set("checkOut", selection.checkOut);
        q.set("guests", String(selection.guests));
      }
      setBusy(true);
      try {
        const v = await fetch(`/api/catalog?${q}`, {
          cache: "no-store",
          signal,
        }).then(readApi<CatalogView>);
        setData(v);
        setError("");
      } catch (e) {
        if (!signal?.aborted) {
          setData(null);
          setError(
            e instanceof Error
              ? e.message
              : "Не удалось проверить доступность. Уточните у хозяина.",
          );
        }
      } finally {
        if (!signal?.aborted) setBusy(false);
      }
    },
    [slug, listingId, preview, selection],
  );
  useEffect(() => {
    const c = new AbortController();
    void Promise.resolve().then(() => load(c.signal));
    const onFocus = () => {
      if (!document.hidden) void load(c.signal);
    };
    window.addEventListener("focus", onFocus);
    const timer = setInterval(onFocus, 30000);
    return () => {
      c.abort();
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);
  return (
    <main className="mx-auto min-h-dvh w-full max-w-4xl space-y-6 px-4 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] [overflow-wrap:anywhere]">
      <header>
        <h1 className="text-2xl font-semibold">
          {listingId ? "Квартира" : "Каталог квартир"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Просмотр доступности не создаёт бронь и не удерживает квартиру.
          Условия и окончательное подтверждение — у хозяина.
        </p>
        {preview ? (
          <p role="status">
            Предпросмотр для хозяина. Неопубликованная карточка гостям не видна.
          </p>
        ) : null}
      </header>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSelection({ checkIn, checkOut, guests });
        }}
        className="grid min-w-0 gap-3 rounded-2xl border p-4 sm:grid-cols-3"
      >
        <label className="min-w-0">
          Заезд
          <input
            required
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="min-w-0">
          Выезд
          <input
            required
            type="date"
            value={checkOut}
            min={checkIn}
            onChange={(e) => setCheckOut(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="min-w-0">
          Гостей
          <input
            required
            type="number"
            min={1}
            max={20}
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            className={inputClass}
          />
        </label>
        <button disabled={busy} className={`${buttonClass} sm:col-span-3`}>
          {busy ? "Проверяем…" : "Показать доступность"}
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      {data && !data.cards.length ? (
        <p>Опубликованных квартир не найдено.</p>
      ) : null}
      <div className="grid min-w-0 gap-5 sm:grid-cols-2">
        {data?.cards.map((c) => {
          let contact = c.contactUrl;
          if (contact) {
            const u = new URL(contact);
            u.searchParams.set(
              "text",
              `Здравствуйте! Хочу обсудить ${c.title}${data.selection ? `, ${data.selection.checkIn} — ${data.selection.checkOut}, гостей: ${data.selection.guests}` : ""}.`,
            );
            contact = u.toString();
          }
          return (
            <article
              key={c.id}
              className="min-w-0 space-y-3 rounded-2xl border bg-card p-4"
            >
              <h2 className="text-xl font-semibold">{c.title}</h2>
              {c.photoPositions.length ? (
                <div
                  className="flex snap-x gap-2 overflow-x-auto"
                  aria-label="Фотографии квартиры"
                >
                  {c.photoPositions.map((p) => (
                    <img
                      key={p}
                      alt={`${c.title} · ${p + 1}`}
                      width={600}
                      height={450}
                      src={`/api/catalog/${c.id}/photo/${p}`}
                      className="aspect-[4/3] w-full shrink-0 snap-center rounded-xl object-cover"
                    />
                  ))}
                </div>
              ) : null}
              {c.publicLocation ? <p>{c.publicLocation}</p> : null}
              <p>
                До {c.capacity} гостей · Заезд {c.checkInTime}, выезд{" "}
                {c.checkOutTime} · {c.timezone}
              </p>
              {c.description ? (
                <p className="whitespace-pre-wrap">{c.description}</p>
              ) : null}
              {c.amenities ? (
                <p className="whitespace-pre-wrap">{c.amenities}</p>
              ) : null}
              {c.restrictions ? (
                <p className="whitespace-pre-wrap">{c.restrictions}</p>
              ) : null}
              <p className="font-semibold">
                {c.availability === "AVAILABLE"
                  ? "Доступно на выбранный период — требуется подтверждение хозяина"
                  : c.availability === "UNAVAILABLE"
                    ? "Недоступно на выбранный период"
                    : "Уточните доступность у хозяина"}
              </p>
              {data.selection ? (
                <p>
                  {c.price
                    ? `Проживание за весь период: ${c.price.total.toLocaleString("ru-RU")} ${c.price.currency}. Депозит и дополнительные платежи уточните отдельно.`
                    : "Итоговую стоимость, депозит и дополнительные платежи уточните у хозяина."}
                </p>
              ) : null}
              {!listingId ? (
                <a
                  className="inline-flex min-h-11 items-center underline"
                  href={`/catalog/${encodeURIComponent(slug)}/${c.id}`}
                >
                  Подробнее
                </a>
              ) : null}
              {contact ? (
                <a
                  className={`${buttonClass} block text-center`}
                  href={contact}
                  rel="noreferrer"
                >
                  Обсудить с хозяином
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Обсудите квартиру с хозяином, который передал вам каталог.
                </p>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}
