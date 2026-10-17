/** Explicit public-message allowlist. Never spread a profile or booking into it. */
export interface ApartmentPresentation {
  name: string;
  capacity: number;
  nightlyPrice: string;
  typeDescription?: string | null;
}
export function apartmentPresentationText(p: ApartmentPresentation, locale: "ru" | "kk" = "ru") {
  const kk = locale === "kk";
  return [p.name, `${kk ? "Сыйымдылық" : "Вместимость"}: ${p.capacity}`,
    `${kk ? "Базалық баға" : "Базовая цена"}: ${p.nightlyPrice} / ${kk ? "түн" : "ночь"}`,
    kk ? "Нақты құны күндер мен тарифке байланысты." : "Итоговая стоимость зависит от дат и тарифа.",
    p.typeDescription?.trim()].filter(Boolean).join("\n");
}
