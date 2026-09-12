export const ANALYTICS_EVENT_TYPES = [
  "signup_completed",
  "hotel_created",
  "room_created",
  "room_updated",
  "reservation_created",
  "reservation_updated",
  "reservation_cancelled",
  "calendar_opened",
  "guest_created",
  "rate_updated",
  "feedback_submitted",
  "bug_reported",
  "login",
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

const EVENT_TYPES = new Set<string>(ANALYTICS_EVENT_TYPES);
const SAFE_METADATA_KEYS = new Set(["method", "source", "status", "rangeDays"]);

export function isAnalyticsEventType(value: unknown): value is AnalyticsEventType {
  return typeof value === "string" && EVENT_TYPES.has(value);
}

export function safeAnalyticsMetadata(
  value: Record<string, unknown> | undefined,
): Record<string, string | number | boolean> | undefined {
  if (!value) return undefined;
  const entries = Object.entries(value)
    .filter((entry): entry is [string, string | number | boolean] => {
      const [key, item] = entry;
      return SAFE_METADATA_KEYS.has(key) && (typeof item === "string" || typeof item === "number" || typeof item === "boolean");
    })
    .slice(0, 8)
    .map(([key, item]) => [key, typeof item === "string" ? item.slice(0, 80) : item] as const);
  return entries.length ? Object.fromEntries(entries) : undefined;
}
