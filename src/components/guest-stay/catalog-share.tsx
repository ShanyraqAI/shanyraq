"use client";
import { copyText } from "./copy";
import { useState } from "react";
import { secondaryClass } from "./styles";
export function CatalogShareButton({ path }: { path: string }) {
  const [notice, setNotice] = useState("");
  return (
    <div className="space-y-2">
      <button
        type="button"
        className={secondaryClass}
        onClick={() => {
          void copyText(`${location.origin}${path}`).then(
            () =>
              setNotice(
                "Ссылка каталога скопирована. В нём видны только явно опубликованные квартиры.",
              ),
            () =>
              setNotice(
                "Не удалось скопировать. Откройте каталог и скопируйте адрес.",
              ),
          );
        }}
      >
        Поделиться каталогом
      </button>
      <a
        className="ml-3 inline-flex min-h-11 items-center text-sm underline"
        href={path}
        target="_blank"
        rel="noreferrer"
      >
        Посмотреть каталог
      </a>
      {notice ? (
        <p className="text-sm" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
