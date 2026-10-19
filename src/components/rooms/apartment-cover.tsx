/* eslint-disable @next/next/no-img-element -- authenticated private photo; must not enter shared optimizer */
"use client";
import { useState } from "react";
import { ImageOff } from "lucide-react";
export function ApartmentCover({ photoId, name, restricted, kk }: { photoId?: string | null; name: string; restricted?: boolean; kk: boolean }) {
  const [failedId, setFailedId] = useState<string | null>(null);
  return <div className="aspect-[4/3] w-full overflow-hidden bg-secondary">
    {photoId && photoId !== failedId ? <img src={`/api/communications/photos/${encodeURIComponent(photoId)}`} width={640} height={480} alt={kk ? `${name} пәтерінің суреті` : `Фотография квартиры ${name}`} loading="lazy" decoding="async" className="h-full w-full object-cover" onError={() => setFailedId(photoId)} /> : <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground"><ImageOff className="size-7" aria-hidden="true" /><span>{restricted ? (kk ? "Суреттерге қолжетімділік шектеулі" : "Доступ к фото ограничен") : failedId ? (kk ? "Сурет жүктелмеді" : "Не удалось загрузить фото") : (kk ? "Сурет әлі қосылмаған" : "Фотография ещё не добавлена")}</span></div>}
  </div>;
}
