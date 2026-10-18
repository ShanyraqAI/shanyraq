/* eslint-disable @next/next/no-img-element -- published photos, no shared optimizer cache */
"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Home,
  Images,
  MapPin,
  MessageCircle,
  Users,
} from "lucide-react";
import type { CatalogView } from "@/lib/guest-stay/catalog";
import {
  amenitiesList,
  selectionQuery,
  type CatalogSelection,
} from "@/lib/guest-stay/presentation";
import { readApi } from "@/components/communications/api";
import s from "./catalog.module.css";
type Card = CatalogView["cards"][number];
function Photo({
  src,
  alt,
  className,
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div className={s.empty}>
      <Images aria-hidden="true" />
      <span>Фото пока недоступно</span>
    </div>
  ) : (
    <img
      src={src}
      alt={alt}
      width={960}
      height={720}
      loading={eager ? "eager" : "lazy"}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
function photoUrl(card: Card, position: number, preview: boolean) {
  return `/api/catalog/${card.id}/photo/${position}${preview ? "?preview=true" : ""}`;
}
function Gallery({ card, preview }: { card: Card; preview: boolean }) {
  const rail = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  function go(next: number) {
    const el = rail.current;
    if (el)
      el.scrollTo({
        left: el.clientWidth * next,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }
  if (!card.photoPositions.length)
    return (
      <div className={s.empty}>
        <Images aria-hidden="true" />
        <span>Хозяин пока не добавил фотографии</span>
      </div>
    );
  return (
    <section className={s.gallery} aria-label="Фотографии квартиры">
      <div className={s.galleryFrame}>
        <div
          ref={rail}
          className={s.photoRail}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              go(
                Math.max(
                  0,
                  Math.min(
                    card.photoPositions.length - 1,
                    index + (e.key === "ArrowRight" ? 1 : -1),
                  ),
                ),
              );
            }
          }}
          onScroll={(e) => {
            const el = e.currentTarget;
            setIndex(Math.round(el.scrollLeft / el.clientWidth));
          }}
        >
          {card.photoPositions.map((position, i) => (
            <div key={position} className={s.slide}>
              <Photo
                src={photoUrl(card, position, preview)}
                alt={`${card.title} · фото ${i + 1}`}
                eager={i === 0}
              />
            </div>
          ))}
        </div>
        {card.photoPositions.length > 1 ? (
          <>
            <button
              className={`${s.galleryArrow} ${s.prev}`}
              aria-label="Предыдущее фото"
              disabled={index === 0}
              onClick={() => go(index - 1)}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              className={`${s.galleryArrow} ${s.next}`}
              aria-label="Следующее фото"
              disabled={index === card.photoPositions.length - 1}
              onClick={() => go(index + 1)}
            >
              <ChevronRight size={20} />
            </button>
          </>
        ) : null}
        <span className={s.photoCounter} aria-live="polite">
          {index + 1} / {card.photoPositions.length}
        </span>
      </div>
      {card.photoPositions.length > 1 ? (
        <div className={s.thumbs}>
          {card.photoPositions.map((position, i) => (
            <button
              key={position}
              className={s.thumb}
              aria-label={`Показать фото ${i + 1}`}
              aria-pressed={index === i}
              onClick={() => go(i)}
            >
              <Photo src={photoUrl(card, position, preview)} alt="" />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
function Availability({ card, selected }: { card: Card; selected: boolean }) {
  if (!selected) return null;
  return (
    <div className={s.availability}>
      <p
        className={card.availability === "AVAILABLE" ? s.available : undefined}
      >
        {card.availability === "AVAILABLE"
          ? "Свободно на выбранные даты"
          : card.availability === "UNAVAILABLE"
            ? "Занято на выбранные даты"
            : "Доступность уточните у хозяина"}
      </p>
      {card.price ? (
        <p className={s.price}>
          {card.price.total.toLocaleString("ru-RU")} {card.price.currency}{" "}
          <span className={s.muted}>за весь период</span>
        </p>
      ) : (
        <p className={s.muted}>Стоимость уточните у хозяина</p>
      )}
    </div>
  );
}
function Detail({
  card,
  preview,
  selection,
  filters,
}: {
  card: Card;
  preview: boolean;
  selection: CatalogSelection | null;
  filters: ReactNode;
}) {
  const amenities = amenitiesList(card.amenities);
  let contact = card.contactUrl;
  if (contact) {
    const u = new URL(contact);
    u.searchParams.set(
      "text",
      `Здравствуйте! Интересует ${card.title}${selection ? `, ${selection.checkIn} — ${selection.checkOut}, гостей: ${selection.guests}` : ""}.`,
    );
    contact = u.toString();
  }
  return (
    <>
      <div className={s.detailGrid}>
        <Gallery key={card.id} card={card} preview={preview} />
        <div className={s.overview}>
          <h1 className={s.detailTitle}>{card.title}</h1>
          {card.publicLocation ? (
            <p className={s.location}>
              <MapPin size={16} aria-hidden="true" />
              {card.publicLocation}
            </p>
          ) : null}
          <div className={s.facts}>
            <div className={s.fact}>
              <Users size={22} aria-hidden="true" />
              <span>
                <b>До {card.capacity} гостей</b>Вместимость
              </span>
            </div>
            <div className={s.fact}>
              <Clock3 size={22} aria-hidden="true" />
              <span>
                <b>
                  {card.checkInTime} / {card.checkOutTime}
                </b>
                Заезд / выезд
              </span>
            </div>
          </div>
          {filters}
          <Availability card={card} selected={!!selection} />
          <div className={s.contact}>
            {contact ? (
              <a className={s.button} href={contact} rel="noreferrer">
                <MessageCircle size={18} aria-hidden="true" />
                Связаться с хозяином
              </a>
            ) : (
              <p className={s.muted}>
                Чтобы обсудить проживание, свяжитесь с хозяином, который передал
                вам каталог.
              </p>
            )}
            <p className={s.muted}>
              Без бронирования на сайте. Наличие, стоимость и условия
              подтверждает хозяин.
            </p>
          </div>
        </div>
      </div>
      <div className={s.bodySections}>
        <div>
          {card.description ? (
            <section className={s.section}>
              <h2>О квартире</h2>
              <p className={s.prose}>{card.description}</p>
            </section>
          ) : null}
          {amenities.length ? (
            <section className={s.section}>
              <h2>Преимущества</h2>
              <ul className={s.amenities}>
                {amenities.map((a) => (
                  <li key={a}>
                    <Check size={19} aria-hidden="true" />
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
        <div>
          <section className={s.section}>
            <h2>Детали проживания</h2>
            <p
              className={s.prose}
            >{`Заезд с ${card.checkInTime}\nВыезд до ${card.checkOutTime}`}</p>
            <p className={s.muted}>Время объекта: {card.timezone}</p>
            {card.restrictions ? (
              <p className={`${s.prose} mt-4`}>{card.restrictions}</p>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}
export function PublicCatalog({
  slug,
  listingId,
  preview = false,
  initialSelection,
}: {
  slug: string;
  listingId?: string;
  preview?: boolean;
  initialSelection?: CatalogSelection;
}) {
  const [data, setData] = useState<CatalogView | null>(null),
    [error, setError] = useState("");
  const [checkIn, setCheckIn] = useState(initialSelection?.checkIn ?? ""),
    [checkOut, setCheckOut] = useState(initialSelection?.checkOut ?? ""),
    [guests, setGuests] = useState(initialSelection?.guests ?? 1),
    [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState<CatalogSelection | null>(
    initialSelection ?? null,
  );
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
        if (!signal?.aborted) {
          setData(v);
          setError("");
        }
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
    queueMicrotask(() => {
      if (!c.signal.aborted) void load(c.signal);
    });
    const refresh = () => {
      if (!document.hidden) void load(c.signal);
    };
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, 30000);
    return () => {
      c.abort();
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);
  const filters = (
    <details className={s.filters}>
      <summary aria-label="Даты и гости" className={s.filterSummary}>
        <CalendarDays size={20} aria-hidden="true" />
        <span>
          {selection
            ? `${selection.checkIn} — ${selection.checkOut}`
            : "Даты и гости"}
          <small>
            {selection
              ? `Гостей: ${selection.guests} · изменить`
              : "Проверьте доступность на ваши даты"}
          </small>
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      <form
        className={s.filterForm}
        onSubmit={(e) => {
          e.preventDefault();
          const next = { checkIn, checkOut, guests };
          setData(null);
          setSelection(next);
          const q = new URLSearchParams(selectionQuery(next).slice(1));
          if (preview) q.set("preview", "true");
          history.replaceState(null, "", `${location.pathname}?${q}`);
        }}
      >
        <label>
          Заезд
          <input
            className={s.input}
            type="date"
            required
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
          />
        </label>
        <label>
          Выезд
          <input
            className={s.input}
            type="date"
            required
            min={checkIn}
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
          />
        </label>
        <label>
          Гостей
          <input
            className={s.input}
            type="number"
            min={1}
            max={20}
            required
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
          />
        </label>
        <button className={s.button} disabled={busy}>
          {busy ? "Проверяем…" : "Показать доступность"}
        </button>
      </form>
    </details>
  );
  const listPath = `/catalog/${encodeURIComponent(slug)}${selectionQuery(selection)}`;
  return (
    <main className={s.catalog}>
      <div className={s.shell}>
        <header className={s.top}>
          {listingId ? (
            <a className={s.back} href={listPath}>
              <ArrowLeft size={18} aria-hidden="true" />
              Все квартиры
            </a>
          ) : (
            <span className={s.brand}>
              <span className={s.brandMark}>
                <Home size={18} aria-hidden="true" />
              </span>
              Shanyraq
            </span>
          )}
          <span className={s.muted}>Каталог квартир</span>
        </header>
        {!listingId ? (
          <div className={s.intro}>
            <div>
              <h1 className={s.title}>Найдите своё место</h1>
              <p className={s.muted}>
                Фотографии, описание и всё важное о проживании.
              </p>
            </div>
          </div>
        ) : null}
        {preview ? (
          <p className={s.notice} role="status">
            Предпросмотр. Неопубликованную карточку видите только вы.
          </p>
        ) : null}
        {!listingId ? filters : null}
        {error ? (
          <p role="alert" className={s.notice}>
            {error}
          </p>
        ) : null}
        {!data && !error ? (
          <div
            className={s.grid}
            aria-label="Загрузка каталога"
            aria-busy="true"
          >
            {[0, 1, 2].map((i) => (
              <div key={i} className={s.skeleton} />
            ))}
          </div>
        ) : null}
        {data && !data.cards.length ? (
          <div className={s.empty}>
            <Home aria-hidden="true" />
            <p>
              {listingId
                ? "Квартира недоступна"
                : "Пока нет опубликованных квартир"}
            </p>
            <p>Уточните у хозяина актуальную ссылку.</p>
          </div>
        ) : null}
        {listingId ? (
          data?.cards[0] ? (
            <Detail
              card={data.cards[0]}
              preview={preview}
              selection={data.selection}
              filters={filters}
            />
          ) : null
        ) : (
          <div className={s.grid}>
            {data?.cards.map((card, i) => {
              const path = `/catalog/${encodeURIComponent(slug)}/${card.id}${selectionQuery(selection)}`;
              return (
                <article key={card.id} className={s.card}>
                  <a
                    className={s.coverLink}
                    href={path}
                    aria-label={`Посмотреть ${card.title}`}
                  >
                    {card.photoPositions.length ? (
                      <Photo
                        key={photoUrl(card, card.photoPositions[0], false)}
                        src={photoUrl(card, card.photoPositions[0], false)}
                        alt={card.title}
                        className={s.cover}
                        eager={i < 3}
                      />
                    ) : (
                      <div className={s.empty}>
                        <Images aria-hidden="true" />
                        <span>Фото пока нет</span>
                      </div>
                    )}
                  </a>
                  <div className={s.cardBody}>
                    <h2 className={s.cardTitle}>
                      <a href={path}>{card.title}</a>
                    </h2>
                    {card.publicLocation ? (
                      <p className={s.location}>
                        <MapPin size={15} aria-hidden="true" />
                        {card.publicLocation}
                      </p>
                    ) : null}
                    <div className={s.meta}>
                      <span>
                        <Users size={16} aria-hidden="true" />
                        До {card.capacity} гостей
                      </span>
                      {card.photoPositions.length ? (
                        <span>
                          <Images size={16} aria-hidden="true" />
                          {card.photoPositions.length} фото
                        </span>
                      ) : null}
                    </div>
                    {card.description ? (
                      <p className={s.cardDescription}>{card.description}</p>
                    ) : null}
                    {card.amenities ? (
                      <p className={s.amenityPreview}>
                        {amenitiesList(card.amenities).slice(0, 3).join(" · ")}
                      </p>
                    ) : null}
                    <div className={s.cardBottom}>
                      <Availability card={card} selected={!!data?.selection} />
                      <a href={path} className={s.detailsLink}>
                        Смотреть квартиру
                        <ArrowRight size={16} aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {data?.cards.length ? (
          <p className={`${s.muted} ${s.disclaimer}`}>
            Просмотр каталога не удерживает квартиру. Даты, окончательную
            стоимость, депозит и дополнительные условия согласуйте с хозяином.
          </p>
        ) : null}
      </div>
    </main>
  );
}
