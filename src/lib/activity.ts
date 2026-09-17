type AuditPayload = Record<string, unknown>;

export const USER_VISIBLE_ACTIVITY_ACTIONS = [
  "reservation.created",
  "reservation.updated",
  "reservation.cancelled",
  "reservation.checked_in",
  "reservation.checked_out",
  "reservation.no_show",
  "reservation.confirmed",
  "room.created",
  "room.updated",
  "room.deleted",
  "room.status_changed",
  "ratePlan.created",
  "rates.bulk_updated",
  "hotel.settings_updated",
  "channel.connected",
  "channel.disconnected",
  "channel.room_mappings_saved",
  "channel.rate_mappings_saved",
  "staff.access_saved",
  "staff.permissions_updated",
  "staff.access_removed",
  "staff.invitation_accepted",
] as const;

const ACTION_LABELS: Record<(typeof USER_VISIBLE_ACTIVITY_ACTIONS)[number], string> = {
  "reservation.created": "создана бронь",
  "reservation.updated": "изменена бронь",
  "reservation.cancelled": "отменена бронь",
  "reservation.checked_in": "гость заселён",
  "reservation.checked_out": "гость выселен",
  "reservation.no_show": "отмечена неявка",
  "reservation.confirmed": "бронь подтверждена",
  "room.created": "создан номер",
  "room.updated": "изменён номер",
  "room.deleted": "удалён номер",
  "room.status_changed": "изменён статус номера",
  "ratePlan.created": "создан тариф",
  "rates.bulk_updated": "изменены цены",
  "hotel.settings_updated": "изменены настройки отеля",
  "channel.connected": "подключён канал",
  "channel.disconnected": "отключён канал",
  "channel.room_mappings_saved": "изменено сопоставление номеров",
  "channel.rate_mappings_saved": "изменено сопоставление тарифов",
  "staff.access_saved": "создан или обновлён доступ сотрудника",
  "staff.permissions_updated": "изменены права сотрудника",
  "staff.access_removed": "удалён доступ сотрудника",
  "staff.invitation_accepted": "сотрудник принял приглашение",
};

export const ACTIVITY_TYPES = [
  { value: "reservation", label: "Бронирования" },
  { value: "room", label: "Номера" },
  { value: "rate", label: "Цены и тарифы" },
  { value: "channel", label: "Каналы" },
  { value: "hotel", label: "Настройки" },
  { value: "staff", label: "Сотрудники" },
] as const;

export const AUDIT_FIELD_LABELS: Record<string, string> = {
  guest: "Гость",
  room: "Номер",
  checkIn: "Заезд",
  checkOut: "Выезд",
  totalAmount: "Сумма",
  currency: "Валюта",
  status: "Статус",
  price: "Цена",
  name: "Название",
  floor: "Этаж",
  roomType: "Категория",
  timezone: "Часовой пояс",
  address: "Адрес",
  city: "Город",
  country: "Страна",
  refundable: "Возвратный",
  breakfastIncluded: "Завтрак включён",
  permissions: "Разделы доступа",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Ожидает подтверждения",
  CONFIRMED: "Подтверждена",
  CHECKED_IN: "Гость проживает",
  CHECKED_OUT: "Завершена",
  CANCELLED: "Отменена",
  NO_SHOW: "Неявка",
  AVAILABLE: "Свободен",
  OCCUPIED: "Занят",
  CLEANING: "Уборка",
  MAINTENANCE: "Обслуживание",
  OUT_OF_ORDER: "Не используется",
};

export function parseAuditPayload(value: string | null): AuditPayload {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as AuditPayload : {};
  } catch {
    return {};
  }
}

export function activitySummary(action: string, entityId: string | null, meta: AuditPayload): string {
  const label = ACTION_LABELS[action as keyof typeof ACTION_LABELS] ?? "изменены данные";
  const reference = typeof meta.reference === "string" ? meta.reference : null;
  const number = typeof meta.number === "string" ? meta.number : null;
  if (action.startsWith("reservation.")) return `${label}${reference ? ` ${reference}` : ""}`;
  if (action.startsWith("room.")) return `${label}${number ? ` ${number}` : ""}`;
  return label;
}

export function auditChanges(oldValue: AuditPayload, newValue: AuditPayload) {
  const keys = [...new Set([...Object.keys(oldValue), ...Object.keys(newValue)])];
  return keys.filter((key) => JSON.stringify(oldValue[key]) !== JSON.stringify(newValue[key])).map((key) => ({
    key,
    label: AUDIT_FIELD_LABELS[key] ?? key,
    oldValue: formatAuditValue(oldValue[key]),
    newValue: formatAuditValue(newValue[key]),
  }));
}

function formatAuditValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  if (typeof value === "number") return new Intl.NumberFormat("ru-RU").format(value);
  if (typeof value === "string") {
    const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (isoDate) return `${isoDate[3]}.${isoDate[2]}.${isoDate[1]}`;
    return STATUS_LABELS[value] ?? value;
  }
  if (Array.isArray(value)) return value.map(formatAuditValue).join(", ");
  return JSON.stringify(value);
}
