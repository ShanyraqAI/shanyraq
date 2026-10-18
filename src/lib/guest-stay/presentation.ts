/** Presentation only: no inferred amenities, prices, or availability. */
export function amenitiesList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\n,;]+/)
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ];
}
export type CatalogSelection = {
  checkIn: string;
  checkOut: string;
  guests: number;
};
export function selectionFromQuery(
  q: Record<string, string | string[] | undefined>,
): CatalogSelection | undefined {
  return typeof q.checkIn === "string" && typeof q.checkOut === "string"
    ? {
        checkIn: q.checkIn,
        checkOut: q.checkOut,
        guests:
          typeof q.guests === "string" && Number.isFinite(Number(q.guests))
            ? Number(q.guests)
            : 1,
      }
    : undefined;
}
export function selectionQuery(selection: CatalogSelection | null): string {
  return selection
    ? `?${new URLSearchParams({ checkIn: selection.checkIn, checkOut: selection.checkOut, guests: String(selection.guests) })}`
    : "";
}
