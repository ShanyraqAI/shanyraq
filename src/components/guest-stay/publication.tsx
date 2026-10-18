/* eslint-disable @next/next/no-img-element -- private owner photo previews must not enter the shared optimizer */
"use client";
import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ExternalLink,
  ImagePlus,
  Link2,
} from "lucide-react";
import { MAX_PHOTOS, MAX_UPLOAD_BYTES } from "@/lib/communications/schema";
import { amenitiesList } from "@/lib/guest-stay/presentation";
import { communicationCommand, readApi } from "@/components/communications/api";
import type { Workspace, Operations } from "./owner";
import { inputClass, buttonClass, secondaryClass } from "./styles";
import { copyText } from "./copy";
const QUICK_AMENITIES = [
  "Wi-Fi",
  "Кондиционер",
  "Парковка",
  "Кухня",
  "Стиральная машина",
  "Рабочее место",
];
export function Publication({
  data,
  roomId,
  busy,
  run,
  command,
  onSaved,
}: Operations & {
  data: Workspace;
  roomId: string;
  onSaved: (notice: string) => void;
}) {
  const [listing, setListing] = useState(
    data.listing ?? {
      title: "",
      description: "",
      publicLocation: "",
      amenities: "",
      restrictions: "",
      contactUrl: "",
      photoIds: [] as string[],
      ratePlanId: null as string | null,
      published: false,
    },
  );
  const [photos, setPhotos] = useState(data.photos);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false),
    [notice, setNotice] = useState("");
  const dirty =
    JSON.stringify(listing) !==
    JSON.stringify(
      data.listing ?? {
        title: "",
        description: "",
        publicLocation: "",
        amenities: "",
        restrictions: "",
        contactUrl: "",
        photoIds: [],
        ratePlanId: null,
        published: false,
      },
    );
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const catalog =
    typeof location !== "undefined"
      ? `${location.origin}${data.catalogPath}`
      : data.catalogPath;
  const property = data.listing?.id ? `${catalog}/${data.listing.id}` : "";
  const selected = amenitiesList(listing.amenities);
  function change(
    field:
      | "title"
      | "description"
      | "publicLocation"
      | "amenities"
      | "restrictions"
      | "contactUrl",
    value: string,
  ) {
    setListing((v) => ({ ...v, [field]: value }));
    setConfirmed(false);
  }
  function selectPhoto(id: string, checked: boolean) {
    setListing((v) => ({
      ...v,
      photoIds: checked
        ? [...v.photoIds, id]
        : v.photoIds.filter((p) => p !== id),
    }));
    setConfirmed(false);
  }
  function move(id: string, delta: number) {
    setListing((v) => {
      const ids = [...v.photoIds],
        at = ids.indexOf(id);
      [ids[at], ids[at + delta]] = [ids[at + delta], ids[at]];
      return { ...v, photoIds: ids };
    });
    setConfirmed(false);
  }
  async function upload(files: File[]) {
    await run(async () => {
      if (files.length + photos.length > MAX_PHOTOS)
        throw new Error(
          `Можно добавить до ${MAX_PHOTOS} фотографий. Выберите меньше файлов.`,
        );
      if (files.some((f) => f.size > MAX_UPLOAD_BYTES))
        throw new Error("Выберите фотографии до 4 МБ каждая.");
      for (const file of files) {
        const form = new FormData();
        form.set("roomId", roomId);
        form.set("file", file);
        const photo = await readApi<{ id: string; name: string }>(
          await fetch("/api/communications/photos", {
            method: "POST",
            headers: { "x-shanyraq-scope": data.photoScope },
            body: form,
          }),
        );
        setPhotos((v) => [...v, photo]);
        setListing((v) => ({ ...v, photoIds: [...v.photoIds, photo.id] }));
        setConfirmed(false);
      }
      setNotice(
        "Фото добавлены. Проверьте и сохраните карточку — сами по себе загрузки её не публикуют.",
      );
    });
  }
  async function removePhoto(id: string) {
    await run(async () => {
      await communicationCommand(data.photoScope, {
        action: "archivePhoto",
        photoId: id,
      });
      setPhotos((v) => v.filter((p) => p.id !== id));
      setListing((v) => ({
        ...v,
        photoIds: v.photoIds.filter((p) => p !== id),
      }));
      setRemoveId(null);
      setConfirmed(false);
      setNotice("Фото убрано из библиотеки. Сохраните обновлённую карточку.");
    });
  }
  function copy(value: string) {
    void copyText(value).then(
      () =>
        setNotice("Ссылка скопирована. Доставка сообщения не подтверждена."),
      () =>
        setNotice(
          "Не удалось скопировать. Откройте страницу и скопируйте адрес.",
        ),
    );
  }
  const orderedPhotos = [
    ...listing.photoIds
      .map((id) => photos.find((p) => p.id === id))
      .filter((v) => v !== undefined),
    ...photos.filter((p) => !listing.photoIds.includes(p.id)),
  ];
  return (
    <form
      aria-label="Редактор страницы квартиры"
      className="min-w-0 space-y-7"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          const { id: ignoredId, version: ignoredVersion, ...fields } = listing;
          void ignoredId;
          void ignoredVersion;
          await command({
            action: "saveListing",
            roomId,
            version: data.listing?.version ?? 0,
            listing: { ...fields, publicContentConfirmed: confirmed },
          });
          onSaved(
            listing.published
              ? "Страница квартиры сохранена и опубликована."
              : "Черновик сохранён. Гостям он не виден.",
          );
        });
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-lg bg-muted px-3 py-2 text-sm">
          {data.listing?.published
            ? "В каталоге"
            : "Черновик · виден только вам"}
        </span>
        {property ? (
          <a
            href={`${data.catalogPath}/${data.listing!.id}?preview=true`}
            className={`${secondaryClass} inline-flex items-center gap-2`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={16} />
            Предпросмотр
          </a>
        ) : null}
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Заполните карточку с телефона. На сайте будут только выбранные
        фотографии и тексты ниже — без личных данных гостей и инструкций входа.
      </p>
      {notice ? (
        <p className="rounded-xl border p-3 text-sm" role="status">
          {notice}
        </p>
      ) : null}
      <fieldset className="space-y-3">
        <legend className="text-lg font-semibold">1. Фотографии</legend>
        <p className="text-sm text-muted-foreground">
          Первая выбранная фотография — обложка. До {MAX_PHOTOS} фото; JPEG,
          PNG, WebP до 4 МБ. HEIC пока не поддерживается.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {orderedPhotos.map((p) => {
            const at = listing.photoIds.indexOf(p.id);
            return (
              <div
                key={p.id}
                className="min-w-0 overflow-hidden rounded-xl border bg-card"
              >
                <label className="relative block cursor-pointer">
                  <img
                    src={`/api/communications/photos/${encodeURIComponent(p.id)}`}
                    alt={p.name}
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <span className="flex min-h-12 items-center gap-2 px-3 text-sm">
                    <input
                      type="checkbox"
                      className="size-5 shrink-0 accent-primary"
                      aria-label={`Показывать фото ${p.name}`}
                      checked={at >= 0}
                      disabled={busy}
                      onChange={(e) => selectPhoto(p.id, e.target.checked)}
                    />
                    {at === 0
                      ? "Обложка"
                      : at > 0
                        ? `Фото ${at + 1}`
                        : "Не показывать"}
                  </span>
                </label>
                {at >= 0 ? (
                  <div className="flex items-center justify-between gap-1 border-t px-2">
                    <button
                      type="button"
                      className="grid size-11 place-items-center disabled:opacity-25"
                      disabled={busy || at === 0}
                      aria-label={`Переместить фото ${at + 1} раньше`}
                      onClick={() => move(p.id, -1)}
                    >
                      <ArrowUp size={18} />
                    </button>
                    <button
                      type="button"
                      className="grid size-11 place-items-center disabled:opacity-25"
                      disabled={busy || at === listing.photoIds.length - 1}
                      aria-label={`Переместить фото ${at + 1} позже`}
                      onClick={() => move(p.id, 1)}
                    >
                      <ArrowDown size={18} />
                    </button>
                  </div>
                ) : null}
                <div className="border-t px-2 py-1">
                  {removeId === p.id ? (
                    <div className="space-y-2 p-1">
                      <p className="text-sm">
                        Убрать из каталога и будущих сообщений? Подготовленные
                        сообщения сохранят фото.
                      </p>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className={secondaryClass}
                          disabled={busy}
                          onClick={() => void removePhoto(p.id)}
                        >
                          Убрать фото
                        </button>
                        <button
                          type="button"
                          className={secondaryClass}
                          onClick={() => setRemoveId(null)}
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="min-h-11 w-full text-sm text-muted-foreground"
                      disabled={busy}
                      aria-label={`Удалить из библиотеки ${p.name}`}
                      onClick={() => setRemoveId(p.id)}
                    >
                      Удалить
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {photos.length < MAX_PHOTOS ? (
          <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-base font-medium focus-within:ring-2 focus-within:ring-primary">
            <ImagePlus size={20} />
            {busy ? "Добавляем фото…" : "Добавить фото с телефона"}
            <input
              aria-label="Добавить фото с телефона"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              className="sr-only"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length) void upload(files);
              }}
            />
          </label>
        ) : null}
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">2. О квартире</legend>
        <label className="block text-sm">
          Название
          <input
            className={`${inputClass} mt-2`}
            maxLength={160}
            required
            placeholder="Например, светлая квартира у парка"
            value={listing.title}
            disabled={busy}
            onChange={(e) => change("title", e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Расположение для гостей
          <input
            className={`${inputClass} mt-2`}
            maxLength={500}
            placeholder="Город и район — точный адрес необязателен"
            value={listing.publicLocation}
            disabled={busy}
            onChange={(e) => change("publicLocation", e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Описание
          <textarea
            aria-label="Описание"
            className={`${inputClass} mt-2`}
            rows={5}
            maxLength={6000}
            placeholder="Что за квартира, кому подойдёт и что интересного рядом?"
            value={listing.description}
            disabled={busy}
            onChange={(e) => change("description", e.target.value)}
          />
        </label>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-lg font-semibold">3. Преимущества</legend>
        <p className="text-sm text-muted-foreground">
          Отметьте только то, что есть, или добавьте своё.
        </p>
        <div className="flex flex-wrap gap-2">
          {QUICK_AMENITIES.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={selected.includes(a)}
              disabled={busy}
              className={`${secondaryClass} inline-flex items-center gap-2 ${selected.includes(a) ? "border-primary bg-primary/5" : ""}`}
              onClick={() =>
                change(
                  "amenities",
                  (selected.includes(a)
                    ? selected.filter((v) => v !== a)
                    : [...selected, a]
                  ).join("\n"),
                )
              }
            >
              {selected.includes(a) ? <Check size={16} /> : null}
              {a}
            </button>
          ))}
        </div>
        <label className="block text-sm">
          Свои преимущества
          <textarea
            aria-label="Свои преимущества"
            className={`${inputClass} mt-2`}
            maxLength={2000}
            rows={3}
            placeholder="Каждое преимущество с новой строки"
            value={listing.amenities}
            disabled={busy}
            onChange={(e) => change("amenities", e.target.value)}
          />
        </label>
      </fieldset>
      <details className="rounded-xl border px-4">
        <summary className="min-h-12 cursor-pointer py-3 text-sm font-semibold">
          Связь, стоимость и правила
        </summary>
        <div className="space-y-4 pb-4">
          <label className="block text-sm">
            Ссылка для связи
            <input
              type="url"
              aria-label="Ссылка для связи"
              inputMode="url"
              className={`${inputClass} mt-2`}
              placeholder="https://wa.me/…"
              maxLength={500}
              value={listing.contactUrl}
              disabled={busy}
              onChange={(e) => change("contactUrl", e.target.value)}
            />
            <span className="mt-2 block text-sm text-muted-foreground">
              Необязательно. Нужна HTTPS-ссылка на ваш способ связи.
            </span>
          </label>
          <label className="block text-sm">
            Стоимость
            <select
              aria-label="Стоимость"
              className={`${inputClass} mt-2`}
              value={listing.ratePlanId ?? ""}
              disabled={busy}
              onChange={(e) => {
                setListing((v) => ({
                  ...v,
                  ratePlanId: e.target.value || null,
                }));
                setConfirmed(false);
              }}
            >
              <option value="">Уточняется у хозяина</option>
              {data.ratePlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Важные правила
            <textarea
              aria-label="Важные правила"
              className={`${inputClass} mt-2`}
              rows={3}
              maxLength={2000}
              placeholder="Например, без курения и вечеринок"
              value={listing.restrictions}
              disabled={busy}
              onChange={(e) => change("restrictions", e.target.value)}
            />
          </label>
        </div>
      </details>
      <div className="space-y-4 border-t pt-5">
        <label className="flex min-h-12 items-center justify-between gap-4 text-base font-semibold">
          Показывать в каталоге
          <input
            aria-label="Показывать в каталоге"
            type="checkbox"
            role="switch"
            className="size-6 shrink-0 accent-primary"
            checked={listing.published}
            disabled={busy}
            onChange={(e) => {
              setListing((v) => ({ ...v, published: e.target.checked }));
              setConfirmed(false);
            }}
          />
        </label>
        <label className="flex min-h-11 items-start gap-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            required
            className="mt-1 size-5 shrink-0 accent-primary"
            checked={confirmed}
            disabled={busy}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          Проверено: эти тексты и фото можно показывать всем. В них нет кодов
          доступа, паролей или личных данных.
        </label>
        <button
          className={`${buttonClass} w-full`}
          disabled={busy || !confirmed}
        >
          {busy
            ? "Сохраняем…"
            : listing.published
              ? "Сохранить и опубликовать"
              : "Сохранить черновик"}
        </button>
        <p className="text-sm text-muted-foreground">
          Изменения появятся на сайте только после сохранения. Чтобы скрыть
          страницу, выключите «Показывать в каталоге» и сохраните.
        </p>
      </div>
      {data.listing?.published ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            className={`${secondaryClass} inline-flex items-center justify-center gap-2`}
            onClick={() => copy(property)}
          >
            <Link2 size={16} />
            Ссылка на квартиру
          </button>
          <button
            type="button"
            className={secondaryClass}
            onClick={() => copy(catalog)}
          >
            Ссылка на каталог
          </button>
        </div>
      ) : null}
    </form>
  );
}
