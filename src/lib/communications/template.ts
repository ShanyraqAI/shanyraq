/** Pure, shared validation. Never evaluate templates as JavaScript or HTML. */
export const VARIABLES = {
  guest_name: "Имя гостя", guest_phone: "Телефон гостя",
  reservation_number: "Номер брони", checkin_date: "Дата заезда", checkin_time: "Время заезда",
  checkout_date: "Дата выезда", checkout_time: "Время выезда", nights_count: "Количество ночей",
  total_amount: "Сумма", currency: "Валюта", property_name: "Название квартиры",
  property_address: "Адрес", property_map_link: "Ссылка на карту", wifi_name: "Сеть Wi-Fi",
  wifi_password: "Пароль Wi-Fi", key_instructions: "Получение ключей", rules_link: "Правила проживания",
  checkin_guide_link: "Инструкция заселения", support_phone: "Телефон поддержки",
} as const;
export type Variable = keyof typeof VARIABLES;
export type TemplateValues = Partial<Record<Variable, string>>;
export const SENSITIVE_VARIABLES: readonly Variable[] = ["wifi_password", "key_instructions"];

export function renderMessage(template: string, values: TemplateValues) {
  const missing = new Set<string>();
  const unknown = new Set<string>();
  const text = template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, raw: string) => {
    const key = raw.trim();
    if (!Object.prototype.hasOwnProperty.call(VARIABLES, key)) { unknown.add(key); return match; }
    const value = values[key as Variable];
    if (!value?.trim()) { missing.add(key); return match; }
    // Insert once: values can never introduce a second template expansion.
    return value;
  });
  const unmatched = template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, "");
  if (unmatched.includes("{{") || unmatched.includes("}}")) unknown.add("некорректные скобки");
  return { text, missing: [...missing], unknown: [...unknown], valid: !missing.size && !unknown.size };
}
export function validateTemplateSyntax(body: string): string | null {
  const values = Object.fromEntries(Object.keys(VARIABLES).map((key) => [key, "значение"])) as TemplateValues;
  const result = renderMessage(body, values);
  return result.unknown.length ? `Неизвестные переменные: ${result.unknown.join(", ")}` : null;
}
export function validateFinalMessage(body: string): string | null {
  if (!body.trim()) return "Введите текст сообщения";
  if (body.length > 4096) return "Сообщение не должно превышать 4096 символов";
  if (body.includes("{{") || body.includes("}}")) return "Заполните или удалите все переменные перед отправкой";
  return null;
}
export const STARTER_TEMPLATES = [
  { name: "Инструкция заселения", body: "Здравствуйте, {{guest_name}}!\n\nВаша квартира: {{property_name}}\nАдрес: {{property_address}}\nЗаезд: {{checkin_date}} после {{checkin_time}}\nВыезд: {{checkout_date}} до {{checkout_time}}\n\nПолучение ключей: {{key_instructions}}" },
  { name: "Подтверждение брони", body: "Здравствуйте, {{guest_name}}! Ваша бронь №{{reservation_number}} подтверждена.\n{{property_name}}\n{{checkin_date}} — {{checkout_date}}\nСумма: {{total_amount}} {{currency}}." },
  { name: "Wi-Fi", body: "Здравствуйте, {{guest_name}}!\nWi-Fi: {{wifi_name}}\nПароль: {{wifi_password}}" },
  { name: "Напоминание о выезде", body: "Здравствуйте, {{guest_name}}! Напоминаем: выезд из {{property_name}} — {{checkout_date}} до {{checkout_time}}. Спасибо, что выбрали нас!" },
  { name: "Благодарность", body: "{{guest_name}}, спасибо за проживание в {{property_name}}! Будем рады видеть вас снова." },
] as const;
