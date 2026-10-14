export const GUEST_PAGE_SIZE = 50;
export const GUEST_DETAIL_PAGE_SIZE = 20;
export function pageNumber(value: unknown) {
  return typeof value === "string" && /^\d{1,6}$/.test(value)
    ? Math.max(1, Math.min(10000, Number(value)))
    : 1;
}
export function guestPageUrl(values: {
  page?: number;
  q?: string;
  guest?: string | null;
  stays?: number;
  notes?: number;
  tab?: "notes" | "stays";
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== null && value !== "")
      params.set(key, String(value));
  return `/dashboard/guests?${params}`;
}
