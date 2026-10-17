import { renderMessage, STARTER_TEMPLATES, type TemplateValues } from "./template";
import type { TemplateVM } from "./types";
export const AUTOMATIC_TEMPLATE = "starter:0";
/** Only include information we actually have; never ship unresolved placeholders. */
export function automaticCheckinText(v: TemplateValues): string {
  const lines = [v.guest_name?.trim() ? `Здравствуйте, ${v.guest_name.trim()}!` : "Здравствуйте!", ""];
  const add = (label: string, value?: string) => { if (value?.trim()) lines.push(`${label}: ${value.trim()}`); };
  add("Ваша квартира", v.property_name);
  add("Адрес", v.property_address);
  add("Карта", v.property_map_link);
  if (v.checkin_date) lines.push(`Заезд: ${v.checkin_date}${v.checkin_time ? ` после ${v.checkin_time}` : ""}`);
  if (v.checkout_date) lines.push(`Выезд: ${v.checkout_date}${v.checkout_time ? ` до ${v.checkout_time}` : ""}`);
  if (v.key_instructions?.trim()) lines.push("", `Получение ключей: ${v.key_instructions.trim()}`);
  if (v.support_phone?.trim()) lines.push("", `Связаться с нами: ${v.support_phone.trim()}`);
  return lines.join("\n").trim();
}
export function resolveDraftTemplate(id: string, templates: TemplateVM[], values: TemplateValues) {
  const saved = templates.find((t) => t.id === id);
  if (saved) return { ...renderMessage(saved.body, values), savedId: saved.id };
  if (id === AUTOMATIC_TEMPLATE) return { text: automaticCheckinText(values), missing: [], unknown: [], savedId: undefined };
  const index = Number(id.replace(/^starter:/, ""));
  const seed = Number.isInteger(index) && index >= 0 ? STARTER_TEMPLATES[index] : undefined;
  return { ...renderMessage(seed?.body ?? STARTER_TEMPLATES[0].body, values), savedId: undefined };
}
export function withDocumentLink(text: string, url?: string): string {
  if (!url || text.includes(url)) return text;
  return `${text.trim()}\n\nОткрыть документ и подтвердить ознакомление: ${url}`;
}
